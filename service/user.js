/**
 * 用户相关接口
 */

const { request } = require('./request.js');

/**
 * 3. 查询个人信息（使用 userId）
 * @param {string|number} id - 用户 id（即 loginId）
 * @returns {Promise<{account, nickName, avatarUrl, realName?}>}
 */
function getUserInfo(id) {
  return request(`/api/user/${id}`, 'GET');
}

/**
 * 4. 修改个人信息
 * @param {object} params - { id, avatar?, nickName?, realName? }
 */
function updateUserInfo(params) {
  return request('/api/user/update', 'PUT', params);
}

module.exports = {
  getUserInfo,
  updateUserInfo
};
