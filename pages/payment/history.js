const { getPaymentHistory } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showError, formatAmount, formatDateTime } = require('../../utils/util.js');

Page({
  data: {
    payments: []
  },

  onLoad() {
    this.load();
  },

  onShow() {
    this.load();
  },

  async load() {
    if (wx.getStorageSync('userId') === 'admin') {
      this.setData({ payments: [] });
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
      this.setData({ payments: list });
    } catch (e) {
      console.error(e);
      showError(e.message || '加载失败');
    } finally {
      hideLoading();
    }
  }
});
