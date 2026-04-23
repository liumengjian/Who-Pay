// pages/notification/index.js
const { getApplicationList, handleApplication, getMyApplications, cancelApplication } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showSuccess, showError, formatDateTime } = require('../../utils/util.js');

Page({
  data: {
    messages: [],   // 统一消息列表
    loading: true
  },

  onLoad() {
    this.loadAll();
  },

  onShow() {
    this.loadAll();
  },

  async loadAll() {
    this.setData({ loading: true });
    const [received, sent] = await Promise.all([this.loadReceived(), this.loadSent()]);
    // 合并结果，按时间倒序
    const messages = [...received, ...sent].sort(
      (a, b) => new Date(b.createTimeRaw) - new Date(a.createTimeRaw)
    );
    this.setData({ messages, loading: false });
  },

  async loadReceived() {
    try {
      const result = await getApplicationList();
      return (result.applications || []).map((app) => ({
        msgType: '审批',
        _id: app._id,
        activityId: app.activityId,
        applicantAvatar: app.applicantAvatar || '/images/default-avatar.png',
        applicantName: app.applicantName,
        targetName: app.targetName,
        targetType: app.targetType,
        status: app.status || 'pending',
        createTime: formatDateTime(app.createTime),
        createTimeRaw: app.createTime,
        actionLabel: (app.status === 'pending' || !app.status) ? '处理' : ''
      }));
    } catch (error) {
      console.error('加载审批消息失败:', error);
      return [];
    }
  },

  async loadSent() {
    try {
      const result = await getMyApplications();
      return (result.applications || []).map((app) => ({
        msgType: '申请',
        _id: app._id,
        activityId: app.activityId,
        targetName: app.targetName,
        targetType: app.targetType,
        status: app.status,
        createTime: formatDateTime(app.createTime),
        createTimeRaw: app.createTime,
        actionLabel: app.status === 'pending' ? '撤销' : ''
      }));
    } catch (error) {
      console.error('加载申请消息失败:', error);
      return [];
    }
  },

  async handleApplication(e) {
    const { id, action } = e.currentTarget.dataset;
    const actionText = action === 'approve' ? '同意' : '拒绝';
    wx.showModal({
      title: `确认${actionText}`,
      content: `确定要${actionText}该申请吗？`,
      success: async (res) => {
        if (!res.confirm) return;
        showLoading('处理中...');
        try {
          await handleApplication(id, action);
          hideLoading();
          showSuccess(`已${actionText}`);
          await this.loadAll();
        } catch (error) {
          hideLoading();
          showError(error.message || '处理失败');
        }
      }
    });
  },

  async cancelApplication(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认撤销',
      content: '确定要撤销该申请吗？',
      success: async (res) => {
        if (!res.confirm) return;
        showLoading('撤销中...');
        try {
          await cancelApplication(id);
          hideLoading();
          showSuccess('已撤销');
          await this.loadAll();
        } catch (error) {
          hideLoading();
          showError(error.message || '撤销失败');
        }
      }
    });
  },

  stopPropagation() {}
});
