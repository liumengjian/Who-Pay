// app.js
const { callAPI } = require('./utils/cloud.js');

App({
  onLaunch() {
    // 获取系统信息，用于 cu-custom 导航栏
    wx.getSystemInfo({
      success: e => {
        this.globalData.StatusBar = e.statusBarHeight || 0;
        const custom = wx.getMenuButtonBoundingClientRect
          ? wx.getMenuButtonBoundingClientRect()
          : { bottom: 0, top: 0 };
        this.globalData.Custom = custom;
        this.globalData.CustomBar =
          (custom.bottom ? custom.bottom : custom.top + 48) -
          (e.statusBarHeight || 0);
      }
    });
    // 检查登录态
    this.checkLogin();
  },

  globalData: {
    userInfo: null,
    token: null,
    userId: null,
    StatusBar: 0,
    Custom: null,
    CustomBar: 0
  },

  // 检查登录态
  checkLogin() {
    const token = wx.getStorageSync('token');
    const userId = wx.getStorageSync('userId');
    if (token && userId) {
      this.globalData.token = token;
      this.globalData.userId = userId;
      // 获取用户信息（管理员不调接口）
      if (userId !== 'admin') {
        this.getUserInfo(userId);
      } else {
        const userInfo = wx.getStorageSync('userInfo');
        if (userInfo) this.globalData.userInfo = userInfo;
      }
    }
  },

  // 获取用户信息
  async getUserInfo(userId) {
    if (!userId || userId === 'admin') return;

    try {
      const result = await callAPI(`/api/user/${userId}`, 'GET');
      if (result) {
        const userInfo = result.userInfo || result;
        this.globalData.userInfo = userInfo;
        wx.setStorageSync('userInfo', userInfo);
      }
    } catch (err) {
      console.error('获取用户信息失败', err);
    }
  },

  // 设置用户信息
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo;
  }
});
