// pages/activity/index.js
const {
  createActivity,
  joinActivity,
  getMyActivities,
  getActivityHall,
  getActivityPreview,
  getActivityDetail,
  applyForJoin,
  getFriendList,
  inviteFriendsToActivity
} = require('../../utils/cloud.js');
const cloudStorage = require('../../utils/cloudStorage.js');
const {
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  validateInviteCode,
  filePathToBase64Compressed,
  formatAmount
} = require('../../utils/util.js');
const noteStore = require('../../utils/activityNoteStorage.js');
const {
  dispatchActivityNoteMpHtmlLinkTap,
  inferWxOpenDocumentFileType,
  invokeOpenDocumentWithRetry
} = require('../../utils/activityNoteLinks.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');
const { ENABLE_SOCIAL } = require('../../service/config.js');

const HALL_PAGE_SIZE = 20;
/** 与 showTabBar 动画、page-container duration 对齐，底部创建条在 tab 露完后再复位 */
const TABBAR_TRANSITION_MS = 320;

Page({
  data: {
    userInfo: {},
    mainTab: 'hall',
    mainTabIndex: 0,
    hallActivities: [],
    hallDisplayList: [],
    hallSearchKeyword: '',
    hallPageOffset: 0,
    hallHasMore: true,
    hallLoadingMore: false,
    hallSearching: false,
    hallSearchPageOffset: 0,
    hallSearchHasMore: true,
    myActivities: [],
    showCreate: false,
    showHallDetail: false,
    hallPreview: null,
    hallActivityId: '',
    hallActivityName: '',
    hallActivityJoined: false,
    hallApplicationSent: false,
    activityName: '',
    activitySlogan: '',
    activityAvatarUrl: '',
    activityAvatarTempPath: '',
    hallInviteInput: '',
    loadingHallPreview: false,
    showInviteFriends: false,
    inviteFriendList: [],
    inviteFriendLoading: false,
    invitedCount: 0,
    triggered: false,
    navHeight: 0,
    showFloatNotesPanel: false,
    actionBarAwaitTabBarShow: false,
    floatNotesPageContainerStyle: '',
    floatNotesLoading: false,
    floatNoteCards: [],
    floatNoteMpTagStyle: {
      p: 'margin:0 0 22rpx 0;',
      a: 'text-decoration:none;-webkit-tap-highlight-color:transparent;',
      img: noteStore.NOTE_IMG_HTML_STYLE
    },
    enableSocial: ENABLE_SOCIAL
  },

  onLoad() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.checkLogin();
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    /* 确保底部 tabBar 可见（曾被 hideTabBar 卡住的会话可恢复） */
    if (!this.data.showFloatNotesPanel) {
      if (this._actionBarTabTimer) {
        clearTimeout(this._actionBarTabTimer);
        this._actionBarTabTimer = null;
      }
      this.setData({ actionBarAwaitTabBarShow: false });
      try {
        if (typeof wx.showTabBar === 'function') {
          wx.showTabBar({ animation: false });
        }
      } catch (e) {}
    }
    if (wx.getStorageSync('token')) {
      const app = getApp();
      const userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo || {};
      this.setData({ userInfo });
      this.refreshAll();
    }
  },

  onRefresh() {
    this.refreshAll().finally(() => {
      this.setData({ triggered: false });
    });
  },

  onShareAppMessage() {
    return {
      title: 'Who Pay - 让AA分摊更简单',
      path: '/pages/activity/index'
    };
  },

  checkLogin() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }

    const app = getApp();
    const userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo || {};
    this.setData({
      userInfo: userInfo
    });

    this.refreshAll();
  },

  switchTabHall() {
    this.setData({ mainTab: 'hall', mainTabIndex: 0 });
  },

  switchTabMine() {
    this.setData({ mainTab: 'mine', mainTabIndex: 1 });
  },

  onMainTabSwiperChange(e) {
    const cur = e.detail.current;
    const tab = cur === 0 ? 'hall' : 'mine';
    this.setData({ mainTabIndex: cur, mainTab: tab });
  },

  async refreshAll() {
    await Promise.all([this.loadHall(), this.loadMyActivities()]);
  },

  /** 输入搜索关键词时触发后端搜索（防抖 300ms） */
  onHallSearchInput(e) {
    const keyword = (e.detail.value || '').trim();
    this.setData({ hallSearchKeyword: keyword });
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
    }
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null;
      this._doSearch();
    }, 300);
  },

  _doSearch() {
    const kw = this.data.hallSearchKeyword;
    if (kw) {
      this.loadHall(true, kw);
    } else {
      this.loadHall(true);
    }
  },

  async loadHall(reset = true, searchKeyword) {
    const isSearch = typeof searchKeyword === 'string' && searchKeyword.length > 0;

    // 非搜索场景的节流
    if (!isSearch && !reset) {
      if (!this.data.hallHasMore || this.data.hallLoadingMore) return;
      if ((this.data.hallActivities || []).length === 0) return;
    }

    if (reset) {
      this.setData({ hallHasMore: true, hallSearchHasMore: true });
    }

    let offset = 0;
    if (!reset) {
      offset = isSearch ? this.data.hallSearchPageOffset : this.data.hallPageOffset;
    }
    const loadKey = isSearch ? 'hallSearching' : 'hallLoadingMore';
    if (!reset) {
      this.setData({ [loadKey]: true });
    }

    const params = { offset, limit: HALL_PAGE_SIZE };
    if (isSearch) {
      params.name = searchKeyword;
    }

    try {
      const result = await getActivityHall(params);
      const batch = result.activities || [];
      const hasMore =
        typeof result.hasMore === 'boolean'
          ? result.hasMore
          : batch.length >= HALL_PAGE_SIZE;
      if (isSearch) {
        const merged = reset
          ? batch
          : (this.data.hallDisplayList || []).concat(batch);
        this.setData({
          hallDisplayList: merged,
          hallSearchPageOffset: offset + batch.length,
          hallSearchHasMore: hasMore
        });
      } else {
        const merged = reset
          ? batch
          : (this.data.hallActivities || []).concat(batch);
        // 同步显示列表
        const kw = (this.data.hallSearchKeyword || '').trim().toLowerCase();
        const displayList = !kw ? merged : merged.filter((a) => (a.name || '').toLowerCase().includes(kw));
        this.setData(
          {
            hallActivities: merged,
            hallDisplayList: displayList,
            hallPageOffset: offset + batch.length,
            hallHasMore: hasMore,
            ...(reset ? { hallSearchKeyword: '' } : {})
          }
        );
      }
    } catch (error) {
      console.error('加载活动大厅失败:', error);
      showError(error.message || '加载大厅失败');
    } finally {
      if (!reset) {
        this.setData({ [loadKey]: false });
      }
    }
  },

  onShareAppMessage() {
    return {
      title: 'Who Pay - 让AA分摊更简单',
      path: '/pages/activity/index'
    };
  },

  onHallScrollToLower() {
    if (this.data.mainTab !== 'hall') return;
    const kw = this.data.hallSearchKeyword;
    if (kw) {
      this.loadHall(false, kw);
    } else {
      this.loadHall(false);
    }
  },

  async loadMyActivities() {
    try {
      const result = await getMyActivities('active');
      this.setData({
        myActivities: result.activities || []
      });
    } catch (error) {
      console.error('加载我的活动失败:', error);
    }
  },

  isJoinedActivity(activityId) {
    const id = String(activityId);
    return (this.data.myActivities || []).some((a) => String(a._id) === id);
  },

  goToDetail(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/packageActivity/detail/detail?id=${activityId}`
    });
  },

  showCreateModal() {
    const ui = this.data.userInfo || {};
    const defAvatar = ui.avatarUrl || '/images/default-avatar.png';
    this._pendingInviteFriends = null;
    this.setData({
      showCreate: true,
      activityName: '',
      activitySlogan: '',
      activityAvatarUrl: defAvatar,
      activityAvatarTempPath: '',
      inviteFriendList: [],
      invitedCount: 0
    });
  },

  hideCreateModal() {
    this._pendingInviteFriends = null;
    this.setData({
      showCreate: false,
      inviteFriendList: [],
      invitedCount: 0
    });
  },

  hideHallDetailModal() {
    this.setData({
      showHallDetail: false,
      hallPreview: null,
      hallActivityId: '',
      hallActivityName: '',
      hallInviteInput: ''
    });
  },

  stopPropagation() {},
  preventTouchMove() {},

  goHallMemberProfile(e) {
    const uid = e.currentTarget.dataset.uid;
    if (!uid) return;
    wx.navigateTo({ url: `/packageFriend/home/home?id=${uid}` });
  },

  _applyFloatNoteFromDetail(an) {
    const raw = an || {};
    const content = noteStore.ensureChipStylesInNoteHtml(
      raw.content != null ? String(raw.content) : ''
    );
    const linkMap = noteStore.normalizeLinkMapForClient(raw.linkMap || {});
    const preview = noteStore.notePreviewFromContent(content, linkMap);
    return {
      linkMap,
      noteContent: content,
      noteHasPreview: preview.activityNoteHasPreview
    };
  },

  _getFloatNotesPageContainerStyle() {
    try {
      const win =
        typeof wx.getWindowInfo === 'function'
          ? wx.getWindowInfo()
          : wx.getSystemInfoSync();
      const w = win.windowWidth || win.screenWidth || 375;
      const h = win.windowHeight || win.screenHeight || 667;
      const pw = Math.round(w * 0.88);
      const ph = Math.round(h * 0.9);
      const left = Math.round((w - pw) / 2);
      const top = Math.round((h - ph) / 2);
      /* center + 百分比在真机易偏位；像素定位居中；弹出层默认灰底去掉 */
      return `width:${pw}px;height:${ph}px;left:${left}px;top:${top}px;background-color:transparent;background:transparent;box-sizing:border-box;`;
    } catch (e) {
      return 'width:88%;height:90%;left:0;right:0;top:0;bottom:0;margin:auto;background-color:transparent;background:transparent;box-sizing:border-box;';
    }
  },

  openFloatNotesPanel() {
    const buildCards = (activities) =>
      (activities || []).map((a) => ({
        id: String(a._id),
        name: a.name || '未命名活动',
        avatarUrl: a.avatarUrl || '/images/default-avatar.png',
        totalAmount: '…',
        expanded: false,
        detailLoaded: false,
        detailError: false,
        noteHasPreview: false,
        noteContentForHtml: ''
      }));

    const list = this.data.myActivities || [];
    const cards = buildCards(list);
    this._floatNoteLinkMaps = Object.create(null);
    try {
      if (typeof wx.hideTabBar === 'function') {
        wx.hideTabBar({ animation: true });
      }
    } catch (e) {}
    if (this._actionBarTabTimer) {
      clearTimeout(this._actionBarTabTimer);
      this._actionBarTabTimer = null;
    }
    this.setData({
      showFloatNotesPanel: true,
      actionBarAwaitTabBarShow: false,
      floatNoteCards: cards,
      floatNotesLoading: cards.length > 0 || !list.length,
      floatNotesPageContainerStyle: this._getFloatNotesPageContainerStyle()
    });
    if (cards.length) {
      this._fetchFloatNoteCardDetails(cards);
    }

    this.loadMyActivities()
      .then(() => {
        if (!this.data.showFloatNotesPanel) return;
        const fresh = this.data.myActivities || [];
        const newCards = buildCards(fresh);
        const prev = this.data.floatNoteCards || [];
        const same =
          newCards.length === prev.length &&
          newCards.every((c, i) => c.id === (prev[i] && prev[i].id));
        if (same) {
          if (!newCards.length) {
            this.setData({ floatNotesLoading: false });
          }
          return;
        }
        this._floatNoteLinkMaps = Object.create(null);
        this.setData({
          floatNoteCards: newCards,
          floatNotesLoading: newCards.length > 0
        });
        if (!newCards.length) {
          this.setData({ floatNotesLoading: false });
          return;
        }
        this._fetchFloatNoteCardDetails(newCards);
      })
      .catch(() => {
        if (!this.data.showFloatNotesPanel) return;
        if (!(this.data.floatNoteCards || []).length) {
          this.setData({ floatNotesLoading: false });
        }
      });
  },

  closeFloatNotesPanel() {
    if (!this.data.showFloatNotesPanel) return;
    this.setData({
      showFloatNotesPanel: false,
      actionBarAwaitTabBarShow: true
    });
  },

  onFloatNotesPageContainerAfterLeave() {
    this.setData({
      showFloatNotesPanel: false,
      floatNoteCards: [],
      floatNotesLoading: false,
      actionBarAwaitTabBarShow: true
    });
    try {
      if (typeof wx.showTabBar === 'function') {
        wx.showTabBar({ animation: true });
      }
    } catch (e) {}
    if (this._actionBarTabTimer) {
      clearTimeout(this._actionBarTabTimer);
      this._actionBarTabTimer = null;
    }
    this._actionBarTabTimer = setTimeout(() => {
      this._actionBarTabTimer = null;
      this.setData({ actionBarAwaitTabBarShow: false });
    }, TABBAR_TRANSITION_MS);
  },

  async _fetchFloatNoteCardDetails(cards) {
    const results = await Promise.all(
      cards.map(async (c) => {
        try {
          const result = await getActivityDetail(c.id);
          const total = formatAmount(parseFloat(result.totalAmount || 0));
          const note = this._applyFloatNoteFromDetail(result.activityNote);
          return {
            id: c.id,
            ok: true,
            totalAmount: total,
            noteHasPreview: note.noteHasPreview,
            noteContentForHtml: note.noteContent,
            linkMap: note.linkMap
          };
        } catch (e) {
          console.warn('[float-notes] detail', c.id, e);
          return { id: c.id, ok: false };
        }
      })
    );
    const idToRes = {};
    results.forEach((r) => {
      idToRes[r.id] = r;
    });
    const linkMaps = Object.create(null);
    const next = (this.data.floatNoteCards || []).map((row) => {
      const r = idToRes[row.id];
      if (!r || !r.ok) {
        linkMaps[row.id] = {};
        return {
          ...row,
          totalAmount: '--',
          detailLoaded: true,
          detailError: true,
          noteHasPreview: false,
          noteContentForHtml: ''
        };
      }
      linkMaps[row.id] = r.linkMap || {};
      return {
        ...row,
        totalAmount: r.totalAmount,
        detailLoaded: true,
        detailError: false,
        noteHasPreview: r.noteHasPreview,
        noteContentForHtml: r.noteContentForHtml || ''
      };
    });
    this._floatNoteLinkMaps = linkMaps;
    this.setData({ floatNoteCards: next, floatNotesLoading: false });
  },

  toggleFloatNoteCard(e) {
    const id = String(e.currentTarget.dataset.id || '');
    if (!id) return;
    const cards = (this.data.floatNoteCards || []).map((c) =>
      c.id === id ? { ...c, expanded: !c.expanded } : c
    );
    this.setData({ floatNoteCards: cards });
  },

  onFloatNoteLinkTap(e) {
    let aid = String((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.aid) || '');
    if (!aid) {
      const expanded = (this.data.floatNoteCards || []).filter((c) => c.expanded);
      if (expanded.length === 1) aid = String(expanded[0].id);
    }
    if (!aid) return;
    dispatchActivityNoteMpHtmlLinkTap(e, {
      showError,
      openNoteAttachment: (params) => this._openFloatNoteAttachmentFromParams(params),
      linkMap: this._floatNoteLinkMaps[aid] || {},
      noteBlocksForLocResolve: []
    });
  },

  async _openFloatNoteAttachmentFromParams(params) {
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

  onFloatNoteImgTap(e) {
    let aid = String((e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.aid) || '');
    if (!aid) {
      const expanded = (this.data.floatNoteCards || []).filter((c) => c.expanded);
      if (expanded.length === 1) aid = String(expanded[0].id);
    }
    const src = (e.detail && e.detail.src) || '';
    if (!src || !aid) return;
    const card = (this.data.floatNoteCards || []).find((c) => String(c.id) === aid);
    const html = (card && card.noteContentForHtml) || '';
    const urls = noteStore.extractImageUrlsFromHtml(html);
    wx.previewImage({
      current: src,
      urls: urls.length ? urls : [src]
    });
  },

  async onOpenHallActivity(e) {
    const activityId = String(e.currentTarget.dataset.id);
    const name = e.currentTarget.dataset.name || '';
    const joined = this.isJoinedActivity(activityId);
    if (joined) {
      wx.navigateTo({
        url: `/packageActivity/detail/detail?id=${activityId}`
      });
      return;
    }
    this.setData({
      showHallDetail: true,
      hallActivityId: activityId,
      hallActivityName: name,
      hallActivityJoined: joined,
      hallApplicationSent: false,
      hallInviteInput: '',
      hallPreview: null,
      loadingHallPreview: true
    });
    try {
      const preview = await getActivityPreview(activityId);
      this.setData({
        hallPreview: preview,
        loadingHallPreview: false
      });
    } catch (err) {
      console.error(err);
      this.setData({ loadingHallPreview: false });
      showError(err.message || '加载活动详情失败');
    }
  },

  goHallToDetail() {
    const id = this.data.hallActivityId;
    if (!id) return;
    this.hideHallDetailModal();
    wx.navigateTo({
      url: `/packageActivity/detail/detail?id=${id}`
    });
  },

  onHallInviteInput(e) {
    let value = e.detail.value.toUpperCase();
    value = value.replace(/[^A-Z0-9]/g, '');
    this.setData({
      hallInviteInput: value
    });
  },

  async handleHallJoinActivity() {
    const code = this.data.hallInviteInput;
    const err = validateInviteCode(code);
    if (err) {
      showError(err);
      return;
    }
    showLoading('加入中...');
    try {
      const result = await joinActivity(code);
      hideLoading();
      this.hideHallDetailModal();
      if (result.activityId) {
        wx.navigateTo({
          url: `/packageActivity/detail/detail?id=${result.activityId}&needSelectTeam=true`
        });
      } else {
        showSuccess('加入成功');
        this.refreshAll();
      }
    } catch (error) {
      hideLoading();
      showError(error.message || '加入失败');
    }
  },

  async handleHallApplyActivity() {
    const activityId = this.data.hallActivityId;
    if (!activityId) return;
    showLoading('申请中...');
    try {
      await applyForJoin(activityId, 'activity', null);
      hideLoading();
      showSuccess('申请已发送，请等待审批');
      this.setData({ hallApplicationSent: true });
    } catch (error) {
      hideLoading();
      showError(error.message || '申请失败');
    }
  },

  onActivityNameInput(e) {
    this.setData({
      activityName: e.detail.value
    });
  },

  onActivitySloganInput(e) {
    this.setData({
      activitySlogan: e.detail.value
    });
  },

  onChooseActivityAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      activityAvatarUrl: avatarUrl,
      activityAvatarTempPath: avatarUrl
    });
  },

  async handleCreate() {
    const { activityName, activitySlogan, activityAvatarTempPath } = this.data;
    if (!activityName || activityName.trim() === '') {
      showError('请输入活动名称');
      return;
    }

    showLoading('创建中...');
    try {
      const payload = {
        name: activityName.trim(),
        slogan: (activitySlogan || '').trim()
      };
      if (activityAvatarTempPath) {
        try {
          if (cloudStorage.cloudReady()) {
            payload.avatar = await cloudStorage.uploadLocalImage(
              activityAvatarTempPath,
              `activities/new/cover_${Date.now()}.jpg`,
              { compressQuality: 78 }
            );
          } else {
            payload.avatar = await filePathToBase64Compressed(activityAvatarTempPath);
          }
        } catch (err) {
          console.warn('活动头像上传失败，尝试 base64:', err);
          try {
            payload.avatar = await filePathToBase64Compressed(activityAvatarTempPath);
          } catch (e2) {
            console.warn('活动头像读取失败:', e2);
          }
        }
      }
      const result = await createActivity(payload);
      hideLoading();
      const invite = result.inviteCode ? `，邀请码 ${result.inviteCode}` : '';

      // 邀请已选好友
      if (ENABLE_SOCIAL) {
        const selectedFriends = this._pendingInviteFriends || [];
        if (selectedFriends.length > 0 && result.activityId) {
          const friendIds = selectedFriends.map((f) => String(f.id));
          this._pendingInviteFriends = null;
          try {
            const invRes = await inviteFriendsToActivity(result.activityId, friendIds);
            const added = invRes.added || 0;
            const friendMsg = added > 0 ? `，已邀请 ${added} 位好友` : '';
            showSuccess(`创建成功${invite}${friendMsg}`);
          } catch (invErr) {
            console.warn('邀请好友失败:', invErr);
            showSuccess(`创建成功${invite}，好友邀请失败`);
          }
        } else {
          showSuccess(`创建成功${invite}`);
        }
      } else {
        showSuccess(`创建成功${invite}`);
      }

      this.hideCreateModal();

      if (result.activityId) {
        wx.navigateTo({
          url: `/packageActivity/detail/detail?id=${result.activityId}&needSelectTeam=true`
        });
      } else {
        this.refreshAll();
      }
    } catch (error) {
      hideLoading();
      console.error('创建活动失败:', error);
      showError(error.message || '创建失败');
    }
  },

  async openInviteFriendsModal() {
    if (!ENABLE_SOCIAL) return;
    const previous = this._pendingInviteFriends || [];
    const prevIds = new Set(previous.map((f) => String(f.id)));
    this.setData({ showInviteFriends: true, inviteFriendLoading: true });
    try {
      const res = await getFriendList();
      const list = (res.list || []).map((f) => ({
        ...f,
        _selected: prevIds.has(String(f.id))
      }));
      const count = list.filter((f) => f._selected).length;
      this.setData({ inviteFriendList: list, inviteFriendLoading: false, invitedCount: count });
    } catch (e) {
      console.error('加载好友列表失败:', e);
      this.setData({ inviteFriendLoading: false });
      showError('加载好友列表失败');
    }
  },

  toggleInviteFriend(e) {
    const uid = e.currentTarget.dataset.uid;
    const list = this.data.inviteFriendList.map((f) =>
      String(f.id) === String(uid) ? { ...f, _selected: !f._selected } : f
    );
    const count = list.filter((f) => f._selected).length;
    this.setData({ inviteFriendList: list, invitedCount: count });
  },

  hideInviteFriendsModal() {
    this.setData({ showInviteFriends: false });
  },

  confirmInviteFriends() {
    const selected = this.data.inviteFriendList.filter((f) => f._selected);
    if (selected.length === 0) {
      showError('请选择至少一位好友');
      return;
    }
    // 保存已选好友，关闭弹窗，保留计数
    this._pendingInviteFriends = selected;
    this.setData({
      showInviteFriends: false,
      invitedCount: selected.length
    });
  }
});
