// pages/login/login.js
const { loginWithAccount, register } = require('../../utils/cloud.js');
const cloudStorage = require('../../utils/cloudStorage.js');
const { showLoading, hideLoading, showError, showSuccess, filePathToBase64Compressed } = require('../../utils/util.js');

function hasChinese(str) {
  return /[\u4e00-\u9fff]/.test(String(str || ''));
}

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
      avatarUrl: '',
      avatarTempPath: ''
    }
  },

  onLoad(options) {
    const token = wx.getStorageSync('token');
    // 保存分享链接的重定向地址（如从分享页跳转过来）
    if (options.redirect) {
      this._redirectUrl = options.redirect;
    }
    if (token) {
      this._goHome();
    }
  },

  _goHome() {
    const url = this._redirectUrl;
    this._redirectUrl = '';
    if (url) {
      // 重定向到分享的页面（可能是分包页面，用 reLaunch）
      wx.reLaunch({ url });
    } else {
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
    if (hasChinese(account) || hasChinese(password)) {
      showError('账号和密码不能包含中文');
      return;
    }

    // 内置管理员账号，直接登录不调接口
    if (account === 'admin' && password === '000000') {
      this.handleAdminLogin();
      return;
    }

    this.handleLogin(account, password);
  },

  handleAdminLogin() {
    const token = 'admin';
    const userId = 'admin';
    const userInfo = {
      username: 'admin',
      nickName: '管理员',
      avatarUrl: '/images/default-avatar.png'
    };

    wx.setStorageSync('token', token);
    wx.setStorageSync('userId', userId);
    wx.setStorageSync('userInfo', userInfo);

    const app = getApp();
    app.globalData.token = token;
    app.globalData.userId = userId;
    app.globalData.userInfo = userInfo;
    app.connectWS();

    showSuccess('登录成功');
    this._goHome();
  },

  async handleLogin(username, passwordPlain) {
    showLoading('登录中...');
    try {
      const result = await loginWithAccount(username, passwordPlain);

      if (result && result.tokenValue && result.loginId != null) {
        const token = result.tokenValue;
        const userId = String(result.loginId);
        wx.setStorageSync('token', token);
        wx.setStorageSync('userId', userId);

        const app = getApp();
        app.globalData.token = token;
        app.globalData.userId = userId;
        if (result.userInfo) {
          const ui = {
            ...result.userInfo,
            username: result.userInfo.username || username
          };
          wx.setStorageSync('userInfo', ui);
          app.globalData.userInfo = ui;
        } else {
          app.getUserInfo(userId);
        }
        app.connectWS();

        hideLoading();
        showSuccess('登录成功');
        this._goHome();
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
    const { account, password, nickName, avatarTempPath } = this.data.registerForm;

    if (!account || !password) {
      showError('请输入账号和密码');
      return;
    }
    if (!nickName || !nickName.trim()) {
      showError('请输入用户名');
      return;
    }
    if (password.length < 6) {
      showError('密码长度至少6位');
      return;
    }
    if (hasChinese(account) || hasChinese(password)) {
      showError('账号和密码不能包含中文');
      return;
    }

    showLoading('注册中...');
    try {
      let avatar = '';

      if (avatarTempPath) {
        try {
          if (cloudStorage.cloudReady()) {
            avatar = await cloudStorage.uploadLocalImage(
              avatarTempPath,
              `users/register/avatar_${Date.now()}.jpg`,
              { compressQuality: 78 }
            );
          } else {
            avatar = await filePathToBase64Compressed(avatarTempPath);
          }
        } catch (err) {
          console.warn('头像上传失败，尝试 base64:', err);
          try {
            avatar = await filePathToBase64Compressed(avatarTempPath);
          } catch (e2) {
            console.warn('头像转 base64 失败:', e2);
          }
        }
      }

      const params = {
        username: account,
        password,
        nickName: nickName.trim(),
        avatar: avatar
      };
      const result = await register(params);

      if (result && (result.tokenValue || result.token || result.userId)) {
        const token = result.tokenValue || result.token || result.userId;
        const userId =
          result.loginId != null
            ? String(result.loginId)
            : result.userId != null
              ? String(result.userId)
              : token;
        wx.setStorageSync('token', token);
        wx.setStorageSync('userId', userId);

        const app = getApp();
        app.globalData.token = token;
        app.globalData.userId = userId;
        if (result.userInfo) {
          const ui = {
            ...result.userInfo,
            username: result.userInfo.username || account
          };
          wx.setStorageSync('userInfo', ui);
          app.globalData.userInfo = ui;
        } else {
          app.getUserInfo(userId);
        }
        app.connectWS();

        hideLoading();
        wx.showToast({
          title: '注册成功',
          icon: 'success',
          duration: 2000,
          mask: true
        });
        setTimeout(() => {
          this._goHome();
        }, 1800);
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
