const friendApi = require('../../service/friend.js');
const cloudStorage = require('../../utils/cloudStorage.js');
const { CLOUD_ENV, CLOUD_SERVICE } = require('../../service/config.js');
const { showLoading, hideLoading, showError } = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

const PAGE_SIZE = 25;

function parseBubble(msg) {
  const type = msg.type || 'text';
  if (type === 'text' || type === 'system') {
    return { kind: 'text', text: String(msg.content || '') };
  }
  if (type === 'image') {
    const c = String(msg.content || '').trim();
    if (c.startsWith('{')) {
      try {
        const j = JSON.parse(c);
        if (j.url) return { kind: 'image', url: j.url };
      } catch (e) {}
    }
    return { kind: 'image', url: c };
  }
  try {
    const j = JSON.parse(msg.content || '{}');
    if ((type === 'location' || j.kind === 'location') && j.lat != null && j.lng != null) {
      return {
        kind: 'location',
        lat: Number(j.lat),
        lng: Number(j.lng),
        name: j.name || '',
        address: j.address || ''
      };
    }
    if (type === 'attachment' || j.kind === 'attach' || j.kind === 'attachment') {
      return { kind: 'attachment', url: j.url || '', name: j.name || '附件' };
    }
  } catch (e) {}
  return { kind: 'text', text: '[消息]' };
}

