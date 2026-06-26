const { publishSystemNotice, getOnboardingGuide, saveOnboardingGuide } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showSuccess, showError } = require('../../utils/util.js');
const { ADMIN_USERNAME } = require('../../utils/constants.js');

Page({
  data: {
    currentTab: 'notice',
    // 更新公告
    title: '',
    body: '',
    // 新手指引
    guideBody: '',
    guideLoading: false
  },

  onLoad() {
    const ui = wx.getStorageSync('userInfo') || {};
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    if (tab === 'guide') {
      this.loadGuide();
    }
  },

  // ========== 更新公告 ==========

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
  },

  // ========== 新手指引 ==========

  async loadGuide() {
    this.setData({ guideLoading: true });
    try {
      const result = await getOnboardingGuide();
      this.setData({
        guideBody: result.body || '',
        guideLoading: false
      });
    } catch (e) {
      console.error('加载新手指引失败:', e);
      showError(e.message || '加载失败');
      this.setData({ guideLoading: false });
    }
  },

  onGuideBodyInput(e) {
    this.setData({ guideBody: e.detail.value });
  },

  async onSaveGuide() {
    const body = (this.data.guideBody || '').trim();
    if (!body) {
      showError('请填写新手指引内容');
      return;
    }
    showLoading('保存中...');
    try {
      await saveOnboardingGuide(body);
      hideLoading();
      showSuccess('新手指引已保存');
    } catch (e) {
      hideLoading();
      showError(e.message || '保存失败');
    }
  }
});
