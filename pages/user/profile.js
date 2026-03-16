// pages/user/profile.js
const { updateUserInfo } = require('../../utils/cloud.js');
const { showLoading, hideLoading, showSuccess, showError, chooseImage, uploadImage, getUserProfile } = require('../../utils/util.js');

Page({
  data: {
    userInfo: {},
    showEditNickname: false,
    showEditAvatar: false,
    editNickname: ''
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

  // 从微信获取头像
  async getFromWechat() {
    try {
      const userProfile = await getUserProfile();
      if (userProfile && userProfile.avatarUrl) {
        // 直接使用微信头像URL，或下载后上传
        // 如果后端支持直接使用微信头像URL，可以直接传递
        // 否则需要下载后上传到自己的服务器
        const downloadRes = await new Promise((resolve, reject) => {
          wx.downloadFile({
            url: userProfile.avatarUrl,
            success: resolve,
            fail: reject
          });
        });

        if (downloadRes.tempFilePath) {
          await this.uploadAvatar(downloadRes.tempFilePath);
          // 同时更新昵称
          if (userProfile.nickName) {
            await this.updateUserInfo(userProfile.nickName, null);
          }
          this.hideEditAvatar();
        }
      }
    } catch (error) {
      if (error.errMsg && !error.errMsg.includes('cancel')) {
        console.error('获取微信头像失败:', error);
        showError('获取微信头像失败');
      }
    }
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
