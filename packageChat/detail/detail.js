const friendApi = require('../../service/friend.js');
const cloudStorage = require('../../utils/cloudStorage.js');
const chatEmoji = require('../../utils/chatEmoji.js');
const chatComposeEditor = require('../../utils/chatComposeEditor.js');
const { CLOUD_ENV, CLOUD_SERVICE } = require('../../service/config.js');
const { showLoading, hideLoading, showError } = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

const PAGE_SIZE = 25;

function wxWindowHeight() {
  try {
    if (typeof wx.getWindowInfo === 'function') {
      return Number(wx.getWindowInfo().windowHeight) || 667;
    }
  } catch (e) {
    /* ignore */
  }
  try {
    return Number(wx.getSystemInfoSync().windowHeight) || 667;
  } catch (e) {
    /* ignore */
  }
  return 667;
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
  } catch (e) {
    /* ignore */
  }
  return 375;
}

function parseBubble(msg) {
  const type = msg.type || 'text';
  if (type === 'text' || type === 'system') {
    const text = String(msg.content || '');
    const segments = chatEmoji.parseEmojiText(text);
    const isEmojiOnly =
      segments.length === 1 && segments[0].type === 'emoji';
    return { kind: 'text', text, segments, isEmojiOnly };
  }
  if (type === 'image') {
    const c = String(msg.content || '').trim();
    if (c.startsWith('{')) {
      try {
        const j = JSON.parse(c);
        if (j.url) return { kind: 'image', url: j.url };
      } catch (e) {}
    }
    return { kind: 'image', url: c };
  }
  try {
    const j = JSON.parse(msg.content || '{}');
    if ((type === 'location' || j.kind === 'location') && j.lat != null && j.lng != null) {
      return {
        kind: 'location',
        lat: Number(j.lat),
        lng: Number(j.lng),
        name: j.name || '',
        address: j.address || ''
      };
    }
    if (type === 'attachment' || j.kind === 'attach' || j.kind === 'attachment') {
      return { kind: 'attachment', url: j.url || '', name: j.name || '附件' };
    }
  } catch (e) {}
  return { kind: 'text', text: '[消息]' };
}

