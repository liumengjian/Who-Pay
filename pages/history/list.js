// pages/history/list.js
const { getMyActivities } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showError, formatAmount, formatDate } = require('../../utils/util.js');

Page({
  data: {
    activities: []
  },

  onLoad() {
    this.loadHistoryActivities();
  },

  onShow() {
    this.loadHistoryActivities();
  },

  // 加载历史活动列表
  async loadHistoryActivities() {
    showLoading('加载中...');
    try {
      const result = await getMyActivities('ended');
      const activities = (result.activities || []).map(activity => ({
        ...activity,
        totalAmount: formatAmount(activity.totalAmount || 0),
        shareAmount: formatAmount((activity.totalAmount || 0) / 3),
        endTime: formatDate(activity.endTime)
      }));
      
      this.setData({
        activities: activities
      });
    } catch (error) {
      console.error('加载历史活动失败:', error);
      showError(error.message || '加载失败');
    } finally {
      hideLoading();
    }
  },

  // 跳转到历史活动详情
  goToDetail(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/history/detail?id=${activityId}`
    });
  }
});
