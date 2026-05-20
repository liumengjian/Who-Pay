const { publishSystemNotice } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showSuccess, showError } = require('../../utils/util.js');
const { ADMIN_USERNAME } = require('../../utils/constants.js');

Page({
  data: {
    title: '',
    body: ''
  },

  onLoad() {
    const ui = wx.getStorageSync('userInfo') || {};
    if (ADMIN_USERNAME.includes(String(ui.username))) {
      showError('仅管理员可发布通知');
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onBodyInput(e) {
    this.setData({ body: e.detail.value });
  },

  async onPublish() {
    const title = (this.data.title || '').trim();
    const body = (this.data.body || '').trim();
    if (!title) {
      showError('请填写通知标题');
      return;
    }
    if (!body) {
      showError('请填写通知正文');
      return;
    }
    showLoading('发布中...');
    try {
      const r = await publishSystemNotice(title, body);
      hideLoading();
      const n = r.sent != null ? r.sent : 0;
      showSuccess(n ? `已推送给 ${n} 位用户` : '已提交');
      this.setData({ title: '', body: '' });
      setTimeout(() => wx.navigateBack(), 1200);
    } catch (e) {
      hideLoading();
      showError(e.message || '发布失败');
    }
  }
});
