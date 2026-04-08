// pages/activity/index.js
const {
  createActivity,
  joinActivity,
  getMyActivities,
  getActivityHall,
  getActivityPreview
} = require('../../utils/cloud.js');
const { showLoading, hideLoading, showSuccess, showError, validateInviteCode } = require('../../utils/util.js');

Page({
  data: {
    userInfo: {},
    mainTab: 'hall',
    hallActivities: [],
    myActivities: [],
    showCreate: false,
    showJoin: false,
    showHallDetail: false,
    hallPreview: null,
    hallActivityId: '',
    hallActivityName: '',
    hallActivityJoined: false,
    activityName: '',
    inviteCode: '',
    hallInviteInput: '',
    loadingHallPreview: false
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    if (wx.getStorageSync('token')) {
      const app = getApp();
      const userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo || {};
      this.setData({ userInfo });
      this.refreshAll();
    }
  },

  onPullDownRefresh() {
    this.refreshAll().finally(() => {
      wx.stopPullDownRefresh();
    });
  },

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

    this.refreshAll();
  },

  switchTabHall() {
    this.setData({ mainTab: 'hall' });
  },

  switchTabMine() {
    this.setData({ mainTab: 'mine' });
  },

  async refreshAll() {
    await Promise.all([this.loadHall(), this.loadMyActivities()]);
  },

  async loadHall() {
    try {
      const result = await getActivityHall();
      this.setData({
        hallActivities: result.activities || []
      });
    } catch (error) {
      console.error('加载活动大厅失败:', error);
      showError(error.message || '加载大厅失败');
    }
  },

  async loadMyActivities() {
    try {
      const result = await getMyActivities('active');
      this.setData({
        myActivities: result.activities || []
      });
    } catch (error) {
      console.error('加载我的活动失败:', error);
    }
  },

  isJoinedActivity(activityId) {
    const id = String(activityId);
    return (this.data.myActivities || []).some((a) => String(a._id) === id);
  },

  goToDetail(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activity/detail?id=${activityId}`
    });
  },

  showCreateModal() {
    this.setData({
      showCreate: true,
      activityName: ''
    });
  },

  hideCreateModal() {
    this.setData({
      showCreate: false
    });
  },

  showJoinModal() {
    this.setData({
      showJoin: true,
      inviteCode: ''
    });
  },

  hideJoinModal() {
    this.setData({
      showJoin: false
    });
  },

  hideHallDetailModal() {
    this.setData({
      showHallDetail: false,
      hallPreview: null,
      hallActivityId: '',
      hallActivityName: '',
      hallInviteInput: ''
    });
  },

  stopPropagation() {},

  async onOpenHallActivity(e) {
    const activityId = String(e.currentTarget.dataset.id);
    const name = e.currentTarget.dataset.name || '';
    const joined = this.isJoinedActivity(activityId);
    this.setData({
      showHallDetail: true,
      hallActivityId: activityId,
      hallActivityName: name,
      hallActivityJoined: joined,
      hallInviteInput: '',
      hallPreview: null,
      loadingHallPreview: true
    });
    try {
      const preview = await getActivityPreview(activityId);
      this.setData({
        hallPreview: preview,
        loadingHallPreview: false
      });
    } catch (err) {
      console.error(err);
      this.setData({ loadingHallPreview: false });
      showError(err.message || '加载活动详情失败');
    }
  },

  goHallToDetail() {
    const id = this.data.hallActivityId;
    if (!id) return;
    this.hideHallDetailModal();
    wx.navigateTo({
      url: `/pages/activity/detail?id=${id}`
    });
  },

  onHallInviteInput(e) {
    let value = e.detail.value.toUpperCase();
    value = value.replace(/[^A-Z0-9]/g, '');
    this.setData({
      hallInviteInput: value
    });
  },

  async handleHallJoinActivity() {
    const code = this.data.hallInviteInput;
    const err = validateInviteCode(code);
    if (err) {
      showError(err);
      return;
    }
    showLoading('加入中...');
    try {
      const result = await joinActivity(code);
      hideLoading();
      this.hideHallDetailModal();
      if (result.activityId) {
        wx.navigateTo({
          url: `/pages/activity/detail?id=${result.activityId}&needSelectTeam=true`
        });
      } else {
        showSuccess('加入成功');
        this.refreshAll();
      }
    } catch (error) {
      hideLoading();
      showError(error.message || '加入失败');
    }
  },

  onActivityNameInput(e) {
    this.setData({
      activityName: e.detail.value
    });
  },

  onInviteCodeInput(e) {
    let value = e.detail.value.toUpperCase();
    value = value.replace(/[^A-Z0-9]/g, '');
    this.setData({
      inviteCode: value
    });
  },

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
      const invite = result.inviteCode ? `，邀请码 ${result.inviteCode}` : '';
      showSuccess(`创建成功${invite}`);
      this.hideCreateModal();

      if (result.activityId) {
        wx.navigateTo({
          url: `/pages/activity/detail?id=${result.activityId}&needSelectTeam=true`
        });
      } else {
        this.refreshAll();
      }
    } catch (error) {
      hideLoading();
      console.error('创建活动失败:', error);
      showError(error.message || '创建失败');
    }
  },

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

      if (result.activityId) {
        this.hideJoinModal();
        wx.navigateTo({
          url: `/pages/activity/detail?id=${result.activityId}&needSelectTeam=true`
        });
      } else {
        showSuccess('加入成功');
        this.hideJoinModal();
        this.refreshAll();
      }
    } catch (error) {
      hideLoading();
      console.error('加入活动失败:', error);
      showError(error.message || '加入失败');
    }
  }
});
