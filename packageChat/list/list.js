const friendApi = require('../../service/friend.js');
const { formatDateTime } = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

Page({
  data: {
    loading: true,
    chats: [],
    unreadCount: 0,
    navHeight: 0,
    triggered: false
  },

  _unsubWS: null,

  onLoad() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadData();
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadData();
    // Listen for real-time WS messages to refresh list
    const app = getApp();
    this._unsubWS = app.onWSMessage((data) => {
      if (data && data.type === 'message') {
        this.loadData();
      }
    });
  },

  onHide() {
    if (this._unsubWS) { this._unsubWS(); this._unsubWS = null; }
  },

  onUnload() {
    if (this._unsubWS) { this._unsubWS(); this._unsubWS = null; }
  },

  onPullRefresh() {
    this.setData({ triggered: true });
    this.loadData().finally(() => {
      this.setData({ triggered: false });
    });
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const [chatRes, unreadRes, friendRes] = await Promise.all([
        friendApi.getChatList(),
        friendApi.getUnreadCount(),
        friendApi.getFriendList().catch(() => ({ list: [] }))
      ]);
      // Build remark map from friend list
      const remarkMap = {};
      (friendRes.list || []).forEach((f) => {
        if (f.friendId != null && f.remark) {
          remarkMap[String(f.friendId)] = f.remark;
        }
      });
      this.setData({
        chats: (chatRes.list || []).map((c) => {
          const uid = String((c.user && c.user.id) != null ? c.user.id : '');
          const remark = remarkMap[uid] || '';
          return {
            ...c,
            _rowKey: uid,
            _remark: remark,
            lastTimeText:
              c.lastMessage && c.lastMessage.createTime
                ? formatDateTime(c.lastMessage.createTime)
                : ''
          };
        }),
        unreadCount: unreadRes.count || 0
      });
    } catch (e) {
      console.error('加载聊天列表失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  goToChat(e) {
    const user = e.currentTarget.dataset.user;
    if (!user || user.id == null) return;
    const displayName = this.data.chats.find(
      (c) => String(c.user && c.user.id) === String(user.id)
    )?._remark || user.nickName || user.username || '';
    wx.navigateTo({
      url: `/packageChat/detail/detail?friendId=${user.id}&nickName=${encodeURIComponent(displayName)}`
    });
  }
});