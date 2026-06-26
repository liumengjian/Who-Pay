const { updateUserInfo, changePassword } = require('../../utils/cloud.js');
const cloudStorage = require('../../utils/cloudStorage.js');
const { showLoading, hideLoading, showSuccess, showError, chooseImage } = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

Page({
  data: {
    userId: '',
    avatarUrl: '',
    profileBackground: '',
    nickName: '',
    bio: '',
    region: '',
    regionPickerValue: [],
    albumUrls: [],
    navHeight: 0,
    pwdDrawerShow: false,
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    pwdSubmitting: false,
    showOldPwd: false,
    showNewPwd: false,
    showConfirmPwd: false
  },

  onLoad() {
    this.setData({ navHeight: getNavTotalHeight() });
    const me = wx.getStorageSync('userInfo') || getApp().globalData.userInfo || {};
    const userId = String(me.id != null ? me.id : '');
    const albumUrls = Array.isArray(me.albumUrls) ? me.albumUrls.slice(0, 9) : [];
    this.setData({
      userId,
      avatarUrl: me.avatarUrl || me.avatar || '',
      profileBackground: String(me.profileBackground || '').trim(),
      nickName: me.nickName || '',
      bio: me.bio || '',
      region: me.region || '',
      regionPickerValue: [],
      albumUrls
    });
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    const g = getApp().globalData;
    if (g && Array.isArray(g.__albumUrlsResult)) {
      this.setData({ albumUrls: g.__albumUrlsResult.slice(0, 9) });
      g.__albumUrlsResult = null;
    }
  },

  onNick(e) {
    this.setData({ nickName: e.detail.value });
  },

  onBio(e) {
    this.setData({ bio: e.detail.value });
  },

  onRegion(e) {
    const v = e.detail.value || [];
    this.setData({
      regionPickerValue: v,
      region: v.length ? v.join(' ') : ''
    });
  },

  goAlbum() {
    getApp().globalData.__albumUrlsDraft = (this.data.albumUrls || []).slice();
    wx.navigateTo({ url: '/packageFriend/album/album' });
  },

  async pickAvatar() {
    try {
      const path = await chooseImage();
      await this.uploadAvatar(path);
    } catch (e) {
      if (e && e.errMsg && e.errMsg.indexOf('cancel') >= 0) return;
      showError('选择失败');
    }
  },

  async uploadAvatar(filePath) {
    showLoading('上传中');
    try {
      const id = this.data.userId;
      let avatar;
      if (cloudStorage.cloudReady()) {
        avatar = await cloudStorage.uploadLocalImage(
          filePath,
          `users/${id}/avatar_${Date.now()}.jpg`,
          { compressQuality: 78 }
        );
      } else {
        const { filePathToBase64Compressed } = require('../../utils/util.js');
        avatar = await filePathToBase64Compressed(filePath);
      }
      console.warn("+++",avatar)
      this.setData({ avatarUrl: avatar });
      showSuccess('头像已更新');
    } catch (e) {
      showError((e && e.message) || '上传失败');
    } finally {
      hideLoading();
    }
  },

  clearBackground(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    this.setData({ profileBackground: '' });
  },

  async pickBackground() {
    try {
      const path = await chooseImage();
      await this.uploadBackground(path);
    } catch (e) {
      if (e && e.errMsg && e.errMsg.indexOf('cancel') >= 0) return;
      showError('选择失败');
    }
  },

  async uploadBackground(filePath) {
    showLoading('上传中');
    try {
      const id = this.data.userId;
      let url;
      if (cloudStorage.cloudReady()) {
        url = await cloudStorage.uploadLocalImage(
          filePath,
          `users/${id}/profile_bg_${Date.now()}.jpg`,
          { compressQuality: 82 }
        );
      } else {
        const { filePathToBase64Compressed } = require('../../utils/util.js');
        url = await filePathToBase64Compressed(filePath);
      }
      this.setData({ profileBackground: url });
      showSuccess('背景已更新');
    } catch (e) {
      showError((e && e.message) || '上传失败');
    } finally {
      hideLoading();
    }
  },

  async saveAll() {
    const { userId, nickName, avatarUrl, profileBackground, bio, region, albumUrls } = this.data;
    if (!nickName || !String(nickName).trim()) {
      showError('请填写昵称');
      return;
    }
    showLoading('保存中');
    try {
      const albumJson = JSON.stringify((albumUrls || []).filter(Boolean).slice(0, 9));
      await updateUserInfo({
        id: userId,
        nickName: String(nickName).trim(),
        avatar: avatarUrl || '',
        profileBackground: profileBackground || '',
        bio: String(bio || '').trim(),
        region: String(region || '').trim(),
        albumJson
      });
      const prev = wx.getStorageSync('userInfo') || {};
      const next = {
        ...prev,
        nickName: String(nickName).trim(),
        avatarUrl,
        avatar: avatarUrl,
        profileBackground: profileBackground || '',
        bio: String(bio || '').trim(),
        region: String(region || '').trim(),
        albumUrls: JSON.parse(albumJson)
      };
      wx.setStorageSync('userInfo', next);
      getApp().setUserInfo(next);
      showSuccess('已保存');
      setTimeout(() => wx.navigateBack(), 400);
    } catch (e) {
      showError((e && e.message) || '保存失败');
    } finally {
      hideLoading();
    }
  },

  showPasswordDrawer() {
    this.setData({
      pwdDrawerShow: true,
      oldPassword: '',
      newPassword: '',
      confirmPassword: '',
      pwdSubmitting: false,
      showOldPwd: false,
      showNewPwd: false,
      showConfirmPwd: false
    });
  },

  closePasswordDrawer() {
    this.setData({ pwdDrawerShow: false });
  },

  onOldPassword(e) {
    this.setData({ oldPassword: e.detail.value });
  },

  onNewPassword(e) {
    this.setData({ newPassword: e.detail.value });
  },

  onConfirmPassword(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  toggleOldPwd() {
    this.setData({ showOldPwd: !this.data.showOldPwd });
  },

  toggleNewPwd() {
    this.setData({ showNewPwd: !this.data.showNewPwd });
  },

  toggleConfirmPwd() {
    this.setData({ showConfirmPwd: !this.data.showConfirmPwd });
  },

  async submitChangePassword() {
    const { oldPassword, newPassword, confirmPassword } = this.data;
    if (!oldPassword || !String(oldPassword).trim()) {
      showError('请输入原密码');
      return;
    }
    if (!newPassword || !String(newPassword).trim()) {
      showError('请输入新密码');
      return;
    }
    if (String(newPassword).trim().length < 6) {
      showError('新密码至少6位');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('两次新密码不一致');
      return;
    }
    if (oldPassword === newPassword) {
      showError('新密码不能与原密码相同');
      return;
    }

    this.setData({ pwdSubmitting: true });
    try {
      await changePassword(String(oldPassword).trim(), String(newPassword).trim());
      showSuccess('密码修改成功');
      this.setData({ pwdDrawerShow: false });
    } catch (e) {
      showError((e && e.message) || '修改失败');
    } finally {
      this.setData({ pwdSubmitting: false });
    }
  }
});
