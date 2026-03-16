// pages/login/login.js
const { login } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showError } = require('../../utils/util.js');

Page({
  data: {},

  onLoad(options) {
    // 检查是否已登录
    const openid = wx.getStorageSync('openid');
    if (openid) {
      // 已登录，跳转到活动首页
      wx.switchTab({
        url: '/pages/activity/index'
      });
    }
  },

  // 获取手机号授权
  onGetPhoneNumber(e) {
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      this.handleLogin(e.detail.code, e.detail.encryptedData, e.detail.iv);
    } else {
      showError('需要授权手机号才能使用');
    }
  },

  // 处理登录
  async handleLogin(code, encryptedData, iv) {
    showLoading('登录中...');
    try {
      // 先获取微信登录code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        });
      });

      if (!loginRes.code) {
        throw new Error('获取登录凭证失败');
      }

      // 调用云函数登录
      const result = await login(loginRes.code, encryptedData, iv);
      
      if (result && result.openid) {
        // 保存openid和用户信息
        wx.setStorageSync('openid', result.openid);
        if (result.userInfo) {
          wx.setStorageSync('userInfo', result.userInfo);
          const app = getApp();
          app.globalData.openid = result.openid;
          app.globalData.userInfo = result.userInfo;
        }

        hideLoading();
        // 跳转到活动首页
        wx.switchTab({
          url: '/pages/activity/index'
        });
      } else {
        throw new Error('登录失败，请重试');
      }
    } catch (error) {
      hideLoading();
      console.error('登录失败:', error);
      showError(error.message || '登录失败，请重试');
    }
  }
});
