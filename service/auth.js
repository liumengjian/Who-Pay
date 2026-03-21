/**
 * 认证相关接口
 */

const { request } = require('./request.js');

/**
 * 1. 登录接口
 * @param {string} account - 账号
 * @param {string} password - 密码
 */
function login(account, password) {
  return request('/api/auth/login', 'POST', { account, password });
}

/**
 * 2. 注册接口
 * @param {string} account - 账号
 * @param {string} password - 密码
 * @param {string} [avatarUrl] - 头像URL（可选）
 */
function register(account, password, avatarUrl = '') {
  const data = { account, password };
  if (avatarUrl) data.avatarUrl = avatarUrl;
  return request('/api/auth/register', 'POST', data);
}

module.exports = {
  login,
  register
};
