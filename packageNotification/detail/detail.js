const { getSystemNotice, markSystemNoticeRead } = require('../../utils/cloud.js');
const { showError } = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

Page({
  data: {
    loading: true,
    title: '',
    body: '',
    navHeight: 0
  },

  onLoad(options) {
    this.setData({ navHeight: getNavTotalHeight() });
    const id = options.id;
    if (!id) {
      showError('参数错误');
      this.setData({ loading: false });
      return;
    }
    this._noticeId = id;
    this.loadNotice();
  },

  async loadNotice() {
    const id = this._noticeId;
    try {
      const r = await getSystemNotice(id);
      const n = r.notice;
      if (!n) {
        showError('通知不存在');
        this.setData({ loading: false });
        return;
      }
      this.setData({
        loading: false,
        title: n.title || '',
        body: n.body || ''
      });
      if (!n.read) {
        try {
          await markSystemNoticeRead(id);
        } catch (e) {
          console.warn('标记已读失败', e);
        }
      }
    } catch (e) {
      this.setData({ loading: false });
      showError(e.message || '加载失败');
    }
  }
});
