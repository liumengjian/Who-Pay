// pages/activity/note.js — 活动笔记全屏编辑/阅读（独立页面，返回活动详情）
const { getActivityDetail } = require('../../utils/cloud.js');
const activityNoteApi = require('../../utils/activityNoteApi.js');
const noteStore = require('../../utils/activityNoteStorage.js');
const cloudStorage = require('../../utils/cloudStorage.js');
const {
  dispatchActivityNoteMpHtmlLinkTap,
  inferWxOpenDocumentFileType,
  invokeOpenDocumentWithRetry
} = require('../../utils/activityNoteLinks.js');
const {
  showLoading,
  hideLoading,
  showSuccess,
  showError
} = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

const NOTE_DEFAULT_COLOR = '#333333';
const NOTE_DEFAULT_FONT_PX = 17;
const NOTE_FONT_MIN = 8;
const NOTE_FONT_MAX = 50;

const NOTE_COLOR_PRESETS = [
  '#333333',
  '#000000',
  '#616161',
  '#9e9e9e',
  '#e0e0e0',
  '#ffffff',
  '#c62828',
  '#e65100',
  '#f9a825',
  '#2e7d32',
  '#00695c',
  '#0277bd',
  '#1565c0',
  '#6a1b9a',
  '#ad1457',
  '#4e342e',
  '#37474f',
  '#546e7a'
];

/** 色相条：高饱和鲜亮颜色 */
function hueToVividHex(deg) {
  const h = ((deg % 360) + 360) % 360;
  const s = 0.92;
  const v = 0.98;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) {
    rp = c;
    gp = x;
  } else if (h < 120) {
    rp = x;
    gp = c;
  } else if (h < 180) {
    gp = c;
    bp = x;
  } else if (h < 240) {
    gp = x;
    bp = c;
  } else if (h < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  const r = Math.round((rp + m) * 255);
  const g = Math.round((gp + m) * 255);
  const b = Math.round((bp + m) * 255);
  const hx = (n) => n.toString(16).padStart(2, '0');
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

function normalizeColorToHex(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('#')) {
    if (s.length === 4) {
      return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
    }
    if (s.length === 7) return s.toLowerCase();
    return '';
  }
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
  if (m) {
    const hx = (n) =>
      Math.max(0, Math.min(255, parseInt(n, 10)))
        .toString(16)
        .padStart(2, '0');
    return `#${hx(m[1])}${hx(m[2])}${hx(m[3])}`;
  }
  return '';
}

function clampFontPx(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return NOTE_DEFAULT_FONT_PX;
  return Math.max(NOTE_FONT_MIN, Math.min(NOTE_FONT_MAX, v));
}

function wxWindowWidth() {
  try {
    if (typeof wx.getWindowInfo === 'function') {
      return Number(wx.getWindowInfo().windowWidth) || 375;
    }
  } catch (e) {
    /* ignore */
  }
  try {
    return Number(wx.getSystemInfoSync().windowWidth) || 375;
  } catch (e2) {
    return 375;
  }
}

/** 与全屏笔记页 .activity-note-fs-inner + .note-rich-editor 左右 padding 对齐，供 insertImage 等比缩小 */
function noteRichInsertImageMaxWidthPx() {
  const ww = wxWindowWidth();
  const rpx = ww / 750;
  const pad = (24 + 18) * rpx * 2;
  return Math.max(160, Math.round(ww - pad));
}

function wxWindowHeight() {
  try {
    if (typeof wx.getWindowInfo === 'function') {
      return Number(wx.getWindowInfo().windowHeight) || 667;
    }
  } catch (e) {
    /* ignore */
  }
  return 667;
}

function wxSafeAreaBottomInset() {
  try {
    if (typeof wx.getWindowInfo === 'function') {
      const w = wx.getWindowInfo();
      const sh = Number(w.screenHeight);
      const sa = w.safeArea;
      if (sa && Number.isFinite(sh) && Number.isFinite(sa.bottom)) {
        return Math.max(0, Math.round(sh - sa.bottom));
      }
    }
  } catch (e) {
    /* ignore */
  }
  return 0;
}

