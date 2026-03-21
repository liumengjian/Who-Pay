/**
 * 统一请求封装
 * 基于 wx.request，自动拼接域名、携带 token
 */

const { API_BASE_URL } = require('./config.js');

/**
 * 获取请求头（含 token）
 */
function getHeaders() {
  const token = wx.getStorageSync('openid'); // 兼容现有逻辑，token 存于 openid
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * 发起 API 请求
 * @param {string} path - 接口路径（不含域名，如 /api/auth/login）
 * @param {string} method - GET | POST | PUT | DELETE
 * @param {object} data - 请求体/查询参数
 */
function request(path, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method: method,
      data: data,
      header: getHeaders(),
      success: res => {
        if (res.statusCode === 200) {
          if (res.data && res.data.success === false) {
            reject(new Error(res.data.message || '操作失败'));
          } else {
            resolve(res.data);
          }
        } else {
          reject(new Error(`请求失败: ${res.statusCode}`));
        }
      },
      fail: err => {
        console.error(`调用API ${path} 失败:`, err);
        reject(err);
      }
    });
  });
}

module.exports = {
  request,
  getHeaders
};
