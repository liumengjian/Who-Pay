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

  onLoad() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadData();
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadData();
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
      const [chatRes, unreadRes] = await Promise.all([
        friendApi.getChatList(),
        friendApi.getUnreadCount()
      ]);
      this.setData({
        chats: (chatRes.list || []).map((c) => ({
          ...c,
          _rowKey: String((c.user && c.user.id) != null ? c.user.id : ''),
          lastTimeText:
            c.lastMessage && c.lastMessage.createTime
              ? formatDateTime(c.lastMessage.createTime)
              : ''
        })),
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
    wx.navigateTo({
      url: `/packageChat/detail/detail?friendId=${user.id}&nickName=${encodeURIComponent(user.nickName || user.username || '')}`
    });
  }
});