Page({
  data: {
    friendId: '',
    friendName: '',
    friendAvatar: '',
    myId: '',
    myAvatar: '',
    messages: [],
    inputText: '',
    scrollTop: 0,
    scrollIntoView: '',
    connected: false,
    messagesHeight: 0,
    keyboardHeight: 0,
    safeBottom: 0,
    showExtra: false,
    loadingMore: false,
    hasMore: false,
    navHeight: 0,
    navTitle: ''
  },

  onLoad(options) {
    const friendId = String(options.friendId != null ? options.friendId : '').trim();
    const friendName = decodeURIComponent(options.nickName || '');
    const userInfo = wx.getStorageSync('userInfo') || {};

    const sys = wx.getSystemInfoSync();
    const safeBottom = (sys.safeAreaInsets && sys.safeAreaInsets.bottom) || 0;
    const navPx = getNavTotalHeight();
    this._inputBarPx = 96 + safeBottom;
    this._winHeight = sys.windowHeight - navPx;
    this._extraPanelPx = 0;

    const title = (friendName && friendName.trim()) || '聊天';

    this.setData({
      friendId,
      friendName,
      myId: String(userInfo.id != null ? userInfo.id : ''),
      myAvatar: userInfo.avatarUrl || '',
      safeBottom,
      navHeight: navPx,
      navTitle: title,
      messagesHeight: Math.max(120, this._winHeight - this._inputBarPx - safeBottom)
    });

    this._onKbHeight = (res) => {
      const kh = res && res.height ? res.height : 0;
      this.applyDockLayout(kh);
    };
    wx.onKeyboardHeightChange(this._onKbHeight);

    this.loadHistory();
    this.loadPeer();
  },

  onShow() {
    const sys = wx.getSystemInfoSync();
    const navPx = getNavTotalHeight();
    this._winHeight = sys.windowHeight - navPx;
    this.setData({ navHeight: navPx });
    this.applyDockLayout(this.data.keyboardHeight);
    if (!this.data.connected) {
      this.connectWS();
    }
  },

  onUnload() {
    if (this._onKbHeight) {
      wx.offKeyboardHeightChange(this._onKbHeight);
      this._onKbHeight = null;
    }
    if (this.socketTask) {
      this.socketTask.close();
    }
  },

  applyDockLayout(keyboardHeight, showExtraOverride) {
    const showExtra =
      showExtraOverride !== undefined ? showExtraOverride : this.data.showExtra;
    const extra = showExtra ? this._extraPanelPx : 0;
    const kh = keyboardHeight || 0;
    const bottomInset = kh > 0 ? 0 : this.data.safeBottom;
    const dock = this._inputBarPx + extra + kh + bottomInset;
    const h = Math.max(120, this._winHeight - dock);
    console.warn("+++",this._winHeight,dock, this._inputBarPx, extra, kh, bottomInset )
    this.setData({ keyboardHeight: kh, messagesHeight: h });
    this.scrollToBottom();
  },

  async loadPeer() {
    const { friendId } = this.data;
    if (!friendId) return;
    try {
      const r = await friendApi.getUserProfile(friendId);
      if (r && r.user) {
        const u = r.user;
        const peerTitle = (u.nickName && u.nickName.trim()) || u.username || '聊天';
        this.setData({
          friendAvatar: u.avatarUrl || '',
          friendName: u.nickName || u.username || '',
          navTitle: peerTitle
        });
      }
    } catch (e) {
      console.warn('loadPeer', e);
    }
  },

  toggleExtra() {
    const show = !this.data.showExtra;
    const sys = wx.getSystemInfoSync();
    if (show) {
      this._extraPanelPx = 90;
    } else {
      this._extraPanelPx = 0;
    }
    this.setData({ showExtra: show });
    this.applyDockLayout(this.data.keyboardHeight, show);
  },

  decorateMessages(raw) {
    return (raw || []).map((m) => ({ ...m, bubble: parseBubble(m) }));
  },

  async loadHistory() {
    const { friendId } = this.data;
    if (!friendId) return;
    try {
      const res = await friendApi.getChatHistory(friendId, { limit: PAGE_SIZE });
      const list = this.decorateMessages(res.list || []);
      this.setData({
        messages: list,
        hasMore: !!res.hasMore,
        loadingMore: false
      });
      this.scrollToBottom();
    } catch (e) {
      console.error('加载历史消息失败', e);
    }
  },

  async onLoadMore() {
    if (this.data.loadingMore || !this.data.hasMore || !this.data.messages.length) return;
    const first = this.data.messages[0];
    if (!first || !first.id) return;
    this.setData({ loadingMore: true });
    try {
      const res = await friendApi.getChatHistory(this.data.friendId, {
        beforeId: first.id,
        limit: PAGE_SIZE
      });
      const older = this.decorateMessages(res.list || []);
      const anchor = first.id;
      this.setData({
        messages: [...older, ...this.data.messages],
        hasMore: !!res.hasMore,
        loadingMore: false,
        scrollIntoView: `anchor-${anchor}`
      });
    } catch (e) {
      this.setData({ loadingMore: false });
    }
  },

  connectWS() {
    const token = wx.getStorageSync('token');
    if (!token) {
      console.log('未登录，无法连接WebSocket');
      return;
    }

    wx.cloud.connectContainer({
      env: CLOUD_ENV,
      service: CLOUD_SERVICE,
      path: `/ws?token=${encodeURIComponent(token)}`,
      success: (res) => {
        this.socketTask = res.socketTask;

        this.socketTask.onOpen(() => {
          this.setData({ connected: true });
        });

        this.socketTask.onMessage((res) => {
          try {
            const data = JSON.parse(res.data);
            const fid = String(this.data.friendId || '');
            if (
              data.type === 'message' &&
              data.data &&
              String(data.data.senderId) === fid
            ) {
              const one = this.decorateMessages([data.data])[0];
              const messages = [...this.data.messages, one];
              this.setData({ messages });
              this.scrollToBottom();
            }
          } catch (e) {
            console.error('解析消息失败', e);
          }
        });

        this.socketTask.onClose(() => {
          this.setData({ connected: false });
        });

        this.socketTask.onError((res) => {
          console.error('WebSocket 错误', res);
        });
      },
      fail: (err) => {
        console.error('WebSocket 连接失败', err);
      }
    });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  async send() {
    const { friendId, inputText } = this.data;
    if (!inputText.trim() || !friendId) return;

    try {
      const res = await friendApi.sendMessage(friendId, inputText.trim(), 'text');
      const row = {
        id: res.id,
        senderId: this.data.myId,
        content: inputText.trim(),
        type: 'text',
        createTime: res.createTime
      };
      const one = this.decorateMessages([row])[0];
      const messages = [...this.data.messages, one];
      this.setData({ inputText: '', messages });
      this.scrollToBottom();
    } catch (e) {
      wx.showToast({ title: e.message || '发送失败', icon: 'none' });
    }
  },

  async pickExtraImage() {
    this._extraPanelPx = 0;
    this.setData({ showExtra: false });
    this.applyDockLayout(this.data.keyboardHeight, false);
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: async (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f || !f.tempFilePath) return;
        showLoading('发送中');
        try {
          let url = f.tempFilePath;
          if (cloudStorage.cloudReady()) {
            const uid = this.data.myId;
            url = await cloudStorage.uploadLocalImage(
              f.tempFilePath,
              `chat/${uid}/${Date.now()}.jpg`,
              { compressQuality: 78 }
            );
          }
          const r = await friendApi.sendMessage(this.data.friendId, url, 'image');
          const row = {
            id: r.id,
            senderId: this.data.myId,
            content: url,
            type: 'image',
            createTime: r.createTime
          };
          const one = this.decorateMessages([row])[0];
          this.setData({ messages: [...this.data.messages, one] });
          this.scrollToBottom();
        } catch (err) {
          showError((err && err.message) || '发送失败');
        } finally {
          hideLoading();
        }
      }
    });
  },

  pickExtraAttach() {
    this._extraPanelPx = 0;
    this.setData({ showExtra: false });
    this.applyDockLayout(this.data.keyboardHeight, false);
    if (!wx.chooseMessageFile) {
      showError('当前版本不支持附件');
      return;
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      success: async (res) => {
        const f = res.tempFiles && res.tempFiles[0];
        if (!f) return;
        const name = f.name || '附件';
        const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] || 'bin';
        showLoading('上传中');
        try {
          let fidUrl = f.path;
          if (cloudStorage.cloudReady()) {
            const uid = this.data.myId;
            fidUrl = await cloudStorage.migrateAttachmentUrlToCloudIfNeeded(
              f.path,
              `chat/${uid}/att_${Date.now()}.${ext}`
            );
          }
          const payload = JSON.stringify({
            kind: 'attach',
            url: fidUrl,
            name
          });
          const r = await friendApi.sendMessage(this.data.friendId, payload, 'attachment');
          const row = {
            id: r.id,
            senderId: this.data.myId,
            content: payload,
            type: 'attachment',
            createTime: r.createTime
          };
          const one = this.decorateMessages([row])[0];
          this.setData({ messages: [...this.data.messages, one] });
          this.scrollToBottom();
        } catch (err) {
          showError((err && err.message) || '发送失败');
        } finally {
          hideLoading();
        }
      }
    });
  },

  pickExtraLocation() {
    this._extraPanelPx = 0;
    this.setData({ showExtra: false });
    this.applyDockLayout(this.data.keyboardHeight, false);
    wx.chooseLocation({
      success: async (res) => {
        const payload = JSON.stringify({
          kind: 'location',
          lat: res.latitude,
          lng: res.longitude,
          name: res.name || '',
          address: res.address || ''
        });
        try {
          const r = await friendApi.sendMessage(this.data.friendId, payload, 'location');
          const row = {
            id: r.id,
            senderId: this.data.myId,
            content: payload,
            type: 'location',
            createTime: r.createTime
          };
          const one = this.decorateMessages([row])[0];
          this.setData({ messages: [...this.data.messages, one] });
          this.scrollToBottom();
        } catch (e) {
          wx.showToast({ title: (e && e.message) || '发送失败', icon: 'none' });
        }
      }
    });
  },

  onBubbleTap(e) {
    const msg = e.currentTarget.dataset.msg;
    if (!msg || !msg.bubble) return;
    const b = msg.bubble;
    if (b.kind === 'image' && b.url) {
      wx.previewImage({ urls: [b.url], current: b.url });
      return;
    }
    if (b.kind === 'attachment' && b.url) {
      this.previewAttachment(b.url);
      return;
    }
    if (b.kind === 'location') {
      wx.openLocation({
        latitude: b.lat,
        longitude: b.lng,
        name: b.name || '位置',
        address: b.address || ''
      });
    }
  },

  previewAttachment(url) {
    const raw = String(url || '').trim();
    const done = () => hideLoading();
    if (cloudStorage.isCloudFileId(raw)) {
      showLoading('打开中');
      cloudStorage
        .downloadNoteAttachmentToTempPath(raw)
        .then((p) => {
          done();
          wx.openDocument({
            filePath: p,
            showMenu: true,
            fail: () => showError('无法预览')
          });
        })
        .catch((e) => {
          done();
          showError((e && e.message) || '打开失败');
        });
      return;
    }
    showLoading('打开中');
    wx.downloadFile({
      url: raw,
      success: (r) => {
        done();
        if (r.statusCode === 200 && r.tempFilePath) {
          wx.openDocument({
            filePath: r.tempFilePath,
            showMenu: true,
            fail: () => showError('无法预览')
          });
        } else showError('下载失败');
      },
      fail: () => {
        done();
        showError('下载失败');
      }
    });
  },

  onAvatarTap(e) {
    const senderId = e.currentTarget.dataset.senderId;
    if (!senderId) return;
    if (String(senderId) === String(this.data.myId)) {
      wx.navigateTo({ url: '/packageFriend/home/home' });
    } else {
      wx.navigateTo({ url: `/packageFriend/home/home?id=${senderId}` });
    }
  },

  scrollToBottom() {
    setTimeout(() => {
      this.setData({ scrollIntoView: '', scrollTop: this.data.messages.length * 9999 });
    }, 80);
  }
});
