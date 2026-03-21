/**
 * 认证相关接口
 */

const { request } = require('./request.js');

/**
 * 1. 登录接口（password 需已 MD5 加密）
 * @param {string} username - 账号
 * @param {string} password - 密码 MD5
 */
function login(username, password) {
  return request('/api/user/login', 'POST', { username, password });
}

/**
 * 2. 注册接口
 * @param {object} params - { username, password(MD5), nickName, realName, avatar? }
 */
function register(params) {
  return request('/api/user/register', 'POST', params);
}

module.exports = {
  login,
  register
};
