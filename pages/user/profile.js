// pages/user/profile.js
const { updateUserInfo } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showSuccess, showError, chooseImage, uploadImage } = require('../../utils/util.js');

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
    defaultAvatars: DEFAULT_AVATARS
  },

  onLoad() {
    this.loadUserInfo();
  },

  onShow() {
    this.loadUserInfo();
  },

  // 加载用户信息
  loadUserInfo() {
    const app = getApp();
    const userInfo = wx.getStorageSync('userInfo') || app.globalData.userInfo || {};
    this.setData({
      userInfo: userInfo,
      editNickname: userInfo.nickName || ''
    });
  },

  // 编辑头像
  editAvatar() {
    this.setData({
      showEditAvatar: true
    });
  },

  // 隐藏编辑头像弹窗
  hideEditAvatar() {
    this.setData({
      showEditAvatar: false
    });
  },

  // 编辑昵称
  editNickname() {
    this.setData({
      showEditNickname: true,
      editNickname: this.data.userInfo.nickName || ''
    });
  },

  // 隐藏编辑昵称弹窗
  hideEditNickname() {
    this.setData({
      showEditNickname: false
    });
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      editNickname: e.detail.value
    });
  },

  // 从相册选择头像
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

  // 选择默认头像（包内文件需复制到临时路径后再上传）
  async selectDefaultAvatar(e) {
    const packagePath = e.currentTarget.dataset.url;
    if (!packagePath) return;

    showLoading('设置中...');
    try {
      const tempPath = await this.copyPackageFileToTemp(packagePath);
      const avatarUrl = await uploadImage(tempPath);
      await this.updateUserInfo(null, avatarUrl);
      this.hideEditAvatar();
    } catch (error) {
      console.error('设置默认头像失败:', error);
      showError(error.message || '设置失败');
    } finally {
      hideLoading();
    }
  },

  // 复制包内文件到临时目录（wx.uploadFile 需要可写路径）
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

  // 上传头像
  async uploadAvatar(filePath) {
    showLoading('上传中...');
    try {
      const avatarUrl = await uploadImage(filePath);
      
      // 更新用户信息
      await this.updateUserInfo(null, avatarUrl);
    } catch (error) {
      console.error('上传头像失败:', error);
      showError(error.message || '上传头像失败');
    } finally {
      hideLoading();
    }
  },

  // 更新用户信息
  async updateUserInfo(nickName, avatarUrl) {
    const currentUserInfo = this.data.userInfo;
    const newNickName = nickName !== null ? nickName : currentUserInfo.nickName;
    const newAvatarUrl = avatarUrl !== null ? avatarUrl : currentUserInfo.avatarUrl;

    try {
      await updateUserInfo(newNickName, newAvatarUrl);
      
      // 更新本地存储
      const updatedUserInfo = {
        ...currentUserInfo,
        nickName: newNickName,
        avatarUrl: newAvatarUrl
      };
      
      wx.setStorageSync('userInfo', updatedUserInfo);
      const app = getApp();
      app.setUserInfo(updatedUserInfo);
      
      this.setData({
        userInfo: updatedUserInfo
      });
      
      showSuccess('更新成功');
    } catch (error) {
      console.error('更新用户信息失败:', error);
      showError(error.message || '更新失败');
    }
  },

  // 更新昵称
  async handleUpdateNickname() {
    const { editNickname } = this.data;
    if (!editNickname || editNickname.trim() === '') {
      showError('请输入昵称');
      return;
    }

    await this.updateUserInfo(editNickname.trim(), null);
    this.hideEditNickname();
  },

  // 跳转到历史活动
  goToHistory() {
    wx.navigateTo({
      url: '/pages/history/list'
    });
  },

  // 跳转到支付记录管理（需要先选择活动）
  goToPaymentManage() {
    // 这里可以跳转到一个活动选择页面，或者直接显示当前活动的支付记录
    // 简化处理：提示用户从活动详情页进入
    showError('请从活动详情页进入支付记录管理');
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除本地存储
          wx.removeStorageSync('openid');
          wx.removeStorageSync('userInfo');
          
          const app = getApp();
          app.globalData.openid = null;
          app.globalData.userInfo = null;
          
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      }
    });
  },

  // 阻止事件冒泡
  stopPropagation() {}
});
