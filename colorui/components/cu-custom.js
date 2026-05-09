const app = getApp();
const { computeNavTotalHeight, getNavTotalHeight } = require('../../utils/navHeight.js');

function getNavHeights() {
  const sb = app.globalData.StatusBar || 0;
  const cb = app.globalData.CustomBar || 0;
  const useSb = sb === 0 && cb === 0 ? 20 : sb;
  const useCb = sb === 0 && cb === 0 ? 44 : cb;
  return {
    StatusBar: useSb,
    CustomBar: useCb,
    NavHeight: useSb + useCb,
    NavTotalHeight: getNavTotalHeight()
  };
}

function fetchNavHeights(callback) {
  try {
    const win = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : null;
    const sb = (win && win.statusBarHeight) || 0;
    const custom = wx.getMenuButtonBoundingClientRect?.() || {};
    const cb = (custom.bottom || custom.top + 48) - sb;
    app.globalData.StatusBar = sb;
    app.globalData.CustomBar = cb;
    app.globalData.NavTotalHeight = computeNavTotalHeight(sb, cb);
    app.globalData.Custom = custom;
    callback(getNavHeights());
  } catch (e) {
    callback(getNavHeights());
  }
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
    NavTotalHeight: 80,
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
          heights.NavTotalHeight !== this.data.NavTotalHeight ||
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
