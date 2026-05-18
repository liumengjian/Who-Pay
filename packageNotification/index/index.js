// packageNotification/index/index.js
const {
  getApplicationList,
  handleApplication,
  getMyApplications,
  cancelApplication,
  getSystemNotices,
  getFriendRequests,
  handleFriendRequest,
  getNotificationBadgeCount
} = require('../../utils/cloud.js');
const { showLoading, hideLoading, showSuccess, showError, formatDateTime } = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

Page({
  data: {
    messages: [],
    loading: true,
    navHeight: 0,
    triggered: false
  },

  onLoad() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadAll();
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadAll();
  },

  onRefresh() {
    this.loadAll().finally(() => {
      this.setData({ triggered: false });
    });
  },

  async loadAll() {
    this.setData({ loading: true });
    const [received, sent, system, friendRequests] = await Promise.all([
      this.loadReceived(),
      this.loadSent(),
      this.loadSystem(),
      this.loadFriendRequests()
    ]);
    const messages = [...friendRequests, ...received, ...sent, ...system].sort(
      (a, b) => new Date(b.createTimeRaw) - new Date(a.createTimeRaw)
    );
    this.setData({ messages, loading: false });
  },

  async loadSystem() {
    try {
      const result = await getSystemNotices();
      return (result.notices || []).map((n) => {
        const cat = n.category || 'version_update';
        let systemSubLabel = '通知';
        if (cat === 'onboarding') systemSubLabel = '新手指引';
        else if (cat === 'version_update') systemSubLabel = '版本更新';
        return {
          msgType: '系统通知',
          _id: `sys_${n.id}`,
          sysNoticeId: n.id,
          systemTitle: n.title,
          systemSubLabel,
          read: !!n.read,
          createTime: formatDateTime(n.createTime),
          createTimeRaw: n.createTime
        };
      });
    } catch (error) {
      console.error('加载系统通知失败:', error);
      return [];
    }
  },

  async loadFriendRequests() {
    try {
      const result = await getFriendRequests();
      const incoming = (result.list || []).map((req) => ({
        msgType: '好友申请',
        _id: `friend_in_${req.id}`,
        friendId: req.user.id,
        applicantAvatar: req.user.avatarUrl || '/images/default-avatar.png',
        applicantName: req.user.nickName || req.user.username,
        verifyMessage: req.verifyMessage || '',
        createTime: formatDateTime(req.createTime),
        createTimeRaw: req.createTime,
        status: req.status || 'pending',
        actionLabel: req.status === 'pending' ? '处理' : ''
      }));
      const outgoing = (result.sent || []).map((req) => ({
        msgType: '发出好友申请',
        _id: `friend_out_${req.id}`,
        targetAvatar: req.user.avatarUrl || '/images/default-avatar.png',
        targetName: req.user.nickName || req.user.username,
        verifyMessage: req.verifyMessage || '',
        createTime: formatDateTime(req.createTime),
        createTimeRaw: req.createTime,
        status: req.status || 'pending'
      }));
      return [...incoming, ...outgoing];
    } catch (error) {
      console.error('加载好友请求失败:', error);
      return [];
    }
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
        actionLabel: app.status === 'pending' || !app.status ? '处理' : ''
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

  goSystemNoticeDetail(e) {
    const id = e.currentTarget.dataset.id;
    if (id == null) return;
    wx.navigateTo({
      url: `/packageNotification/detail/detail?id=${id}`
    });
  },

  async handleApplication(e) {
    const { id, action, type } = e.currentTarget.dataset;
    const actionText = action === 'approve' ? '同意' : '拒绝';

    // 好友申请
    if (type === 'friend') {
      const friendId = id;
      wx.showModal({
        title: `确认${actionText}`,
        content: `确定要${actionText}该好友申请吗？`,
        success: async (res) => {
          if (!res.confirm) return;
          showLoading('处理中...');
          try {
            await handleFriendRequest(friendId, action === 'approve' ? 'accept' : 'reject');
            hideLoading();
            showSuccess(`已${actionText}`);
            await this.loadAll();
          } catch (error) {
            hideLoading();
            showError(error.message || '处理失败');
          }
        }
      });
      return;
    }

    // 活动申请
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