// pages/history/list.js
const { getMyActivities } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showError, formatAmount, formatDate } = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

Page({
  data: {
    activities: [],
    triggered: false,
    navHeight: 0
  },

  onLoad() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadHistoryActivities();
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadHistoryActivities();
  },

  onRefresh() {
    this.loadHistoryActivities().finally(() => {
      this.setData({ triggered: false });
    });
  },

  // 加载历史活动列表
  async loadHistoryActivities() {
    showLoading('加载中...');
    try {
      const result = await getMyActivities('ended');
      const activities = (result.activities || []).map(activity => ({
        ...activity,
        totalAmount: formatAmount(activity.totalAmount || 0),
        shareAmount: formatAmount(activity.shareAmount != null ? activity.shareAmount : 0),
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
      url: `/packageHistory/detail/detail?id=${activityId}`
    });
  }
});
