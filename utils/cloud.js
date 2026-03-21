// utils/cloud.js - API调用封装（兼容层，新接口请使用 service/）
const { API_BASE_URL } = require('../service/config.js');

/**
 * 获取请求头
 */
function getHeaders() {
  const openid = wx.getStorageSync('openid');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (openid) {
    headers['Authorization'] = `Bearer ${openid}`;
  }
  return headers;
}

/**
 * 调用API接口
 */
function callAPI(path, method = 'GET', data = {}) {
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
 * 账号密码登录
 */
function loginWithAccount(account, password) {
  return callAPI('/api/auth/login', 'POST', {
    account,
    password
  });
}

/**
 * 账号密码注册
 */
function register(account, password, avatarUrl = '') {
  return callAPI('/api/auth/register', 'POST', {
    account,
    password,
    avatarUrl
  });
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
 */
function updateUserInfo(nickName, avatarUrl) {
  return callAPI('/api/user/update', 'POST', {
    nickName,
    avatarUrl
  });
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
