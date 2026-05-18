const friendApi = require('../../service/friend.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

Page({
  data: {
    loading: true,
    friendsAll: [],
    friends: [],
    friendSearch: '',
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

  onFriendSearch(e) {
    const friendSearch = e.detail.value || '';
    this.setData({ friendSearch });
    this.applyFilter(friendSearch, this.data.friendsAll);
  },

  applyFilter(q, list) {
    const needle = norm(q);
    if (!needle) {
      this.setData({ friends: list });
      return;
    }
    const friends = (list || []).filter((f) => {
      return (
        norm(f.username).includes(needle) ||
        norm(f.nickName).includes(needle) ||
        norm(f.remark).includes(needle) ||
        norm(f.displayName).includes(needle)
      );
    });
    this.setData({ friends });
  },

  async loadData() {
    this.setData({ loading: true });
    try {
      const res = await friendApi.getFriendList();
      const friendsAll = res.list || [];
      this.setData({ friendsAll });
      this.applyFilter(this.data.friendSearch, friendsAll);
    } catch (e) {
      console.error('加载好友失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  goToAdd() {
    wx.navigateTo({ url: '/packageFriend/add/add' });
  },

  goToUserHome(e) {
    const user = e.currentTarget.dataset.user;
    if (!user || user.id == null) return;
    wx.navigateTo({ url: `/packageFriend/home/home?id=${user.id}` });
  }
});
