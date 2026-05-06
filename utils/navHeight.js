/**
 * 与 colorui/components/cu-custom.wxml 占高一致：NavHeight(statusBar + 标题栏) + 16
 */
const NAV_BAR_EXTRA = 16;

function computeNavTotalHeight(statusBarHeight, customBarHeight) {
  return (statusBarHeight || 0) + (customBarHeight || 0) + NAV_BAR_EXTRA;
}

function getNavTotalHeight() {
  const app = getApp();
  const g = app.globalData;
  if (g.NavTotalHeight > 0) return g.NavTotalHeight;
  const sb = g.StatusBar || 0;
  const cb = g.CustomBar || 0;
  if (sb === 0 && cb === 0) return 20 + 44 + NAV_BAR_EXTRA;
  return sb + cb + NAV_BAR_EXTRA;
}

module.exports = {
  NAV_BAR_EXTRA,
  computeNavTotalHeight,
  getNavTotalHeight
};
