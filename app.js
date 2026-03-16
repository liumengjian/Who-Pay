// app.js
const { callAPI } = require('./utils/cloud.js');

App({
  onLaunch() {
    // 检查登录态
    this.checkLogin();
  },

  globalData: {
    userInfo: null,
    openid: null
  },

  // 检查登录态
  checkLogin() {
    const openid = wx.getStorageSync('openid');
    if (openid) {
      this.globalData.openid = openid;
      // 获取用户信息
      this.getUserInfo();
    }
  },

  // 获取用户信息
  async getUserInfo() {
    const openid = wx.getStorageSync('openid');
    if (!openid) return;

    try {
      const result = await callAPI('/api/user/info', 'GET');
      if (result && result.userInfo) {
        this.globalData.userInfo = result.userInfo;
        wx.setStorageSync('userInfo', result.userInfo);
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
