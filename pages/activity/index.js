// pages/activity/index.js
const {
  createActivity,
  joinActivity,
  getMyActivities,
  getActivityHall,
  getActivityPreview
} = require('../../utils/cloud.js');
const { showLoading, hideLoading, showSuccess, showError, validateInviteCode, filePathToBase64 } = require('../../utils/util.js');

Page({
  data: {
    userInfo: {},
    mainTab: 'hall',
    hallActivities: [],
    hallDisplayList: [],
    hallSearchKeyword: '',
    myActivities: [],
    showCreate: false,
    showHallDetail: false,
    hallPreview: null,
    hallActivityId: '',
    hallActivityName: '',
    hallActivityJoined: false,
    activityName: '',
    activitySlogan: '',
    activityAvatarUrl: '',
    activityAvatarTempPath: '',
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

  applyHallSearchFilter() {
    const kw = (this.data.hallSearchKeyword || '').trim().toLowerCase();
    const all = this.data.hallActivities || [];
    const list = !kw ? all : all.filter((a) => (a.name || '').toLowerCase().includes(kw));
    this.setData({ hallDisplayList: list });
  },

  onHallSearchInput(e) {
    this.setData({ hallSearchKeyword: e.detail.value }, () => this.applyHallSearchFilter());
  },

  async loadHall() {
    try {
      const result = await getActivityHall();
      const list = result.activities || [];
      this.setData({
        hallActivities: list,
        hallSearchKeyword: ''
      }, () => this.applyHallSearchFilter());
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
    const ui = this.data.userInfo || {};
    const defAvatar = ui.avatarUrl || '/images/default-avatar.png';
    this.setData({
      showCreate: true,
      activityName: '',
      activitySlogan: '',
      activityAvatarUrl: defAvatar,
      activityAvatarTempPath: ''
    });
  },

  hideCreateModal() {
    this.setData({
      showCreate: false
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

  onActivitySloganInput(e) {
    this.setData({
      activitySlogan: e.detail.value
    });
  },

  onChooseActivityAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      activityAvatarUrl: avatarUrl,
      activityAvatarTempPath: avatarUrl
    });
  },

  async handleCreate() {
    const { activityName, activitySlogan, activityAvatarTempPath } = this.data;
    if (!activityName || activityName.trim() === '') {
      showError('请输入活动名称');
      return;
    }

    showLoading('创建中...');
    try {
      const payload = {
        name: activityName.trim(),
        slogan: (activitySlogan || '').trim()
      };
      if (activityAvatarTempPath) {
        try {
          payload.avatar = await filePathToBase64(activityAvatarTempPath);
        } catch (err) {
          console.warn('活动头像读取失败:', err);
        }
      }
      const result = await createActivity(payload);
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

});
