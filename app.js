// app.js
const { CLOUD_ENV } = require('./service/config.js');
const { callAPI } = require('./utils/cloud.js');
const { computeNavTotalHeight } = require('./utils/navHeight.js');
const { CLOUD_ENV: WS_ENV, CLOUD_SERVICE } = require('./service/config.js');

App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: CLOUD_ENV,
        traceUser: true
      });
    }
    // 窗口信息，用于 cu-custom 导航栏（避免 getSystemInfo / getSystemInfoSync 废弃告警）
    try {
      const win =
        typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : null;
      const sb = (win && win.statusBarHeight) || 0;
      this.globalData.StatusBar = sb;
      const custom = wx.getMenuButtonBoundingClientRect
        ? wx.getMenuButtonBoundingClientRect()
        : { bottom: 0, top: 0 };
      this.globalData.Custom = custom;
      this.globalData.CustomBar =
        (custom.bottom ? custom.bottom : custom.top + 48) - sb;
      this.globalData.NavTotalHeight = computeNavTotalHeight(
        sb,
        this.globalData.CustomBar
      );
    } catch (e) {
      /* 保持默认 0，由 cu-custom attached 再补一次 */
    }
    // 检查登录态
    this.checkLogin();
  },

  globalData: {
    userInfo: null,
    token: null,
    userId: null,
    StatusBar: 0,
    Custom: null,
    CustomBar: 0,
    NavTotalHeight: 0,
    wsTask: null,
    wsConnected: false,
    _wsMessageHandlers: []
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
      // Auto-connect global WebSocket
      this.connectWS();
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
  },

  // ---- Global WebSocket ----

  connectWS() {
    const token = this.globalData.token || wx.getStorageSync('token');
    if (!token) return;
    if (this.globalData.wsTask) return; // already connected

    wx.cloud.connectContainer({
      env: WS_ENV,
      service: CLOUD_SERVICE,
      path: `/ws?token=${encodeURIComponent(token)}`,
      success: (res) => {
        const task = res.socketTask;
        this.globalData.wsTask = task;

        task.onOpen(() => {
          this.globalData.wsConnected = true;
        });

        task.onMessage((res) => {
          try {
            const data = JSON.parse(res.data);
            this._dispatchWSMessage(data);
          } catch (e) {
            console.error('[App WS] parse error', e);
          }
        });

        task.onClose(() => {
          this.globalData.wsTask = null;
          this.globalData.wsConnected = false;
        });

        task.onError(() => {
          this.globalData.wsTask = null;
          this.globalData.wsConnected = false;
        });
      },
      fail: (err) => {
        console.error('[App WS] connect fail', err);
      }
    });
  },

  disconnectWS() {
    if (this.globalData.wsTask) {
      this.globalData.wsTask.close();
      this.globalData.wsTask = null;
      this.globalData.wsConnected = false;
    }
  },

  /**
   * Register a handler for incoming WS messages.
   * Returns an unsubscribe function.
   */
  onWSMessage(handler) {
    this.globalData._wsMessageHandlers.push(handler);
    return () => {
      const list = this.globalData._wsMessageHandlers;
      const idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  },

  _dispatchWSMessage(data) {
    const handlers = this.globalData._wsMessageHandlers;
    for (let i = 0; i < handlers.length; i++) {
      try {
        handlers[i](data);
      } catch (e) {
        console.error('[App WS] handler error', e);
      }
    }
  }
});