Page({
  data: {
    friendId: '',
    friendName: '',
    friendAvatar: '',
    myId: '',
    myAvatar: '',
    messages: [],
    composeHasContent: false,
    scrollTop: 0,
    scrollIntoView: '',
    connected: false,
    messagesHeight: 0,
    keyboardHeight: 0,
    kbViewportShrunk: false,
    keyboardOpen: false,
    showExtra: false,
    showEmoji: false,
    emojiCategories: [],
    emojiCategoryIndex: 0,
    emojiCurrentList: [],
    loadingMore: false,
    hasMore: false,
    navHeight: 0,
    navTitle: ''
  },

  onLoad(options) {
    const friendId = String(options.friendId != null ? options.friendId : '').trim();
    const friendName = decodeURIComponent(options.nickName || '');
    const userInfo = wx.getStorageSync('userInfo') || {};
    const navPx = getNavTotalHeight();
    const title = (friendName && friendName.trim()) || '聊天';

    this._chatBaselineWinH = wxWindowHeight();
    this._initEmojiPanel();

    this.setData({
      friendId,
      friendName,
      myId: String(userInfo.id != null ? userInfo.id : ''),
      myAvatar: userInfo.avatarUrl || '',
      navHeight: navPx,
      navTitle: title
    });

    if (wx.onKeyboardHeightChange) {
      this._onKbHeight = (res) => {
        const kb = Math.max(0, Number(res && res.height) || 0);
        // During send, ignore keyboard-close events to prevent flicker
        // (setContents causes blur→focus, keyboard briefly reports height 0 then original)
        if (this._sending && kb === 0) return;
        let viewportShrunk = false;
        try {
          const curWin = wxWindowHeight();
          if (kb > 0 && this._chatBaselineWinH != null) {
            const shrunk = this._chatBaselineWinH - curWin;
            if (
              shrunk >= 50 &&
              (shrunk >= kb * 0.72 || shrunk + 48 >= kb)
            ) {
              viewportShrunk = true;
            }
          } else if (kb === 0) {
            this._chatBaselineWinH = curWin;
          }
        } catch (e) {
          /* ignore */
        }
        this.setData(
          {
            keyboardHeight: kb,
            kbViewportShrunk: viewportShrunk,
            keyboardOpen: kb > 0,
            showEmoji: kb > 0 ? false : this.data.showEmoji
          },
          () => this._scheduleRelayoutChat()
        );
      };
      wx.onKeyboardHeightChange(this._onKbHeight);
    }

    if (wx.onWindowResize) {
      this._onWinResize = () => this._scheduleRelayoutChat();
      wx.onWindowResize(this._onWinResize);
    }

    this._scheduleRelayoutChat();
    this.loadHistory();
    this.loadPeer();
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    this._scheduleRelayoutChat();
    if (!this.data.connected) {
      this.connectWS();
    }
  },

  onUnload() {
    if (this._onKbHeight) {
      wx.offKeyboardHeightChange(this._onKbHeight);
      this._onKbHeight = null;
    }
    if (this._onWinResize && wx.offWindowResize) {
      wx.offWindowResize(this._onWinResize);
      this._onWinResize = null;
    }
    if (this.socketTask) {
      this.socketTask.close();
    }
  },

  _scheduleRelayoutChat() {
    const run = () => this._relayoutChat();
    wx.nextTick(run);
    setTimeout(run, 50);
    setTimeout(run, 180);
  },

  _relayoutChat() {
    const winH = wxWindowHeight();
    const winW = wxWindowWidth();
    const navH = this.data.navHeight || 0;
    const r = winW / 750;
    const fallbackBar = Math.ceil((12 + 12 + 64) * r) + 8;

    wx.createSelectorQuery()
      .in(this)
      .select('#chat-input-bottom')
      .boundingClientRect()
      .exec((res) => {
        const bottomChrome = res && res[0];
        const inputBarH =
          bottomChrome && bottomChrome.height > 0
            ? bottomChrome.height
            : fallbackBar;
        const kb = this.data.keyboardHeight || 0;
        const shrunk = this.data.kbViewportShrunk;
        const kbLift = kb > 0 && !shrunk ? kb : 0;
        const messagesHeight = Math.max(
          120,
          Math.floor(winH - navH - inputBarH - kbLift)
        );
        if (messagesHeight !== this.data.messagesHeight) {
          this.setData({ messagesHeight }, () => this.scrollToBottom());
        }
      });
  },

  async loadPeer() {
    const { friendId } = this.data;
    if (!friendId) return;
    try {
      const r = await friendApi.getUserProfile(friendId);
      if (r && r.user) {
        const u = r.user;
        const remark = (r.myRemark && String(r.myRemark).trim()) || '';
        const peerTitle = remark || (u.nickName && u.nickName.trim()) || u.username || '聊天';
        this.setData({
          friendAvatar: u.avatarUrl || '',
          friendName: remark || u.nickName || u.username || '',
          navTitle: peerTitle
        });
      }
    } catch (e) {
      console.warn('loadPeer', e);
    }
  },

  toggleExtra() {
    const show = !this.data.showExtra;
    this.setData(
      { showExtra: show, showEmoji: show ? false : this.data.showEmoji },
      () => this._scheduleRelayoutChat()
    );
  },

  _initEmojiPanel() {
    const cat = chatEmoji.getCatalog();
    const first = cat.order[0] || '默认';
    this.setData({
      emojiCategories: cat.order,
      emojiCategoryIndex: 0,
      emojiCurrentList: this._emojiListForCategory(first)
    });
  },

  _emojiListForCategory(category) {
    const cat = chatEmoji.getCatalog();
    const files = (cat.categories && cat.categories[category]) || [];
    return files.map((filename) => {
      const key = chatEmoji.emojiKey(category, filename);
      return {
        key,
        url: chatEmoji.toCloudFileId(key)
      };
    });
  },

  async _setMessagesWithEmoji(rawList) {
    const decorated = this.decorateMessages(rawList);
    const withUrls = await chatEmoji.applyEmojiUrlsToMessages(
      decorated,
      await chatEmoji.resolveEmojiUrls(
        chatEmoji.collectEmojiKeysFromMessages(decorated)
      )
    );
    this.setData({ messages: withUrls });
  },

  decorateMessages(raw) {
    const myId = this.data.myId;
    return (raw || []).map((m, i, arr) => {
      const prev = i > 0 ? arr[i - 1] : null;
      const timeInfo = chatEmoji.formatChatTimeLabel(
        m.createTime,
        prev && prev.createTime
      );
      const recalled = !!m.recalled;
      let bubble = null;
      if (!recalled) {
        bubble = parseBubble(m);
      }
      return {
        ...m,
        recalled,
        recallHint: recalled
          ? String(m.senderId) === String(myId)
            ? '你撤回了一条消息'
            : '对方撤回了一条消息'
          : '',
        showTime: timeInfo.show,
        timeLabel: timeInfo.label,
        bubble
      };
    });
  },

  async loadHistory() {
    const { friendId } = this.data;
    if (!friendId) return;
    try {
      const res = await friendApi.getChatHistory(friendId, { limit: PAGE_SIZE });
      await this._setMessagesWithEmoji(res.list || []);
      this.setData({
        hasMore: !!res.hasMore,
        loadingMore: false
      });
      this.scrollToBottom();
    } catch (e) {
      console.error('加载历史消息失败', e);
    }
  },

  async onLoadMore() {
    if (this.data.loadingMore || !this.data.hasMore || !this.data.messages.length) return;
    const first = this.data.messages[0];
    if (!first || !first.id) return;
    this.setData({ loadingMore: true });
    try {
      const res = await friendApi.getChatHistory(this.data.friendId, {
        beforeId: first.id,
        limit: PAGE_SIZE
      });
      const existingRaw = this.data.messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        content: m.content,
        type: m.type,
        createTime: m.createTime,
        recalled: m.recalled
      }));
      const mergedRaw = [...(res.list || []), ...existingRaw];
      const decorated = this.decorateMessages(mergedRaw);
      const withUrls = await chatEmoji.applyEmojiUrlsToMessages(
        decorated,
        await chatEmoji.resolveEmojiUrls(
          chatEmoji.collectEmojiKeysFromMessages(decorated)
        )
      );
      const anchor = first.id;
      this.setData({
        messages: withUrls,
        hasMore: !!res.hasMore,
        loadingMore: false,
        scrollIntoView: `anchor-${anchor}`
      });
    } catch (e) {
      this.setData({ loadingMore: false });
    }
  },

  connectWS() {
    const token = wx.getStorageSync('token');
    if (!token) {
      console.log('未登录，无法连接WebSocket');
      return;
    }

    wx.cloud.connectContainer({
      env: CLOUD_ENV,
      service: CLOUD_SERVICE,
      path: `/ws?token=${encodeURIComponent(token)}`,
      success: (res) => {
        this.socketTask = res.socketTask;

        this.socketTask.onOpen(() => {
          this.setData({ connected: true });
        });

        this.socketTask.onMessage((res) => {
          try {
            const data = JSON.parse(res.data);
            const fid = String(this.data.friendId || '');
            if (data.type === 'recall' && data.data) {
              this._applyRecallPatch(data.data.id);
              return;
            }
            if (
              data.type === 'message' &&
              data.data &&
              String(data.data.senderId) === fid
            ) {
              this._appendIncomingMessage(data.data);
            }
          } catch (e) {
            console.error('解析消息失败', e);
          }
        });

        this.socketTask.onClose(() => {
          this.setData({ connected: false });
        });

        this.socketTask.onError((res) => {
          console.error('WebSocket 错误', res);
        });
      },
      fail: (err) => {
        console.error('WebSocket 连接失败', err);
      }
    });
  },

  async _appendIncomingMessage(row) {
    const merged = [...this.data.messages, row];
    const decorated = this.decorateMessages(merged);
    const withUrls = await chatEmoji.applyEmojiUrlsToMessages(
      decorated,
      await chatEmoji.resolveEmojiUrls(
        chatEmoji.collectEmojiKeysFromMessages(decorated)
      )
    );
    this.setData({ messages: withUrls });
    this.scrollToBottom();
  },

  _applyRecallPatch(messageId) {
    const raw = this.data.messages.map((m) =>
      m.id === messageId ? { ...m, recalled: true } : m
    );
    this.setData({ messages: this.decorateMessages(raw) });
  },

  _ensureChatEditorContext() {
    if (this._chatEditorCtx) {
      return Promise.resolve(this._chatEditorCtx);
    }
    return new Promise((resolve) => {
      const finish = (ctx) => {
        if (ctx) this._chatEditorCtx = ctx;
        resolve(this._chatEditorCtx || null);
      };
      wx.createSelectorQuery()
        .in(this)
        .select('#chatComposeEditor')
        .context((res) => {
          finish((res && res.context) || null);
        })
        .exec();
    });
  },

  onChatEditorReady() {
    this._ensureChatEditorContext();
  },

  onEditorInput(e) {
    const detail = (e && e.detail) || {};
    const hasContent = !chatComposeEditor.isComposeEmpty(detail);
    const prev = this.data.composeHasContent;
    this.setData({ composeHasContent: hasContent });
    // When content appears, hide the extra panel since + is being replaced by send
    if (hasContent && !prev && this.data.showExtra) {
      this.setData({ showExtra: false }, () => this._scheduleRelayoutChat());
    }
  },

  onEditorFocus() {
    const changes = {};
    if (this.data.showExtra) changes.showExtra = false;
    if (this.data.showEmoji) changes.showEmoji = false;
    if (Object.keys(changes).length) {
      this.setData(changes, () => this._scheduleRelayoutChat());
    }
  },

  onEditorBlur() {},

  toggleEmoji() {
    const show = !this.data.showEmoji;
    this.setData(
      {
        showEmoji: show,
        showExtra: show ? false : this.data.showExtra
      },
      () => {
        this._scheduleRelayoutChat();
        // Opening emoji panel: dismiss soft keyboard
        if (show) {
          this._ensureChatEditorContext().then((ctx) => {
            if (ctx && typeof ctx.blur === 'function') ctx.blur();
          });
        }
      }
    );
  },

  onEmojiCategoryTap(e) {
    const index = Number(e.currentTarget.dataset.index);
    const category = this.data.emojiCategories[index];
    if (!category) return;
    this.setData({
      emojiCategoryIndex: index,
      emojiCurrentList: this._emojiListForCategory(category)
    });
  },

  onEmojiPick(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;
    this._ensureChatEditorContext().then((ctx) => {
      if (!ctx || typeof ctx.insertImage !== 'function') {
        wx.showToast({ title: '编辑器未就绪', icon: 'none' });
        return;
      }
      ctx.insertImage(chatComposeEditor.insertEmojiOptions(key));
      this.setData({ composeHasContent: true });
    });
  },

  async send() {
    const { friendId } = this.data;
    if (!friendId) return;

    const ctx = await this._ensureChatEditorContext();
    if (!ctx || typeof ctx.getContents !== 'function') return;

    ctx.getContents({
      success: async (res) => {
        const content = chatComposeEditor.deltaToContent(res).trim();
        if (!content) return;
        try {
          this._sending = true;
          const apiRes = await friendApi.sendMessage(friendId, content, 'text');
          const row = {
            id: apiRes.id,
            senderId: this.data.myId,
            content,
            type: 'text',
            createTime: apiRes.createTime,
            recalled: false
          };
          chatComposeEditor.clearEditor(ctx);
          this.setData({ composeHasContent: false });
          await this._appendIncomingMessage(row);
          // Brief guard: ignore keyboard-close events from setContents blur
          setTimeout(() => { this._sending = false; }, 300);
        } catch (err) {
          this._sending = false;
          wx.showToast({
            title: (err && err.message) || '发送失败',
            icon: 'none'
          });
        }
      }
    });
  },

  onBubbleLongPress(e) {
    const msg = e.currentTarget.dataset.msg;
    if (!msg || msg.recalled) return;
    if (String(msg.senderId) !== String(this.data.myId)) return;
    const age = Date.now() - new Date(msg.createTime).getTime();
    if (age > 2 * 60 * 1000) return;
    wx.showActionSheet({
      itemList: ['撤回'],
      success: (res) => {
        if (res.tapIndex === 0) this.recallMessage(msg);
      }
    });
  },

  async recallMessage(msg) {
    if (!msg || !msg.id) return;
    try {
      await friendApi.recallMessage(msg.id);
      this._applyRecallPatch(msg.id);
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '撤回失败', icon: 'none' });
    }
  },

  async pickExtraImage() {
    this.setData({ showExtra: false }, () => this._scheduleRelayoutChat());
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: async (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f || !f.tempFilePath) return;
        showLoading('发送中');
        try {
          let url = f.tempFilePath;
          if (cloudStorage.cloudReady()) {
            const uid = this.data.myId;
            url = await cloudStorage.uploadLocalImage(
              f.tempFilePath,
              `chat/${uid}/${Date.now()}.jpg`,
              { compressQuality: 78 }
            );
          }
          const r = await friendApi.sendMessage(this.data.friendId, url, 'image');
          const row = {
            id: r.id,
            senderId: this.data.myId,
            content: url,
            type: 'image',
            createTime: r.createTime,
            recalled: false
          };
          await this._appendIncomingMessage(row);
        } catch (err) {
          showError((err && err.message) || '发送失败');
        } finally {
          hideLoading();
        }
      }
    });
  },

  pickExtraAttach() {
    this.setData({ showExtra: false }, () => this._scheduleRelayoutChat());
    if (!wx.chooseMessageFile) {
      showError('当前版本不支持附件');
      return;
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: async (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f) return;
        const name = f.name || '附件';
        const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] || 'bin';
        showLoading('上传中');
        try {
          let fidUrl = f.path;
          if (cloudStorage.cloudReady()) {
            const uid = this.data.myId;
            fidUrl = await cloudStorage.migrateAttachmentUrlToCloudIfNeeded(
              f.path,
              `chat/${uid}/att_${Date.now()}.${ext}`
            );
          }
          const payload = JSON.stringify({
            kind: 'attach',
            url: fidUrl,
            name
          });
          const r = await friendApi.sendMessage(this.data.friendId, payload, 'attachment');
          const row = {
            id: r.id,
            senderId: this.data.myId,
            content: payload,
            type: 'attachment',
            createTime: r.createTime,
            recalled: false
          };
          await this._appendIncomingMessage(row);
        } catch (err) {
          showError((err && err.message) || '发送失败');
        } finally {
          hideLoading();
        }
      }
    });
  },

  pickExtraLocation() {
    this.setData({ showExtra: false }, () => this._scheduleRelayoutChat());
    wx.chooseLocation({
      success: async (res) => {
        const payload = JSON.stringify({
          kind: 'location',
          lat: res.latitude,
          lng: res.longitude,
          name: res.name || '',
          address: res.address || ''
        });
        try {
          const r = await friendApi.sendMessage(this.data.friendId, payload, 'location');
          const row = {
            id: r.id,
            senderId: this.data.myId,
            content: payload,
            type: 'location',
            createTime: r.createTime,
            recalled: false
          };
          await this._appendIncomingMessage(row);
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '发送失败', icon: 'none' });
        }
      }
    });
  },

  onBubbleTap(e) {
    const msg = e.currentTarget.dataset.msg;
    if (!msg || !msg.bubble) return;
    const b = msg.bubble;
    if (b.kind === 'image' && b.url) {
      wx.previewImage({ urls: [b.url], current: b.url });
      return;
    }
    if (b.kind === 'attachment' && b.url) {
      this.previewAttachment(b.url);
      return;
    }
    if (b.kind === 'location') {
      wx.openLocation({
        latitude: b.lat,
        longitude: b.lng,
        name: b.name || '位置',
        address: b.address || ''
      });
    }
  },

  previewAttachment(url) {
    const raw = String(url || '').trim();
    const done = () => hideLoading();
    if (cloudStorage.isCloudFileId(raw)) {
      showLoading('打开中');
      cloudStorage
        .downloadNoteAttachmentToTempPath(raw)
        .then((p) => {
          done();
          wx.openDocument({
            filePath: p,
            showMenu: true,
            fail: () => showError('无法预览')
          });
        })
        .catch((e) => {
          done();
          showError((e && e.message) || '打开失败');
        });
      return;
    }
    showLoading('打开中');
    wx.downloadFile({
      url: raw,
      success: (r) => {
        done();
        if (r.statusCode === 200 && r.tempFilePath) {
          wx.openDocument({
            filePath: r.tempFilePath,
            showMenu: true,
            fail: () => showError('无法预览')
          });
        } else showError('下载失败');
      },
      fail: () => {
        done();
        showError('下载失败');
      }
    });
  },

  onAvatarTap(e) {
    const senderId = e.currentTarget.dataset.senderId;
    if (!senderId) return;
    if (String(senderId) === String(this.data.myId)) {
      wx.navigateTo({ url: '/packageFriend/home/home' });
    } else {
      wx.navigateTo({ url: `/packageFriend/home/home?id=${senderId}` });
    }
  },

  scrollToBottom() {
    setTimeout(() => {
      this.setData({ scrollIntoView: '', scrollTop: this.data.messages.length * 9999 });
    }, 80);
  }
});
