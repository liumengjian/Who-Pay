const app = getApp();

function getNavHeights() {
  const sb = app.globalData.StatusBar ?? 20;
  const cb = app.globalData.CustomBar ?? 44;
  return { StatusBar: sb, CustomBar: cb, NavHeight: sb + cb };
}

function fetchNavHeights(callback) {
  wx.getSystemInfo({
    success(e) {
      const sb = e.statusBarHeight || 0;
      const custom = wx.getMenuButtonBoundingClientRect?.() || {};
      const cb = (custom.bottom || custom.top + 48) - sb;
      app.globalData.StatusBar = sb;
      app.globalData.CustomBar = cb;
      app.globalData.Custom = custom;
      callback(getNavHeights());
    },
    fail: () => callback(getNavHeights())
  });
}

Component({
  options: {
    addGlobalClass: true,
    multipleSlots: true
  },
  properties: {
    bgColor: { type: String, default: '' },
    isCustom: { type: [Boolean, String], default: false },
    isBack: { type: [Boolean, String], default: false },
    bgImage: { type: String, default: '' }
  },
  data: {
    StatusBar: 20,
    CustomBar: 44,
    NavHeight: 64,
    Custom: null
  },
  lifetimes: {
    attached() {
      this._updateNavHeights();
      if (app.globalData.StatusBar === 0 && app.globalData.CustomBar === 0) {
        fetchNavHeights(h => this.setData(h));
      }
    }
  },
  pageLifetimes: {
    show() {
      this._updateNavHeights();
    }
  },
  methods: {
    _updateNavHeights() {
      const heights = getNavHeights();
      if (heights.NavHeight !== this.data.NavHeight ||
          heights.StatusBar !== this.data.StatusBar ||
          heights.CustomBar !== this.data.CustomBar) {
        this.setData(heights);
      }
    },
    BackPage() {
      wx.navigateBack({ delta: 1 });
    },
    toHome() {
      wx.reLaunch({ url: '/pages/activity/index' });
    }
  }
});
