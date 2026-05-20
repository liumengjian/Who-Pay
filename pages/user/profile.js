// pages/user/profile.js
const {
  updateUserInfo,
  getNotificationBadgeCount,
  getUnreadCount
} = require('../../utils/cloud.js');
const cloudStorage = require('../../utils/cloudStorage.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');
const { ADMIN_USERNAME } = require('../../utils/constants.js');

Page({
  data: {
    userInfo: {},
    profileBgUrl: '',
    triggered: false,
    navHeight: 0,
    isAdminUser: false,
    notificationBadgeCount: 0,
    notificationBadgeText: '',
    unreadChatCount: 0
  },

  onLoad() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadUserInfo();
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadUserInfo();
  },

  onRefresh() {
    this.loadUserInfo();
    this.setData({ triggered: false });
  },

  loadUserInfo() {
    const app = getApp();
    const userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo || {};
    const uname = String((userInfo && userInfo.username) || '');
    const profileBgUrl = String(userInfo.profileBackground || '').trim();
    this.setData({
      userInfo: userInfo,
      profileBgUrl,
      isAdminUser: ADMIN_USERNAME.includes(String(uname))
    });
    this.migrateLegacyAvatarIfNeeded(userInfo);
    this.refreshNotificationBadge();
    this.refreshChatBadge();
  },

  goMyHome() {
    wx.navigateTo({ url: '/packageFriend/home/home' });
  },

  async refreshNotificationBadge() {
    const token = wx.getStorageSync('token');
    const userId = wx.getStorageSync('userId') || getApp().globalData.userId;
    if (!token || !userId || userId === 'admin') {
      this.setData({ notificationBadgeCount: 0, notificationBadgeText: '' });
      return;
    }
    try {
      const r = await getNotificationBadgeCount();
      const n = typeof r.count === 'number' ? r.count : parseInt(r.count, 10) || 0;
      const capped = n > 99 ? 99 : n;
      this.setData({
        notificationBadgeCount: capped,
        notificationBadgeText: n > 99 ? '99+' : String(n)
      });
    } catch (e) {
      this.setData({ notificationBadgeCount: 0, notificationBadgeText: '' });
    }
  },

  async refreshChatBadge() {
    const token = wx.getStorageSync('token');
    if (!token) return;
    try {
      const r = await getUnreadCount();
      const n = typeof r.count === 'number' ? r.count : parseInt(r.count, 10) || 0;
      this.setData({ unreadChatCount: n > 99 ? 99 : n });
    } catch (e) {
      this.setData({ unreadChatCount: 0 });
    }
  },

  async migrateLegacyAvatarIfNeeded(userInfo) {
    if (this._avatarMigrating) return;
    const userId = wx.getStorageSync('userId') || getApp().globalData.userId;
    if (!userId || userId === 'admin') return;
    const raw = (userInfo && (userInfo.avatarUrl || userInfo.avatar)) || '';
    if (!cloudStorage.needsMigrateToCloud(raw)) return;
    if (!cloudStorage.cloudReady()) return;
    const id =
      userInfo && userInfo.id != null && userInfo.id !== ''
        ? userInfo.id
        : parseInt(userId, 10) || userId;
    this._avatarMigrating = true;
    try {
      const newId = await cloudStorage.migrateImageUrlToCloudIfNeeded(
        raw,
        `users/${id}/avatar_mig_${Date.now()}.jpg`
      );
      if (!newId || newId === raw) return;
      await updateUserInfo({ id, avatar: newId });
      const updatedUserInfo = {
        ...userInfo,
        avatarUrl: newId,
        avatar: newId
      };
      wx.setStorageSync('userInfo', updatedUserInfo);
      getApp().setUserInfo(updatedUserInfo);
      this.setData({ userInfo: updatedUserInfo });
    } catch (e) {
      console.warn('[profile] 头像迁移失败', e);
    } finally {
      this._avatarMigrating = false;
    }
  },

  goToHistory() {
    wx.navigateTo({ url: '/packageHistory/list/list' });
  },

  goToPaymentManage() {
    wx.navigateTo({ url: '/packagePayment/history/history' });
  },

  goToNotifications() {
    wx.navigateTo({ url: '/packageNotification/index/index' });
  },

  goToFriends() {
    wx.navigateTo({ url: '/packageFriend/list/list' });
  },

  goToChats() {
    wx.navigateTo({ url: '/packageChat/list/list' });
  },

  goToPublishNotice() {
    wx.navigateTo({ url: '/packageNotification/publish/publish' });
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync('token');
        wx.removeStorageSync('userId');
        wx.removeStorageSync('userInfo');
        const app = getApp();
        app.globalData.token = null;
        app.globalData.userId = null;
        app.globalData.userInfo = null;
        wx.reLaunch({ url: '/pages/login/login' });
      }
    });
  }
});
