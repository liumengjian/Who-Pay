// pages/login/login.js
const { loginWithAccount, register } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showError, showSuccess, uploadImageForRegister } = require('../../utils/util.js');

Page({
  data: {
    currentTab: 'login',
    loginForm: {
      account: '',
      password: ''
    },
    registerForm: {
      account: '',
      password: '',
      avatarUrl: '',
      avatarTempPath: ''
    }
  },

  onLoad(options) {
    const openid = wx.getStorageSync('openid');
    if (openid) {
      wx.switchTab({
        url: '/pages/activity/index'
      });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;
    wx.vibrateShort({ type: 'light' });
    this.setData({ currentTab: tab });
  },

  onLoginAccountInput(e) {
    this.setData({
      'loginForm.account': e.detail.value
    });
  },

  onLoginPasswordInput(e) {
    this.setData({
      'loginForm.password': e.detail.value
    });
  },

  onRegisterAccountInput(e) {
    this.setData({
      'registerForm.account': e.detail.value
    });
  },

  onRegisterPasswordInput(e) {
    this.setData({
      'registerForm.password': e.detail.value
    });
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      'registerForm.avatarUrl': avatarUrl,
      'registerForm.avatarTempPath': avatarUrl
    });
  },

  onLogin() {
    const { account, password } = this.data.loginForm;
    if (!account || !password) {
      showError('请输入账号和密码');
      return;
    }
    wx.vibrateShort({ type: 'light' });

    // 内置管理员账号，直接登录不调接口
    if (account === 'admin' && password === '000000') {
      this.handleAdminLogin();
      return;
    }

    this.handleLogin(account, password);
  },

  handleAdminLogin() {
    const openid = 'admin';
    const userInfo = { nickName: '管理员', avatarUrl: '/images/default-avatar.png' };

    wx.setStorageSync('openid', openid);
    wx.setStorageSync('userInfo', userInfo);

    const app = getApp();
    app.globalData.openid = openid;
    app.globalData.userInfo = userInfo;

    showSuccess('登录成功');
    wx.switchTab({
      url: '/pages/activity/index'
    });
  },

  async handleLogin(account, password) {
    showLoading('登录中...');
    try {
      const result = await loginWithAccount(account, password);

      if (result && (result.openid || result.userId || result.token)) {
        const openid = result.openid || result.userId || result.token;
        wx.setStorageSync('openid', openid);

        if (result.userInfo) {
          wx.setStorageSync('userInfo', result.userInfo);
          const app = getApp();
          app.globalData.openid = openid;
          app.globalData.userInfo = result.userInfo;
        } else {
          const app = getApp();
          app.globalData.openid = openid;
        }

        hideLoading();
        showSuccess('登录成功');
        wx.switchTab({
          url: '/pages/activity/index'
        });
      } else {
        throw new Error(result?.message || '登录失败，请重试');
      }
    } catch (error) {
      hideLoading();
      console.error('登录失败:', error);
      showError(error.message || '登录失败，请重试');
    }
  },

  async onRegister() {
    wx.vibrateShort({ type: 'light' });
    const { account, password, avatarTempPath } = this.data.registerForm;

    if (!account || !password) {
      showError('请输入账号和密码');
      return;
    }

    if (password.length < 6) {
      showError('密码长度至少6位');
      return;
    }
    wx.vibrateShort({ type: 'light' });

    showLoading('注册中...');
    try {
      let avatarUrl = '';

      if (avatarTempPath) {
        try {
          avatarUrl = await uploadImageForRegister(avatarTempPath);
        } catch (err) {
          console.warn('头像上传失败，使用默认头像:', err);
          avatarUrl = '/images/default-avatar.png';
        }
      }

      const result = await register(account, password, avatarUrl);

      if (result && (result.openid || result.userId || result.token)) {
        const openid = result.openid || result.userId || result.token;
        wx.setStorageSync('openid', openid);

        if (result.userInfo) {
          wx.setStorageSync('userInfo', result.userInfo);
          const app = getApp();
          app.globalData.openid = openid;
          app.globalData.userInfo = result.userInfo;
        } else {
          const app = getApp();
          app.globalData.openid = openid;
        }

        hideLoading();
        showSuccess('注册成功');
        wx.switchTab({
          url: '/pages/activity/index'
        });
      } else {
        throw new Error(result?.message || '注册失败，请重试');
      }
    } catch (error) {
      hideLoading();
      console.error('注册失败:', error);
      showError(error.message || '注册失败，请重试');
    }
  }
});
