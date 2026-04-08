// utils/cloud.js - API 调用（与 service/request 一致：支持云托管 callContainer）
const { request: httpRequest } = require('../service/request.js');

function callAPI(path, method = 'GET', data = {}) {
  return httpRequest(path, method, data);
}

/**
 * 登录 - 获取openid和用户信息（原手机号方式，保留兼容）
 */
function login(code, encryptedData, iv) {
  return callAPI('/api/login', 'POST', {
    code,
    encryptedData,
    iv
  });
}

/**
 * 账号密码登录（password 需已 MD5 加密）
 */
function loginWithAccount(username, password) {
  return callAPI('/api/auth/login', 'POST', {
    username,
    password
  });
}

/**
 * 账号密码注册
 * @param {object} params - { username, password(MD5), nickName, realName, avatar }
 */
function register(params) {
  return callAPI('/api/auth/register', 'POST', params);
}

/**
 * 创建活动
 */
function createActivity(name) {
  return callAPI('/api/activity/create', 'POST', {
    name
  });
}

/**
 * 加入活动
 */
function joinActivity(inviteCode) {
  return callAPI('/api/activity/join', 'POST', {
    inviteCode
  });
}

/**
 * 获取活动详情
 */
function getActivityDetail(activityId) {
  return callAPI(`/api/activity/${activityId}`, 'GET');
}

/**
 * 添加支付记录
 */
function addPayment(activityId, amount, remark = '') {
  return callAPI('/api/payment/add', 'POST', {
    activityId,
    amount: parseFloat(amount),
    remark
  });
}

/**
 * 更新支付记录
 */
function updatePayment(paymentId, amount, remark = '') {
  return callAPI(`/api/payment/${paymentId}`, 'PUT', {
    amount: parseFloat(amount),
    remark
  });
}

/**
 * 删除支付记录
 */
function deletePayment(paymentId) {
  return callAPI(`/api/payment/${paymentId}`, 'DELETE');
}

/**
 * 结束活动
 */
function endActivity(activityId) {
  return callAPI(`/api/activity/${activityId}/end`, 'POST');
}

/**
 * 更新用户信息
 * @param {object} params - { id, avatar?, nickName?, realName? }
 */
function updateUserInfo(params) {
  return callAPI('/api/user/update', 'PUT', params);
}

/**
 * 获取用户参与的活动列表
 */
function getMyActivities(status = 'active') {
  return callAPI(`/api/activity/list?status=${status}`, 'GET');
}

/**
 * 获取用户的支付记录列表
 */
function getMyPayments(activityId) {
  return callAPI(`/api/payment/list?activityId=${activityId}`, 'GET');
}

/**
 * 获取指定成员在活动中的支付记录
 */
function getMemberPayments(activityId, userId) {
  return callAPI(`/api/payment/member?activityId=${activityId}&userId=${userId}`, 'GET');
}

/**
 * 创建新团队
 */
function createTeam(activityId, teamName) {
  return callAPI('/api/team/create', 'POST', {
    activityId,
    teamName
  });
}

/**
 * 加入现有团队
 */
function joinTeam(activityId, teamId) {
  return callAPI('/api/team/join', 'POST', {
    activityId,
    teamId
  });
}

// 导出函数
module.exports = {
  callAPI,
  login,
  loginWithAccount,
  register,
  createActivity,
  joinActivity,
  getActivityDetail,
  addPayment,
  updatePayment,
  deletePayment,
  endActivity,
  updateUserInfo,
  getMyActivities,
  getMyPayments,
  getMemberPayments,
  createTeam,
  joinTeam
};
