// pages/user/profile.js
const { updateUserInfo, getApplicationList } = require('../../utils/cloud.js');
const cloudStorage = require('../../utils/cloudStorage.js');
const { showLoading, hideLoading, showSuccess, showError, chooseImage, filePathToBase64Compressed } = require('../../utils/util.js');
const { getNavTotalHeight } = require('../../utils/navHeight.js');

const DEFAULT_AVATARS = [
  '/images/default-user-photo/animal-_1.png',
  '/images/default-user-photo/animal-_2.png',
  '/images/default-user-photo/animal-_3.png',
  '/images/default-user-photo/animal-_4.png',
  '/images/default-user-photo/animal-_5.png',
  '/images/default-user-photo/animal-_6.png',
  '/images/default-user-photo/animal-_7.png',
  '/images/default-user-photo/animal-_8.png',
  '/images/default-user-photo/animal-_9.png',
  '/images/default-user-photo/animal-_10.png',
  '/images/default-user-photo/animal-_11.png',
  '/images/default-user-photo/animal-_12.png',
  '/images/default-user-photo/animal-_13.png',
  '/images/default-user-photo/animal-_14.png',
];

Page({
  data: {
    userInfo: {},
    showEditNickname: false,
    showEditAvatar: false,
    editNickname: '',
    defaultAvatars: DEFAULT_AVATARS,
    triggered: false,
    navHeight: 0
  },

  onLoad() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadUserInfo();
  },

  onShow() {
    this.setData({ navHeight: getNavTotalHeight() });
    this.loadUserInfo();
  },

  onRefresh() {
    this.loadUserInfo();
    this.setData({ triggered: false });
  },

  // 加载用户信息
  loadUserInfo() {
    const app = getApp();
    const userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo || {};
    this.setData({
      userInfo: userInfo,
      editNickname: userInfo.nickName || ''
    });
    this.migrateLegacyAvatarIfNeeded(userInfo);
  },

  /**
   * 历史 base64 头像迁移为云 fileID，写回服务端与本地缓存（失败则保持原样，不影响展示）。
   */
  async migrateLegacyAvatarIfNeeded(userInfo) {
    if (this._avatarMigrating) return;
    const userId = wx.getStorageSync('userId') || getApp().globalData.userId;
    if (!userId || userId === 'admin') return;
    const raw = (userInfo && (userInfo.avatarUrl || userInfo.avatar)) || '';
    if (!cloudStorage.needsMigrateToCloud(raw)) return;
    if (!cloudStorage.cloudReady()) return;
    const id =
      userInfo && userInfo.id != null && userInfo.id !== ''
        ? userInfo.id
        : parseInt(userId, 10) || userId;
    this._avatarMigrating = true;
    try {
      const newId = await cloudStorage.migrateImageUrlToCloudIfNeeded(
        raw,
        `users/${id}/avatar_mig_${Date.now()}.jpg`
      );
      if (!newId || newId === raw) return;
      await updateUserInfo({ id, avatar: newId });
      const updatedUserInfo = {
        ...userInfo,
        avatarUrl: newId,
        avatar: newId
      };
      wx.setStorageSync('userInfo', updatedUserInfo);
      getApp().setUserInfo(updatedUserInfo);
      this.setData({ userInfo: updatedUserInfo });
    } catch (e) {
      console.warn('[profile] 头像迁移失败', e);
    } finally {
      this._avatarMigrating = false;
    }
  },

  // 编辑头像
  editAvatar() {
    this.setData({ showEditAvatar: true });
  },

  hideEditAvatar() {
    this.setData({ showEditAvatar: false });
  },

  // 编辑昵称
  editNickname() {
    this.setData({
      showEditNickname: true,
      editNickname: this.data.userInfo.nickName || ''
    });
  },

  hideEditNickname() {
    this.setData({ showEditNickname: false });
  },

  onNicknameInput(e) {
    this.setData({ editNickname: e.detail.value });
  },

  async chooseFromAlbum() {
    try {
      const filePath = await chooseImage();
      await this.uploadAvatar(filePath);
      this.hideEditAvatar();
    } catch (error) {
      if (error.errMsg && !error.errMsg.includes('cancel')) {
        console.error('选择图片失败:', error);
        showError('选择图片失败');
      }
    }
  },

  async selectDefaultAvatar(e) {
    const packagePath = e.currentTarget.dataset.url;
    if (!packagePath) return;
    showLoading('设置中...');
    try {
      const tempPath = await this.copyPackageFileToTemp(packagePath);
      const userId = wx.getStorageSync('userId') || getApp().globalData.userId;
      const currentUserInfo = this.data.userInfo;
      const id =
        currentUserInfo.id != null && currentUserInfo.id !== ''
          ? currentUserInfo.id
          : parseInt(userId, 10) || userId;
      const prevAvatar = currentUserInfo.avatarUrl || currentUserInfo.avatar;
      let avatar;
      if (cloudStorage.cloudReady()) {
        avatar = await cloudStorage.uploadLocalImage(
          tempPath,
          `users/${id}/avatar_${Date.now()}.jpg`,
          { compressQuality: 78 }
        );
      } else {
        avatar = await filePathToBase64Compressed(tempPath);
      }
      await this.submitUpdateUserInfo({ avatar });
      if (
        cloudStorage.isCloudFileId(prevAvatar) &&
        cloudStorage.isCloudFileId(avatar) &&
        prevAvatar !== avatar
      ) {
        cloudStorage.deleteCloudFiles([prevAvatar]);
      }
      this.hideEditAvatar();
    } catch (error) {
      console.error('设置默认头像失败:', error);
      showError(error.message || '设置失败');
    } finally {
      hideLoading();
    }
  },

  copyPackageFileToTemp(packagePath) {
    return new Promise((resolve, reject) => {
      const ext = packagePath.split('.').pop() || 'png';
      const tempPath = `${wx.env.USER_DATA_PATH}/default_avatar_${Date.now()}.${ext}`;
      wx.getFileSystemManager().copyFile({
        srcPath: packagePath,
        destPath: tempPath,
        success: () => resolve(tempPath),
        fail: reject
      });
    });
  },

  async uploadAvatar(filePath) {
    showLoading('上传中...');
    try {
      const userId = wx.getStorageSync('userId') || getApp().globalData.userId;
      const currentUserInfo = this.data.userInfo;
      const id =
        currentUserInfo.id != null && currentUserInfo.id !== ''
          ? currentUserInfo.id
          : parseInt(userId, 10) || userId;
      const prevAvatar = currentUserInfo.avatarUrl || currentUserInfo.avatar;
      let avatar;
      if (cloudStorage.cloudReady()) {
        avatar = await cloudStorage.uploadLocalImage(
          filePath,
          `users/${id}/avatar_${Date.now()}.jpg`,
          { compressQuality: 78 }
        );
      } else {
        avatar = await filePathToBase64Compressed(filePath);
      }
      await this.submitUpdateUserInfo({ avatar });
      if (
        cloudStorage.isCloudFileId(prevAvatar) &&
        cloudStorage.isCloudFileId(avatar) &&
        prevAvatar !== avatar
      ) {
        cloudStorage.deleteCloudFiles([prevAvatar]);
      }
    } catch (error) {
      console.error('上传头像失败:', error);
      showError(error.message || '上传头像失败');
    } finally {
      hideLoading();
    }
  },

  async submitUpdateUserInfo(fields) {
    const userId = wx.getStorageSync('userId') || getApp().globalData.userId;
    const currentUserInfo = this.data.userInfo;
    if (!userId) {
      showError('未登录');
      return;
    }
    const id = currentUserInfo.id != null && currentUserInfo.id !== ''
      ? currentUserInfo.id
      : parseInt(userId, 10) || userId;
    const params = { id };
    if (fields.nickName !== undefined) params.nickName = fields.nickName;
    if (fields.avatar !== undefined) params.avatar = fields.avatar;
    try {
      await updateUserInfo(params);
      const updatedUserInfo = {
        ...currentUserInfo,
        ...(fields.nickName !== undefined && { nickName: fields.nickName }),
        ...(fields.avatar !== undefined && { avatarUrl: fields.avatar, avatar: fields.avatar })
      };
      wx.setStorageSync('userInfo', updatedUserInfo);
      getApp().setUserInfo(updatedUserInfo);
      this.setData({ userInfo: updatedUserInfo });
      showSuccess('更新成功');
    } catch (error) {
      console.error('更新用户信息失败:', error);
      showError(error.message || '更新失败');
    }
  },

  async handleUpdateNickname() {
    const { editNickname } = this.data;
    if (!editNickname || !editNickname.trim()) {
      showError('请输入昵称');
      return;
    }
    await this.submitUpdateUserInfo({ nickName: editNickname.trim() });
    this.hideEditNickname();
  },

  goToHistory() {
    wx.navigateTo({ url: '/pages/history/list' });
  },

  goToPaymentManage() {
    wx.navigateTo({ url: '/pages/payment/history' });
  },

  goToNotifications() {
    wx.navigateTo({ url: '/pages/notification/index' });
  },

  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync('token');
        wx.removeStorageSync('userId');
        wx.removeStorageSync('userInfo');
        const app = getApp();
        app.globalData.token = null;
        app.globalData.userId = null;
        app.globalData.userInfo = null;
        wx.reLaunch({ url: '/pages/login/login' });
      }
    });
  },

  stopPropagation() {}
});
