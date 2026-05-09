// pages/activity/index.js
const {
  createActivity,
  joinActivity,
  getMyActivities,
  getActivityHall,
  getActivityPreview,
  applyForJoin
} = require('../../utils/cloud.js');
const cloudStorage = require('../../utils/cloudStorage.js');
const { showLoading, hideLoading, showSuccess, showError, validateInviteCode, filePathToBase64Compressed } = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

const HALL_PAGE_SIZE = 20;

Page({
  data: {
    userInfo: {},
    mainTab: 'hall',
    mainTabIndex: 0,
    hallActivities: [],
    hallDisplayList: [],
    hallSearchKeyword: '',
    hallPageOffset: 0,
    hallHasMore: true,
    hallLoadingMore: false,
    myActivities: [],
    showCreate: false,
    showHallDetail: false,
    hallPreview: null,
    hallActivityId: '',
    hallActivityName: '',
    hallActivityJoined: false,
    hallApplicationSent: false,
    activityName: '',
    activitySlogan: '',
    activityAvatarUrl: '',
    activityAvatarTempPath: '',
    hallInviteInput: '',
    loadingHallPreview: false,
    triggered: false,
    navHeight: 0
  },

  onLoad() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.checkLogin();
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    if (wx.getStorageSync('token')) {
      const app = getApp();
      const userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo || {};
      this.setData({ userInfo });
      this.refreshAll();
    }
  },

  onRefresh() {
    this.refreshAll().finally(() => {
      this.setData({ triggered: false });
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
    this.setData({ mainTab: 'hall', mainTabIndex: 0 });
  },

  switchTabMine() {
    this.setData({ mainTab: 'mine', mainTabIndex: 1 });
  },

  onMainTabSwiperChange(e) {
    const cur = e.detail.current;
    const tab = cur === 0 ? 'hall' : 'mine';
    this.setData({ mainTabIndex: cur, mainTab: tab });
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

  async loadHall(reset = true) {
    if (this._hallFetching) return;
    if (!reset) {
      if (!this.data.hallHasMore || this.data.hallLoadingMore) return;
      if ((this.data.hallActivities || []).length === 0) return;
    }
    this._hallFetching = true;
    if (reset) {
      this.setData({ hallHasMore: true });
    }
    const offset = reset ? 0 : this.data.hallPageOffset;
    if (!reset) {
      this.setData({ hallLoadingMore: true });
    }
    try {
      const result = await getActivityHall({ offset, limit: HALL_PAGE_SIZE });
      const batch = result.activities || [];
      const hasMore =
        typeof result.hasMore === 'boolean'
          ? result.hasMore
          : batch.length >= HALL_PAGE_SIZE;
      const merged = reset
        ? batch
        : (this.data.hallActivities || []).concat(batch);
      this.setData(
        {
          hallActivities: merged,
          hallPageOffset: offset + batch.length,
          hallHasMore: hasMore,
          ...(reset ? { hallSearchKeyword: '' } : {})
        },
        () => this.applyHallSearchFilter()
      );
    } catch (error) {
      console.error('加载活动大厅失败:', error);
      showError(error.message || '加载大厅失败');
    } finally {
      this._hallFetching = false;
      if (!reset) {
        this.setData({ hallLoadingMore: false });
      }
    }
  },

  onHallScrollToLower() {
    if (this.data.mainTab !== 'hall') return;
    this.loadHall(false);
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
  preventTouchMove() {},

  async onOpenHallActivity(e) {
    const activityId = String(e.currentTarget.dataset.id);
    const name = e.currentTarget.dataset.name || '';
    const joined = this.isJoinedActivity(activityId);
    if (joined) {
      wx.navigateTo({
        url: `/pages/activity/detail?id=${activityId}`
      });
      return;
    }
    this.setData({
      showHallDetail: true,
      hallActivityId: activityId,
      hallActivityName: name,
      hallActivityJoined: joined,
      hallApplicationSent: false,
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

  async handleHallApplyActivity() {
    const activityId = this.data.hallActivityId;
    if (!activityId) return;
    showLoading('申请中...');
    try {
      await applyForJoin(activityId, 'activity', null);
      hideLoading();
      showSuccess('申请已发送，请等待审批');
      this.setData({ hallApplicationSent: true });
    } catch (error) {
      hideLoading();
      showError(error.message || '申请失败');
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
          if (cloudStorage.cloudReady()) {
            payload.avatar = await cloudStorage.uploadLocalImage(
              activityAvatarTempPath,
              `activities/new/cover_${Date.now()}.jpg`,
              { compressQuality: 78 }
            );
          } else {
            payload.avatar = await filePathToBase64Compressed(activityAvatarTempPath);
          }
        } catch (err) {
          console.warn('活动头像上传失败，尝试 base64:', err);
          try {
            payload.avatar = await filePathToBase64Compressed(activityAvatarTempPath);
          } catch (e2) {
            console.warn('活动头像读取失败:', e2);
          }
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
