// pages/login/login.js
const { loginWithAccount, register } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showError, showSuccess, filePathToBase64 } = require('../../utils/util.js');
const { md5 } = require('../../utils/md5.js');

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
      nickName: '',
      realName: '',
      avatarUrl: '',
      avatarTempPath: ''
    }
  },

  onLoad(options) {
    const token = wx.getStorageSync('token');
    if (token) {
      wx.switchTab({
        url: '/pages/activity/index'
      });
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;
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

  onRegisterNickNameInput(e) {
    this.setData({
      'registerForm.nickName': e.detail.value
    });
  },

  onRegisterRealNameInput(e) {
    this.setData({
      'registerForm.realName': e.detail.value
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

    // 内置管理员账号，直接登录不调接口
    if (account === 'admin' && password === '000000') {
      this.handleAdminLogin();
      return;
    }

    this.handleLogin(account, md5(password));
  },

  handleAdminLogin() {
    const token = 'admin';
    const userId = 'admin';
    const userInfo = { nickName: '管理员', avatarUrl: '/images/default-avatar.png' };

    wx.setStorageSync('token', token);
    wx.setStorageSync('userId', userId);
    wx.setStorageSync('userInfo', userInfo);

    const app = getApp();
    app.globalData.token = token;
    app.globalData.userId = userId;
    app.globalData.userInfo = userInfo;

    showSuccess('登录成功');
    wx.switchTab({
      url: '/pages/activity/index'
    });
  },

  async handleLogin(username, passwordMd5) {
    showLoading('登录中...');
    try {
      const result = await loginWithAccount(username, passwordMd5);

      if (result && result.tokenValue && result.loginId) {
        const token = result.tokenValue;
        const userId = String(result.loginId);
        wx.setStorageSync('token', token);
        wx.setStorageSync('userId', userId);

        const app = getApp();
        app.globalData.token = token;
        app.globalData.userId = userId;
        if (result.userInfo) {
          wx.setStorageSync('userInfo', result.userInfo);
          app.globalData.userInfo = result.userInfo;
        } else {
          app.getUserInfo(userId);
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
    const { account, password, nickName, realName, avatarTempPath } = this.data.registerForm;

    if (!account || !password) {
      showError('请输入账号和密码');
      return;
    }
    if (!nickName || !nickName.trim()) {
      showError('请输入昵称');
      return;
    }
    if (!realName || !realName.trim()) {
      showError('请输入真名');
      return;
    }
    if (password.length < 6) {
      showError('密码长度至少6位');
      return;
    }

    showLoading('注册中...');
    try {
      let avatar = '';

      if (avatarTempPath) {
        try {
          avatar = await filePathToBase64(avatarTempPath);
        } catch (err) {
          console.warn('头像转 base64 失败:', err);
        }
      }

      const params = {
        username: account,
        password: md5(password),
        nickName: nickName.trim(),
        realName: realName.trim(),
        avatar: avatar
      };
      const result = await register(params);

      if (result && (result.tokenValue || result.token || result.userId)) {
        const token = result.tokenValue || result.token || result.userId;
        const userId = result.loginId ? String(result.loginId) : (result.userId ? String(result.userId) : token);
        wx.setStorageSync('token', token);
        wx.setStorageSync('userId', userId);

        const app = getApp();
        app.globalData.token = token;
        app.globalData.userId = userId;
        if (result.userInfo) {
          wx.setStorageSync('userInfo', result.userInfo);
          app.globalData.userInfo = result.userInfo;
        } else {
          app.getUserInfo(userId);
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
