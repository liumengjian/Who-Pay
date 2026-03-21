// utils/util.js - 工具函数

/**
 * 格式化金额（保留两位小数）
 */
function formatAmount(amount) {
  if (amount === null || amount === undefined) {
    return '0.00';
  }
  return parseFloat(amount).toFixed(2);
}

/**
 * 格式化日期时间
 */
function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * 格式化日期
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 显示成功提示
 */
function showSuccess(title) {
  wx.showToast({
    title: title,
    icon: 'success',
    duration: 2000
  });
}

/**
 * 显示错误提示
 */
function showError(title) {
  wx.showToast({
    title: title,
    icon: 'none',
    duration: 2000
  });
}

/**
 * 显示加载中
 */
function showLoading(title = '加载中...') {
  wx.showLoading({
    title: title,
    mask: true
  });
}

/**
 * 隐藏加载
 */
function hideLoading() {
  wx.hideLoading();
}

/**
 * 复制到剪贴板
 */
function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    wx.setClipboardData({
      data: text,
      success: () => {
        showSuccess('已复制');
        resolve();
      },
      fail: reject
    });
  });
}

/**
 * 将本地文件路径转为 base64 字符串（含 data URI 前缀）
 * @param {string} filePath - 本地临时文件路径
 * @returns {Promise<string>} data:image/xxx;base64,xxxx
 */
function filePathToBase64(filePath) {
  return new Promise((resolve, reject) => {
    const ext = (filePath.split('.').pop() || 'png').toLowerCase();
    const mimeMap = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', gif: 'gif', webp: 'webp' };
    const mime = `image/${mimeMap[ext] || 'png'}`;
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'base64',
      success: res => resolve(`data:${mime};base64,${res.data}`),
      fail: reject
    });
  });
}

/**
 * 选择图片（从相册或拍照）
 */
function chooseImage() {
  return new Promise((resolve, reject) => {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        resolve(res.tempFilePaths[0]);
      },
      fail: reject
    });
  });
}

/**
 * 获取微信头像和昵称
 */
function getUserProfile() {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: res => {
        resolve({
          nickName: res.userInfo.nickName,
          avatarUrl: res.userInfo.avatarUrl
        });
      },
      fail: reject
    });
  });
}

/**
 * 验证金额格式
 */
function validateAmount(amount) {
  if (!amount || amount === '') {
    return '请输入金额';
  }
  const num = parseFloat(amount);
  if (isNaN(num)) {
    return '金额格式不正确';
  }
  if (num <= 0) {
    return '金额必须大于0';
  }
  if (num > 999999) {
    return '金额过大';
  }
  return '';
}

/**
 * 验证邀请码格式
 */
function validateInviteCode(code) {
  if (!code || code === '') {
    return '请输入邀请码';
  }
  if (code.length !== 6) {
    return '邀请码为6位';
  }
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return '邀请码格式不正确（大写字母+数字）';
  }
  return '';
}

// 导出所有函数
module.exports = {
  formatAmount,
  formatDateTime,
  formatDate,
  showSuccess,
  showError,
  showLoading,
  hideLoading,
  copyToClipboard,
  chooseImage,
  getUserProfile,
  validateAmount,
  validateInviteCode,
  filePathToBase64
};
