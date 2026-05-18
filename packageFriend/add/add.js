const friendApi = require('../../service/friend.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

Page({
  data: {
    keyword: '',
    results: [],
    searched: false,
    navHeight: 0
  },

  onLoad() {
    this.setData({ navHeight: getNavTotalHeight() });
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  async search() {
    const { keyword } = this.data;
    if (!keyword || keyword.length < 2) {
      wx.showToast({ title: '请输入至少2个字符', icon: 'none' });
      return;
    }
    try {
      const res = await friendApi.searchUsers(keyword);
      this.setData({ results: res.list || [], searched: true });
    } catch (e) {
      console.error('搜索失败', e);
      wx.showToast({ title: (e && e.message) || '搜索失败', icon: 'none' });
    }
  },

  goProfile(e) {
    const id = e.currentTarget.dataset.id;
    if (id == null) return;
    wx.navigateTo({ url: `/packageFriend/home/home?id=${id}` });
  }
});