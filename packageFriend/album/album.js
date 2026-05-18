const cloudStorage = require('../../utils/cloudStorage.js');
const { showLoading, hideLoading, showError } = require('../../utils/util.js');

Page({
  data: {
    urls: [],
    sortMode: false,
    sortFirst: -1
  },

  onLoad() {
    const draft = getApp().globalData.__albumUrlsDraft;
    const urls = Array.isArray(draft) ? draft.slice(0, 9) : [];
    this.setData({ urls });
  },

  toggleSort() {
    this.setData({
      sortMode: !this.data.sortMode,
      sortFirst: -1
    });
  },

  onCellTap(e) {
    if (!this.data.sortMode) return;
    const i = Number(e.currentTarget.dataset.i);
    if (Number.isNaN(i)) return;
    const { sortFirst, urls } = this.data;
    if (sortFirst < 0) {
      this.setData({ sortFirst: i });
      return;
    }
    if (sortFirst === i) {
      this.setData({ sortFirst: -1 });
      return;
    }
    const next = urls.slice();
    const t = next[sortFirst];
    next[sortFirst] = next[i];
    next[i] = t;
    this.setData({ urls: next, sortFirst: -1 });
  },

  onRemove(e) {
    const i = Number(e.currentTarget.dataset.i);
    if (Number.isNaN(i)) return;
    const urls = this.data.urls.filter((_, j) => j !== i);
    this.setData({ urls, sortFirst: -1 });
  },

  async onAdd() {
    const remain = 9 - this.data.urls.length;
    if (remain <= 0) return;
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album'],
      success: async (res) => {
        const files = (res.tempFiles || []).slice(0, remain);
        const uid = wx.getStorageSync('userId') || getApp().globalData.userId;
        showLoading('上传中');
        try {
          const urls = this.data.urls.slice();
          for (const f of files) {
            const p = f.tempFilePath;
            if (!p) continue;
            let url = p;
            if (cloudStorage.cloudReady()) {
              url = await cloudStorage.uploadLocalImage(
                p,
                `users/${uid}/album_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`,
                { compressQuality: 78 }
              );
            }
            urls.push(url);
          }
          this.setData({ urls: urls.slice(0, 9) });
        } catch (err) {
          showError((err && err.message) || '上传失败');
        } finally {
          hideLoading();
        }
      }
    });
  },

  done() {
    getApp().globalData.__albumUrlsResult = this.data.urls.slice(0, 9);
    wx.navigateBack();
  }
});
