// pages/notification/index.js
const { getApplicationList, handleApplication } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showSuccess, showError, formatDateTime } = require('../../utils/util.js');

Page({
  data: {
    applicationList: [],
    loading: true
  },

  onLoad() {
    this.loadApplications();
  },

  onShow() {
    this.loadApplications();
  },

  async loadApplications() {
    this.setData({ loading: true });
    try {
      const result = await getApplicationList();
      const list = (result.applications || []).map((app) => ({
        ...app,
        createTime: formatDateTime(app.createTime)
      }));
      this.setData({
        applicationList: list,
        loading: false
      });
    } catch (error) {
      console.error('加载申请列表失败:', error);
      showError(error.message || '加载失败');
      this.setData({ loading: false });
    }
  },

  async handleApplication(e) {
    const { applicationid, action } = e.currentTarget.dataset;
    const actionText = action === 'approve' ? '同意' : '拒绝';
    wx.showModal({
      title: `确认${actionText}`,
      content: `确定要${actionText}该申请吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        showLoading('处理中...');
        try {
          await handleApplication(applicationid, action);
          hideLoading();
          showSuccess(`已${actionText}`);
          await this.loadApplications();
        } catch (error) {
          hideLoading();
          showError(error.message || '处理失败');
        }
      }
    });
  },

  stopPropagation() {}
});