Page({
  data: {
    activityId: '',
    isEnded: false,
    noteEditMode: false,
    noteContent: '',
    activityNoteHasPreview: false,
    activityNotePreviewHtml: '',
    activityNoteReadHtml: '',
    noteScrollH: 400,
    noteKbInset: 0,
    noteKbViewportShrunk: false,
    noteKeyboardOpen: false,
    noteBoldActive: false,
    noteFontSizePanelOpen: false,
    noteFontSizePx: NOTE_DEFAULT_FONT_PX,
    noteColorPanelOpen: false,
    noteColorPresets: NOTE_COLOR_PRESETS,
    noteColorPreviewBackground: NOTE_DEFAULT_COLOR,
    noteColorHueThumbLeftPct: 0,
    navHeight: 0,
    noteEditorAreaH: 400,
    noteMpHtmlTagStyle: {
      p: 'margin:0 0 22rpx 0;',
      a: 'text-decoration:none;-webkit-tap-highlight-color:transparent;',
      img: noteStore.NOTE_IMG_HTML_STYLE
    }
  },

  _noteReadUiFromServerNote(an) {
    const contentRaw =
      an && an.content != null && String(an.content).trim()
        ? String(an.content)
        : '';
    const content = noteStore.ensureChipStylesInNoteHtml(contentRaw);
    const linkMap = noteStore.normalizeLinkMapForClient((an && an.linkMap) || {});
    this._noteLinkMap = linkMap;
    const preview = noteStore.notePreviewFromContent(content, linkMap);
    return {
      noteContent: content,
      activityNoteReadHtml: content,
      ...preview
    };
  },

  /** 收起字号/颜色面板（点粗体、图片等其它工具时调用，避免多层面板堆叠） */
  _closeNoteToolbarPanels(done) {
    if (!this.data.noteColorPanelOpen && !this.data.noteFontSizePanelOpen) {
      if (typeof done === 'function') wx.nextTick(done);
      return;
    }
    this.setData(
      { noteColorPanelOpen: false, noteFontSizePanelOpen: false },
      () => {
        this._scheduleRelayoutActivityNotePanel();
        if (typeof done === 'function') done();
      }
    );
  },

  _scheduleRelayoutActivityNotePanel() {
    const run = () => this._relayoutActivityNotePanel();
    wx.nextTick(run);
    setTimeout(run, 50);
    setTimeout(run, 180);
  },

  _relayoutActivityNotePanel() {
    const winW = wxWindowWidth();
    const winH = wxWindowHeight();
    const r = winW / 750;
    const safeB = wxSafeAreaBottomInset();
    const fallbackToolbar =
      Math.ceil((14 + 14 + 88) * r) + safeB + 8;

    wx.createSelectorQuery()
      .in(this)
      .select('#anote-header')
      .boundingClientRect()
      .select('#anote-edit-bottom')
      .boundingClientRect()
      .exec((res) => {
        const header = res && res[0];
        const bottomChrome = res && res[1];
        const navH = this.data.navHeight || 0;
        const headerH =
          header && header.height > 0
            ? header.height
            : navH + Math.ceil((16 + 44 + 20) * r);
        let toolbarH = 0;
        if (this.data.noteEditMode) {
          toolbarH =
            bottomChrome && bottomChrome.height > 0
              ? bottomChrome.height
              : fallbackToolbar;
        }
        const kb = this.data.noteKbInset || 0;
        const shrunk = this.data.noteKbViewportShrunk;
        const kbLift = kb > 0 && !shrunk ? kb : 0;
        const scrollH = Math.max(
          120,
          Math.floor(winH - headerH - toolbarH - kbLift)
        );
        const innerPadV = Math.ceil(48 * r);
        const writingPadV = Math.ceil(32 * r);
        const noteEditorAreaH = Math.max(
          240,
          scrollH - innerPadV - writingPadV
        );
        const patch = {};
        if (scrollH !== this.data.noteScrollH) patch.noteScrollH = scrollH;
        if (noteEditorAreaH !== this.data.noteEditorAreaH) {
          patch.noteEditorAreaH = noteEditorAreaH;
        }
        if (Object.keys(patch).length) {
          this.setData(patch);
        }
      });
  },

  onLoad(options) {
    this._noteColorLastHex = NOTE_DEFAULT_COLOR;
    this._noteColorHue = 210;
    this.setData({ navHeight: getNavTotalHeight() });
    if (wx.onKeyboardHeightChange) {
      this._onKbHeightFn = (res) => {
        const kb = Math.max(0, Number(res.height) || 0);
        let viewportShrunk = false;
        try {
          const curWin = wxWindowHeight();
          if (kb > 0 && this._noteBaselineWinH != null) {
            const shrunk = this._noteBaselineWinH - curWin;
            if (
              shrunk >= 50 &&
              (shrunk >= kb * 0.72 || shrunk + 48 >= kb)
            ) {
              viewportShrunk = true;
            }
          } else if (kb === 0) {
            this._noteBaselineWinH = curWin;
          }
        } catch (e) {
          /* ignore */
        }
        this.setData(
          {
            noteKbInset: kb,
            noteKbViewportShrunk: viewportShrunk,
            noteKeyboardOpen: kb > 0
          },
          () => this._scheduleRelayoutActivityNotePanel()
        );
      };
      wx.onKeyboardHeightChange(this._onKbHeightFn);
    }

    if (wx.onWindowResize) {
      this._onWinResizeForNote = () => {
        this._scheduleRelayoutActivityNotePanel();
      };
      wx.onWindowResize(this._onWinResizeForNote);
    }

    const activityId = options.id;
    if (!activityId) {
      showError('活动ID不存在');
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ activityId });
    try {
      this._noteBaselineWinH = wxWindowHeight();
    } catch (e) {
      this._noteBaselineWinH = null;
    }
    this.loadNotePage();
  },

  onUnload() {
    if (this._noteChooseLocationTimer) {
      clearTimeout(this._noteChooseLocationTimer);
      this._noteChooseLocationTimer = null;
    }
    if (this._onKbHeightFn && wx.offKeyboardHeightChange) {
      wx.offKeyboardHeightChange(this._onKbHeightFn);
      this._onKbHeightFn = null;
    }
    if (this._onWinResizeForNote && wx.offWindowResize) {
      wx.offWindowResize(this._onWinResizeForNote);
      this._onWinResizeForNote = null;
    }
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    if (!this.data.activityId) return;
    const editing =
      !!this._noteEditingSessionActive || !!this.data.noteEditMode;
    const fromNativeMap = !!this._noteChooseLocationOpen;
    if (editing || fromNativeMap) {
      if (editing) this._scheduleRelayoutActivityNotePanel();
      return;
    }
    this.loadNotePage();
  },

  async loadNotePage() {
    if (this._noteEditingSessionActive) {
      return;
    }
    const requestGen =
      (this._notePageLoadGen = (this._notePageLoadGen || 0) + 1);
    this._noteLoadInflight = (this._noteLoadInflight || 0) + 1;
    showLoading('加载中...');
    try {
      const result = await getActivityDetail(this.data.activityId);
      if (this._noteEditingSessionActive || requestGen !== this._notePageLoadGen) {
        return;
      }
      if (!result || !result.activityInfo) {
        throw new Error('活动不存在');
      }
      const isEnded = result.activityInfo.status === 'ended';
      const noteDerived = this._noteReadUiFromServerNote(
        result.activityNote || {}
      );
      this.setData(
        {
          isEnded,
          ...noteDerived,
          noteEditMode: false,
          noteKbInset: 0,
          noteKbViewportShrunk: false,
          noteKeyboardOpen: false
        },
        () => this._scheduleRelayoutActivityNotePanel()
      );
    } catch (e) {
      if (requestGen === this._notePageLoadGen && !this._noteEditingSessionActive) {
        console.error(e);
        showError(e.message || '加载失败');
        setTimeout(() => wx.navigateBack(), 1500);
      }
    } finally {
      this._noteLoadInflight--;
      if (this._noteLoadInflight <= 0) {
        this._noteLoadInflight = 0;
        hideLoading();
      }
    }
  },

  closeActivityNote() {
    if (this.data.noteEditMode) {
      wx.showModal({
        title: '关闭笔记',
        content: '尚未保存，确定关闭？',
        success: (res) => {
          if (!res.confirm) return;
          this._noteEditingSessionActive = false;
          wx.navigateBack();
        }
      });
      return;
    }
    wx.navigateBack();
  },

  async onActivityNoteHeaderAction() {
    if (this.data.isEnded) return;
    if (this.data.noteEditMode) {
      await this.saveActivityNoteDraft();
    } else {
      await this.enterActivityNoteEdit();
    }
  },

  async enterActivityNoteEdit() {
    this._notePageLoadGen = (this._notePageLoadGen || 0) + 1;
    this._noteEditingSessionActive = true;
    this._noteEditorCtx = null;
    const prevMap = this._noteLinkMap || {};
    const linkCopy = Object.create(null);
    for (const k of Object.keys(prevMap)) {
      linkCopy[k] = { ...prevMap[k] };
    }
    this._noteLinkMap = linkCopy;
    this._noteColorLastHex = NOTE_DEFAULT_COLOR;
    this._noteColorHue = 210;
    await new Promise((r) => wx.nextTick(r));
    const seed =
      this.data.noteContent && String(this.data.noteContent).trim()
        ? String(this.data.noteContent)
        : '<p><br></p>';
    this._noteEditorHtmlSeed = seed;
    try {
      if (!this.data.noteKeyboardOpen) {
        this._noteBaselineWinH = wxWindowHeight();
      }
    } catch (e) {
      /* ignore */
    }
    this.setData(
      {
        noteEditMode: true,
        noteBoldActive: false,
        noteFontSizePanelOpen: false,
        noteFontSizePx: NOTE_DEFAULT_FONT_PX,
        noteColorPanelOpen: false,
        noteColorPreviewBackground: NOTE_DEFAULT_COLOR,
        noteColorHueThumbLeftPct: (210 / 360) * 100,
        activityNoteReadHtml: ''
      },
      () => {
        this._scheduleRelayoutActivityNotePanel();
        wx.nextTick(() => {
          if (this._noteEditorCtx) this._flushNoteEditorSeed();
        });
      }
    );
  },

  _flushNoteEditorSeed() {
    if (!this._noteEditorCtx || !this._noteEditorHtmlSeed) return;
    const html = this._noteEditorHtmlSeed;
    this._noteEditorCtx.setContents({
      html,
      success: () => {
        this._noteEditorHtmlSeed = '';
      },
      fail: (err) => {
        console.error('note editor setContents', err);
      }
    });
  },

  /**
   * editor setContents 会清空选区并把光标挪到文首（官方行为）。
   * 基础库 ≥ 3.7.11 提供 setSelection，这里把光标移到当前文末。
   */
  _noteMoveCaretToDocEnd(ctx) {
    if (!ctx || typeof ctx.setSelection !== 'function') return;
    const apply = () => {
      ctx.getContents({
        success: (r) => {
          let index = 0;
          const ops = r && r.delta && r.delta.ops;
          if (Array.isArray(ops)) {
            for (let i = 0; i < ops.length; i++) {
              const op = ops[i];
              if (!op) continue;
              if (typeof op.insert === 'string') {
                index += op.insert.length;
              } else if (op.insert != null && typeof op.insert === 'object') {
                index += 1;
              }
            }
          } else if (r && typeof r.text === 'string') {
            index = r.text.length;
          }
          try {
            ctx.setSelection({ index, length: 0 });
          } catch (e) {
            /* ignore */
          }
        }
      });
    };
    wx.nextTick(() => setTimeout(apply, 32));
  },

  _ensureNoteEditorContext() {
    if (this._noteEditorCtx) {
      return Promise.resolve(this._noteEditorCtx);
    }
    return new Promise((resolve) => {
      wx.nextTick(() => {
        const finish = (ctx) => {
          if (ctx) this._noteEditorCtx = ctx;
          resolve(this._noteEditorCtx || null);
        };
        wx.createSelectorQuery()
          .select('#noteEditor')
          .context((res) => {
            if (res && res.context) {
              finish(res.context);
              return;
            }
            wx.createSelectorQuery()
              .in(this)
              .select('#noteEditor')
              .context((res2) => {
                finish(res2 && res2.context);
              })
              .exec();
          })
          .exec();
      });
    });
  },

  onNoteEditorReady(e) {
    const fromDetail = e && e.detail && e.detail.context;
    if (fromDetail) {
      this._noteEditorCtx = fromDetail;
      this._flushNoteEditorSeed();
      return;
    }
    wx.nextTick(() => {
      wx.createSelectorQuery()
        .select('#noteEditor')
        .context((res) => {
          if (res && res.context) {
            this._noteEditorCtx = res.context;
            this._flushNoteEditorSeed();
            return;
          }
          wx.createSelectorQuery()
            .in(this)
            .select('#noteEditor')
            .context((res2) => {
              if (res2 && res2.context) {
                this._noteEditorCtx = res2.context;
                this._flushNoteEditorSeed();
              }
            })
            .exec();
        })
        .exec();
    });
  },

  onNoteEditorStatusChange(e) {
    const d = (e && e.detail) || {};
    const formats = d.formats && typeof d.formats === 'object' ? d.formats : d;
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(formats, 'bold')) {
      patch.noteBoldActive = !!formats.bold;
    }
    if (formats.fontSize != null && formats.fontSize !== '') {
      const n = parseInt(
        String(formats.fontSize).replace(/px/gi, '').trim(),
        10
      );
      if (Number.isFinite(n)) {
        patch.noteFontSizePx = clampFontPx(n);
      }
    }
    if (formats.color != null && String(formats.color).trim() !== '') {
      const hex = normalizeColorToHex(formats.color);
      if (hex) {
        patch.noteColorPreviewBackground = hex;
        this._noteColorLastHex = hex;
      }
    }
    if (Object.keys(patch).length) {
      this.setData(patch);
    }
  },

  onNoteEditorFocus() {
    /* 不在此强制 format：避免覆盖光标处已有字号/颜色；工具条操作已即时生效 */
  },

  async saveActivityNoteDraft() {
    if (this.data.isEnded) return;
    await this._ensureNoteEditorContext();
    const ctx = this._noteEditorCtx;
    if (!ctx) {
      showError('编辑器未就绪');
      return;
    }
    showLoading('保存中...');
    try {
      let html = await new Promise((resolve, reject) => {
        ctx.getContents({
          success: (r) => resolve(r.html || ''),
          fail: reject
        });
      });
      html = await noteStore.migrateNoteHtmlImagesToCloud(
        html,
        this.data.activityId
      );
      let linkMap = noteStore.cloneLinkMapForSave(this._noteLinkMap || {});
      linkMap = await noteStore.migrateNoteLinkMapAttachmentsToCloud(
        linkMap,
        this.data.activityId
      );
      const res = await activityNoteApi.saveActivityNote(this.data.activityId, {
        content: html,
        linkMap
      });
      hideLoading();
      const saved = res.activityNote || { content: html, linkMap };
      const noteDerived = this._noteReadUiFromServerNote(saved);
      this.setData(
        {
          ...noteDerived,
          noteEditMode: false,
          noteKbInset: 0,
          noteKbViewportShrunk: false,
          noteKeyboardOpen: false,
          noteColorPanelOpen: false,
          noteFontSizePanelOpen: false
        },
        () => {
          this._noteEditingSessionActive = false;
          this._scheduleRelayoutActivityNotePanel();
        }
      );
      showSuccess('已保存');
    } catch (e) {
      hideLoading();
      showError(e.message || '保存失败');
    }
  },

  async onNoteToolBold() {
    await this._ensureNoteEditorContext();
    const ctx = this._noteEditorCtx;
    if (!ctx) return;
    const next = !this.data.noteBoldActive;
    this.setData(
      {
        noteBoldActive: next,
        noteColorPanelOpen: false,
        noteFontSizePanelOpen: false
      },
      () => {
        ctx.format('bold', next);
        this._scheduleRelayoutActivityNotePanel();
      }
    );
  },

  async onNoteToolFontSize() {
    await this._ensureNoteEditorContext();
    const open = !this.data.noteFontSizePanelOpen;
    if (open) {
      try {
        wx.hideKeyboard();
      } catch (e) {
        /* ignore */
      }
    }
    this.setData(
      {
        noteFontSizePanelOpen: open,
        noteColorPanelOpen: open ? false : this.data.noteColorPanelOpen
      },
      () => this._scheduleRelayoutActivityNotePanel()
    );
  },

  /** 拖动中只更新显示数字，避免连续 format 导致选区/光标闪烁（与默认值无关） */
  onNoteFontSizeChanging(e) {
    const v = clampFontPx(e.detail.value);
    this.setData({ noteFontSizePx: v });
  },

  onNoteFontSizeChange(e) {
    const v = clampFontPx(e.detail.value);
    this.setData({ noteFontSizePx: v });
    this._applyEditorFontSize(v);
  },

  _applyEditorFontSize(px) {
    const ctx = this._noteEditorCtx;
    if (!ctx) return;
    ctx.format('fontSize', `${clampFontPx(px)}px`);
  },

  async onNoteToolColor() {
    await this._ensureNoteEditorContext();
    const open = !this.data.noteColorPanelOpen;
    if (open) {
      try {
        wx.hideKeyboard();
      } catch (e) {
        /* ignore */
      }
    }
    const done = () => {
      this._measureHueStripRect(() => {});
    };
    this.setData(
      {
        noteColorPanelOpen: open,
        noteFontSizePanelOpen: open ? false : this.data.noteFontSizePanelOpen,
        noteColorHueThumbLeftPct:
          ((this._noteColorHue != null ? this._noteColorHue : 210) / 360) * 100
      },
      () => {
        if (open) {
          wx.nextTick(done);
        } else {
          const hex = this._noteColorLastHex || NOTE_DEFAULT_COLOR;
          wx.nextTick(() => this._applyEditorColor(hex));
        }
        this._scheduleRelayoutActivityNotePanel();
      }
    );
  },

  _measureHueStripRect(done) {
    wx.createSelectorQuery()
      .in(this)
      .select('.note-hue-strip-hit')
      .boundingClientRect()
      .exec((res) => {
        this._hueStripRect = res && res[0];
        if (typeof done === 'function') done();
      });
  },

  _noteColorTouchClient(e) {
    const t =
      (e.touches && e.touches[0]) ||
      (e.changedTouches && e.changedTouches[0]);
    return t || null;
  },

  onNoteColorHueTouch(e) {
    const t = this._noteColorTouchClient(e);
    if (!t) return;
    const apply = () => {
      const r = this._hueStripRect;
      if (!r || r.width <= 0) return;
      const x = Math.max(
        0,
        Math.min(1, (t.clientX - r.left) / r.width)
      );
      const hue = x * 360;
      this._noteColorHue = hue;
      const hex = hueToVividHex(hue);
      this._noteColorLastHex = hex;
      this.setData({
        noteColorHueThumbLeftPct: x * 100,
        noteColorPreviewBackground: hex
      });
      this._applyEditorColor(hex);
    };
    if (!this._hueStripRect || this._hueStripRect.width <= 0) {
      this._measureHueStripRect(apply);
    } else {
      apply();
    }
  },

  onNoteColorPresetTap(e) {
    const hex = e.currentTarget && e.currentTarget.dataset.hex;
    if (!hex) return;
    const h = String(hex).trim();
    this._noteColorLastHex = h;
    this.setData({ noteColorPreviewBackground: h });
    this._applyEditorColor(h);
  },

  _applyEditorColor(hex) {
    if (!hex || typeof hex !== 'string') return;
    const ctx = this._noteEditorCtx;
    if (!ctx) return;
    ctx.format('color', hex.toLowerCase());
  },

  async onNoteColorDefault() {
    await this._ensureNoteEditorContext();
    const hex = NOTE_DEFAULT_COLOR;
    this._noteColorLastHex = hex;
    this._noteColorHue = 210;
    this.setData({
      noteColorPreviewBackground: hex,
      noteColorHueThumbLeftPct: (210 / 360) * 100
    });
    const ctx = this._noteEditorCtx;
    if (ctx) ctx.format('color', hex);
  },

  onNoteToolImage() {
    this._closeNoteToolbarPanels(() => {
      this._openNoteToolImagePicker();
    });
  },

  _openNoteToolImagePicker() {
    const onFail = (err) => {
      const msg = (err && err.errMsg) || '';
      if (msg.indexOf('cancel') >= 0) return;
      showError('选择图片失败');
    };
    const insert = (path) => {
      if (!path) return;
      this._ensureNoteEditorContext().then((ed) => {
        if (!ed) {
          showError('编辑器未就绪');
          return;
        }
        const applyInsert = (wPx, hPx) => {
          ed.insertImage({
            src: path,
            width: `${Math.max(1, Math.round(wPx))}px`,
            height: `${Math.max(1, Math.round(hPx))}px`,
            alt: '图片'
          });
        };
        wx.getImageInfo({
          src: path,
          success: (info) => {
            let iw = info.width || 1;
            let ih = info.height || 1;
            const maxW = noteRichInsertImageMaxWidthPx();
            if (iw > maxW) {
              ih = (ih * maxW) / iw;
              iw = maxW;
            }
            applyInsert(iw, ih);
          },
          fail: () => {
            const w = Math.min(320, noteRichInsertImageMaxWidthPx());
            applyInsert(w, Math.round((240 * w) / 320));
          }
        });
      });
    };
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        success: (res) => {
          const file = res.tempFiles && res.tempFiles[0];
          insert(file && file.tempFilePath);
        },
        fail: onFail
      });
    } else {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album'],
        success: (res) => {
          insert(res.tempFilePaths && res.tempFilePaths[0]);
        },
        fail: onFail
      });
    }
  },

  onNoteToolNav() {
    this._closeNoteToolbarPanels(() => {
      this.pickLocationForNote();
    });
  },

  onNoteToolAttach() {
    if (!wx.chooseMessageFile) {
      showError('当前版本不支持附件');
      return;
    }
    this._closeNoteToolbarPanels(() => {
      this._runNoteToolAttachFlow();
    });
  },

  _runNoteToolAttachFlow() {
    this._ensureNoteEditorContext().then((ctx) => {
      if (!ctx) {
        showError('编辑器未就绪');
        return;
      }
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        success: async (res) => {
          const f = res.tempFiles && res.tempFiles[0];
          if (!f) return;
          const aid = this.data.activityId;
          const name = f.name || '附件';
          const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] || 'bin';
          showLoading('上传附件...');
          try {
            const cloudPath = `activities/${aid}/notes/att_${Date.now()}.${ext}`;
            const fid = await cloudStorage.migrateAttachmentUrlToCloudIfNeeded(
              f.path,
              cloudPath
            );
            hideLoading();
            if (
              !fid ||
              cloudStorage.isLikelyEphemeralLocal(fid)
            ) {
              showError('附件上传失败');
              return;
            }
            const ed = await this._ensureNoteEditorContext();
            if (!ed) {
              showError('编辑器未就绪');
              return;
            }
            const id = noteStore.genChipId();
            this._noteLinkMap = this._noteLinkMap || Object.create(null);
            this._noteLinkMap[id] = {
              kind: 'att',
              url: fid,
              name
            };
            const frag = noteStore.buildAttChipHtml(id, name);
            ed.getContents({
              success: (r) => {
                ed.setContents({
                  html: (r.html || '') + frag,
                  success: () => this._noteMoveCaretToDocEnd(ed)
                });
              }
            });
          } catch (err) {
            hideLoading();
            showError((err && err.message) || '附件上传失败');
          }
        },
        fail: (err) => {
          const msg = (err && err.errMsg) || '';
          if (msg.indexOf('cancel') >= 0) return;
          showError('选择附件失败');
        }
      });
    });
  },

  pickLocationForNote() {
    if (this._noteChooseLocationTimer) {
      clearTimeout(this._noteChooseLocationTimer);
      this._noteChooseLocationTimer = null;
    }
    this._noteChooseLocationOpen = true;
    const runChoose = (lat, lng) => {
      const opt = {};
      if (typeof lat === 'number' && typeof lng === 'number') {
        opt.latitude = lat;
        opt.longitude = lng;
      }
      wx.chooseLocation({
        ...opt,
        success: async (res) => {
          const ctx = await this._ensureNoteEditorContext();
          if (!ctx) {
            showError('编辑器未就绪');
            return;
          }
          await new Promise((r) => wx.nextTick(r));
          await new Promise((r) => setTimeout(r, 120));
          try {
            await this._insertLocationIntoEditor(res);
          } catch (e) {
            console.error('insert location', e);
            showError('插入地点失败');
          }
        },
        fail: (err) => {
          const msg = (err && err.errMsg) || '';
          if (msg.indexOf('cancel') >= 0) return;
          if (
            msg.indexOf('auth deny') >= 0 ||
            msg.indexOf('authorize') >= 0 ||
            msg.indexOf('permission') >= 0
          ) {
            wx.showModal({
              title: '需要位置权限',
              content: '请允许使用位置信息，以便在地图中选择地点。',
              confirmText: '去设置',
              success: (r) => {
                if (r.confirm) wx.openSetting();
              }
            });
            return;
          }
          showError('选择地点失败');
        },
        complete: () => {
          if (this._noteChooseLocationTimer) {
            clearTimeout(this._noteChooseLocationTimer);
            this._noteChooseLocationTimer = null;
          }
          this._noteChooseLocationTimer = setTimeout(() => {
            this._noteChooseLocationTimer = null;
            this._noteChooseLocationOpen = false;
          }, 450);
        }
      });
    };
    if (wx.getFuzzyLocation) {
      wx.getFuzzyLocation({
        type: 'gcj02',
        success: (loc) => runChoose(loc.latitude, loc.longitude),
        fail: () => runChoose()
      });
    } else {
      runChoose();
    }
  },

  _insertLocationIntoEditor(res) {
    const ctx = this._noteEditorCtx;
    if (!ctx) return Promise.reject(new Error('no editor'));
    const id = noteStore.genChipId();
    const name = String(res.name || res.address || '地点').trim() || '地点';
    const address = String(res.address || '');
    const latitude = Number(res.latitude);
    const longitude = Number(res.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      showError('未获取到有效坐标');
      return Promise.reject(new Error('invalid coords'));
    }
    this._noteLinkMap = this._noteLinkMap || Object.create(null);
    this._noteLinkMap[id] = {
      kind: 'loc',
      lat: latitude,
      lng: longitude,
      name,
      address
    };
    const frag = noteStore.buildLocChipHtml(
      id,
      name,
      latitude,
      longitude,
      address
    );
    return new Promise((resolve, reject) => {
      ctx.getContents({
        success: (r) => {
          ctx.setContents({
            html: (r.html || '') + frag,
            success: () => {
              this._noteMoveCaretToDocEnd(ctx);
              resolve();
            },
            fail: reject
          });
        },
        fail: reject
      });
    });
  },

  onActivityNoteMpHtmlLinkTap(e) {
    const run = (linkMap) => {
      dispatchActivityNoteMpHtmlLinkTap(e, {
        showError,
        openNoteAttachment: (params) =>
          this._openNoteAttachmentFromParams(params),
        linkMap: linkMap || {},
        noteBlocksForLocResolve: []
      });
    };
    run(this._noteLinkMap || {});
  },

  async _openNoteAttachmentFromParams(params) {
    const url = (params && params.url) || '';
    if (!String(url).trim()) {
      showError('附件地址无效');
      return;
    }
    showLoading('打开附件...');
    try {
      const filePath = await cloudStorage.downloadNoteAttachmentToTempPath(url);
      hideLoading();
      const name = (params && params.name) || '';
      const fileType = inferWxOpenDocumentFileType(name, url);
      invokeOpenDocumentWithRetry(filePath, fileType, showError);
    } catch (err) {
      hideLoading();
      showError((err && err.message) || '打开附件失败');
    }
  },

  onActivityNoteMpHtmlImgTap(e) {
    const src = (e.detail && e.detail.src) || '';
    if (!src) return;
    const preview = (html) => {
      const urls = noteStore.extractImageUrlsFromHtml(html);
      wx.previewImage({
        current: src,
        urls: urls.length ? urls : [src]
      });
    };
    if (this.data.noteEditMode) {
      this._ensureNoteEditorContext().then((ctx) => {
        if (!ctx) {
          preview('');
          return;
        }
        ctx.getContents({
          success: (r) => preview(r.html || ''),
          fail: () => preview('')
        });
      });
    } else {
      preview(this.data.noteContent || '');
    }
  },

  stopPropagation() {}
});
