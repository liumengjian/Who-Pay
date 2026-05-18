const friendApi = require('../../service/friend.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

Page({
  data: {
    targetId: '',
    isSelf: false,
    relation: 'none',
    user: {},
    profileBgUrl: '',
    myRemarkDisplay: '',
    myRemarkRaw: '',
    albumList: [],
    showFriendMenu: false,
    showApplyModal: false,
    applyRemark: '',
    applyVerify: '',
    showRemarkModal: false,
    remarkDraft: '',
    navHeight: 100,
  },

  onLoad(options) {
    this.setData({ navHeight: getNavTotalHeight() });
    const app = getApp();
    const me = wx.getStorageSync('userInfo') || app.globalData.userInfo || {};
    const myId = String(me.id != null ? me.id : '');
    let targetId = options.id != null ? String(options.id) : myId;
    if (!targetId) {
      wx.showToast({ title: '缺少用户', icon: 'none' });
      return;
    }
    const isSelf = targetId === myId;
    this._myId = myId;
    this.setData({ targetId, isSelf });
    this.loadProfile();
  },

  onShow() {
    if (this.data.targetId) this.loadProfile();
  },

  async loadProfile() {
    const { targetId } = this.data;
    if (!targetId) return;
    try {
      const res = await friendApi.getUserProfile(targetId);
      const user = res.user || {};
      const albumList = Array.isArray(user.albumUrls) ? user.albumUrls : [];
      const profileBgUrl = String(user.profileBackground || '').trim();
      const relation = res.relation || 'none';
      const myRemarkRaw = res.myRemark != null ? String(res.myRemark).trim() : '';
      const myRemarkDisplay =
        !this.data.isSelf && relation === 'friend' && myRemarkRaw ? myRemarkRaw : '';
      this.setData({
        user,
        albumList,
        relation,
        myRemarkDisplay,
        myRemarkRaw,
        profileBgUrl
      });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: (e && e.message) || '加载失败', icon: 'none' });
    }
  },

  goEdit() {
    if (this.data.isSelf) {
      wx.navigateTo({ url: '/packageFriend/edit/edit' });
    }
  },

  onAvatarTap() {
    if (this.data.isSelf) {
      this.goEdit();
    }
  },

  toggleFriendMenu() {
    this.setData({ showFriendMenu: !this.data.showFriendMenu });
  },

  closeFriendMenu() {
    this.setData({ showFriendMenu: false });
  },

  noop() {},

  async onClearChat() {
    this.closeFriendMenu();
    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '删除聊天记录',
        content: '将删除你与对方的全部聊天记录，是否继续？',
        success: (r) => resolve(!!r.confirm)
      });
    });
    if (!ok) return;
    try {
      await friendApi.clearChatWithFriend(this.data.targetId);
      wx.showToast({ title: '已清空' });
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
    }
  },

  onOpenRemarkEdit() {
    this.closeFriendMenu();
    this.setData({
      showRemarkModal: true,
      remarkDraft: this.data.myRemarkRaw || ''
    });
  },

  closeRemarkModal() {
    this.setData({ showRemarkModal: false });
  },

  onRemarkDraft(e) {
    this.setData({ remarkDraft: e.detail.value });
  },

  async saveRemark() {
    try {
      await friendApi.updateFriendRemark(this.data.targetId, this.data.remarkDraft.trim());
      wx.showToast({ title: '已保存' });
      this.setData({ showRemarkModal: false });
      this.loadProfile();
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
    }
  },

  goChat() {
    const u = this.data.user;
    wx.navigateTo({
      url: `/packageChat/detail/detail?friendId=${this.data.targetId}&nickName=${encodeURIComponent(
        u.nickName || u.username || ''
      )}`
    });
  },

  async onRemoveFriend() {
    const ok = await new Promise((resolve) => {
      wx.showModal({
        title: '删除好友',
        content: '删除后双方好友列表都不再显示对方，确定删除？',
        success: (r) => resolve(!!r.confirm)
      });
    });
    if (!ok) return;
    try {
      await friendApi.removeFriend(this.data.targetId);
      wx.showToast({ title: '已删除' });
      setTimeout(() => wx.navigateBack(), 400);
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
    }
  },

  openApplyModal() {
    this.setData({ showApplyModal: true, applyRemark: '', applyVerify: '' });
  },

  closeApplyModal() {
    this.setData({ showApplyModal: false });
  },

  onApplyRemark(e) {
    this.setData({ applyRemark: e.detail.value });
  },

  onApplyVerify(e) {
    this.setData({ applyVerify: e.detail.value });
  },

  async submitApply() {
    try {
      await friendApi.addFriend(this.data.targetId, {
        remark: this.data.applyRemark.trim(),
        verifyMessage: this.data.applyVerify.trim()
      });
      wx.showToast({ title: '已发送' });
      this.setData({ showApplyModal: false });
      this.loadProfile();
    } catch (e) {
      wx.showToast({ title: (e && e.message) || '失败', icon: 'none' });
    }
  },

  goNotifications() {
    wx.navigateTo({ url: '/packageNotification/index/index' });
  },

  previewAlbum(e) {
    const url = e.currentTarget.dataset.url;
    const urls = this.data.albumList;
    if (!url || !urls.length) return;
    wx.previewImage({ current: url, urls });
  }
});
