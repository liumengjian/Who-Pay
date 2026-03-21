// pages/activity/index.js
const { createActivity, joinActivity, getMyActivities } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showSuccess, showError, validateInviteCode } = require('../../utils/util.js');

Page({
  data: {
    userInfo: {},
    activities: [],
    showCreate: false,
    showJoin: false,
    activityName: '',
    inviteCode: ''
  },

  onLoad() {
    // 检查登录态
    this.checkLogin();
  },

  onShow() {
    // 每次显示页面时刷新活动列表
    if (this.data.userInfo) {
      this.loadActivities();
    }
  },

  onPullDownRefresh() {
    // 下拉刷新
    this.loadActivities().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 检查登录态
  checkLogin() {
    const token = wx.getStorageSync('token');
    if (!token) {
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }

    const app = getApp();
    const userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo || {};
    this.setData({
      userInfo: userInfo
    });

    this.loadActivities();
  },

  // 加载活动列表
  async loadActivities() {
    showLoading('加载中...');
    try {
      const result = await getMyActivities('active');
      this.setData({
        activities: result.activities || []
      });
    } catch (error) {
      console.error('加载活动列表失败:', error);
      showError(error.message || '加载失败');
    } finally {
      hideLoading();
    }
  },

  // 跳转到个人中心
  goToProfile() {
    wx.switchTab({
      url: '/pages/user/profile'
    });
  },

  // 跳转到活动详情
  goToDetail(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activity/detail?id=${activityId}`
    });
  },

  // 显示创建活动弹窗
  showCreateModal() {
    this.setData({
      showCreate: true,
      activityName: ''
    });
  },

  // 隐藏创建活动弹窗
  hideCreateModal() {
    this.setData({
      showCreate: false
    });
  },

  // 显示加入活动弹窗
  showJoinModal() {
    this.setData({
      showJoin: true,
      inviteCode: ''
    });
  },

  // 隐藏加入活动弹窗
  hideJoinModal() {
    this.setData({
      showJoin: false
    });
  },

  // 阻止事件冒泡
  stopPropagation() {},

  // 活动名称输入
  onActivityNameInput(e) {
    this.setData({
      activityName: e.detail.value
    });
  },

  // 邀请码输入
  onInviteCodeInput(e) {
    let value = e.detail.value.toUpperCase();
    // 只允许输入大写字母和数字
    value = value.replace(/[^A-Z0-9]/g, '');
    this.setData({
      inviteCode: value
    });
  },

  // 创建活动
  async handleCreate() {
    const { activityName } = this.data;
    if (!activityName || activityName.trim() === '') {
      showError('请输入活动名称');
      return;
    }

    showLoading('创建中...');
    try {
      const result = await createActivity(activityName.trim());
      hideLoading();
      showSuccess('创建成功');
      this.hideCreateModal();
      
      // 跳转到活动详情页
      if (result.activityId) {
        wx.navigateTo({
          url: `/pages/activity/detail?id=${result.activityId}&needSelectTeam=true`
        });
      } else {
        // 刷新列表
        this.loadActivities();
      }
    } catch (error) {
      hideLoading();
      console.error('创建活动失败:', error);
      showError(error.message || '创建失败');
    }
  },

  // 加入活动
  async handleJoin() {
    const { inviteCode } = this.data;
    const error = validateInviteCode(inviteCode);
    if (error) {
      showError(error);
      return;
    }

    showLoading('加入中...');
    try {
      const result = await joinActivity(inviteCode);
      hideLoading();
      
      // 加入活动后，需要选择团队（创建或加入）
      if (result.activityId) {
        this.hideJoinModal();
        wx.navigateTo({
          url: `/pages/activity/detail?id=${result.activityId}&needSelectTeam=true`
        });
      } else {
        showSuccess('加入成功');
        this.hideJoinModal();
        this.loadActivities();
      }
    } catch (error) {
      hideLoading();
      console.error('加入活动失败:', error);
      showError(error.message || '加入失败');
    }
  }
});
