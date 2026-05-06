const { getPaymentHistory } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showError, formatAmount, formatDateTime } = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

function buildActivityFilterOptions(list) {
  const map = new Map();
  for (const p of list) {
    const id = String(p.activityId || '');
    if (!id) continue;
    const name = (p.activityName || '活动').trim() || '活动';
    if (!map.has(id)) map.set(id, name);
  }
  const opts = [{ id: '', name: '全部活动' }];
  [...map.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'zh-Hans-CN'))
    .forEach(([id, name]) => {
      opts.push({ id, name });
    });
  return opts;
}

Page({
  data: {
    rawPayments: [],
    payments: [],
    activityOptions: [{ id: '', name: '全部活动' }],
    filterIndex: 0,
    triggered: false,
    navHeight: 0
  },

  onLoad() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.load();
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.load();
  },

  onRefresh() {
    this.load().finally(() => {
      this.setData({ triggered: false });
    });
  },

  onFilterActivityChange(e) {
    const idx = parseInt(e.detail.value, 10);
    const options = this.data.activityOptions || [];
    const opt = options[Number.isNaN(idx) ? 0 : idx] || options[0];
    const id = opt ? opt.id : '';
    const all = this.data.rawPayments || [];
    const filtered = !id
      ? all
      : all.filter((p) => String(p.activityId) === String(id));
    this.setData({
      filterIndex: Number.isNaN(idx) ? 0 : idx,
      payments: filtered
    });
  },

  async load() {
    if (wx.getStorageSync('userId') === 'admin') {
      this.setData({
        rawPayments: [],
        payments: [],
        activityOptions: [{ id: '', name: '全部活动' }],
        filterIndex: 0
      });
      return;
    }
    showLoading('加载中...');
    try {
      const result = await getPaymentHistory({ limit: 200 });
      const list = (result.payments || []).map((p) => ({
        ...p,
        amount: formatAmount(p.amount),
        createTime: formatDateTime(p.createTime)
      }));
      const activityOptions = buildActivityFilterOptions(list);
      const filterIndex = 0;
      this.setData({
        rawPayments: list,
        payments: list,
        activityOptions,
        filterIndex
      });
    } catch (e) {
      console.error(e);
      showError(e.message || '加载失败');
    } finally {
      hideLoading();
    }
  }
});
