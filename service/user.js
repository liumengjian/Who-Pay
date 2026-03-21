/**
 * 用户相关接口
 */

const { request } = require('./request.js');

/**
 * 3. 查询个人信息
 * @param {string} account - 账号
 * @returns {Promise<{account, nickName, avatarUrl}>}
 */
function getUserInfo(account) {
  return request(`/api/user/info?account=${encodeURIComponent(account)}`, 'GET');
}

/**
 * 4. 修改个人信息
 * @param {object} fields - 要修改的字段，如 { nickName, avatarUrl }
 */
function updateUserInfo(fields) {
  return request('/api/user/update', 'POST', fields);
}

module.exports = {
  getUserInfo,
  updateUserInfo
};
