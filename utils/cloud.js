// utils/cloud.js - API 调用（与 service/request 一致：支持云托管 callContainer）
const { request: httpRequest } = require('../service/request.js');

function callAPI(path, method = 'GET', data = {}) {
  return httpRequest(path, method, data);
}

function login(code, encryptedData, iv) {
  return callAPI('/api/login', 'POST', {
    code,
    encryptedData,
    iv
  });
}

function loginWithAccount(username, password) {
  return callAPI('/api/auth/login', 'POST', {
    username,
    password
  });
}

function register(params) {
  return callAPI('/api/auth/register', 'POST', params);
}

/** 活动大厅（进行中活动，分页） @param {{ offset?: number, limit?: number, name?: string }} q */
function getActivityHall(q = {}) {
  const offset = typeof q.offset === 'number' && q.offset >= 0 ? q.offset : 0;
  const limit = typeof q.limit === 'number' && q.limit > 0 ? q.limit : 20;
  const params = { offset, limit };
  if (q.name) {
    params.name = q.name;
  }
  return callAPI('/api/activity/hall', 'GET', params);
}

/** 未加入也可查看：团队与成员预览 */
function getActivityPreview(activityId) {
  return callAPI(`/api/activity/${activityId}/preview`, 'GET');
}

/** @param {string|object} payload 活动名称字符串，或 { name, slogan?, avatar? } */
function createActivity(payload) {
  const body =
    typeof payload === 'string' ? { name: payload } : { ...payload };
  return callAPI('/api/activity/create', 'POST', body);
}

function joinActivity(inviteCode) {
  return callAPI('/api/activity/join', 'POST', {
    inviteCode
  });
}

function getActivityDetail(activityId) {
  return callAPI(`/api/activity/${activityId}`, 'GET');
}

/** 保存活动笔记（进行中、参与者可写） */
function saveActivityNote(activityId, body) {
  return callAPI(`/api/activity/${activityId}/note`, 'PUT', body || {});
}

/** 已参与者查看活动下团队列表（含团队邀请码） */
function getActivityTeams(activityId) {
  return callAPI(`/api/activity/${activityId}/teams`, 'GET');
}

/** 团队下的成员 */
function getTeamMembers(activityId, teamId) {
  return callAPI(`/api/team/${teamId}/members`, 'GET', {
    activityId
  });
}

function leaveActivity(activityId) {
  return callAPI(`/api/activity/${activityId}/leave`, 'POST', {});
}

function addPayment(username, activityId, teamId, amount, remark = '', splitParticipantIds) {
  const body = {
    username,
    activityId,
    teamId: parseInt(teamId, 10),
    amount: parseFloat(amount),
    remark
  };
  if (Array.isArray(splitParticipantIds)) {
    body.splitParticipantIds = splitParticipantIds;
  }
  return callAPI('/api/payment/add', 'POST', body);
}

function updatePayment(paymentId, amount, remark = '') {
  return callAPI(`/api/payment/${paymentId}`, 'PUT', {
    amount: parseFloat(amount),
    remark
  });
}

function endActivity(activityId) {
  return callAPI(`/api/activity/${activityId}/end`, 'POST');
}

/** 更新活动（仅创建者）：name / slogan / avatar */
function updateActivity(activityId, body) {
  return callAPI(`/api/activity/${activityId}`, 'PUT', body);
}

function updateUserInfo(params) {
  return callAPI('/api/user/update', 'PUT', params);
}

function getMyActivities(status = 'active') {
  return callAPI(`/api/activity/list?status=${status}`, 'GET');
}

function getMyPayments(activityId) {
  return callAPI(`/api/payment/list?activityId=${activityId}`, 'GET');
}

/** 历史支付流水 */
function getPaymentHistory(params = {}) {
  return callAPI('/api/payment/history', 'GET', params);
}

function getMemberPayments(activityId, userId) {
  return callAPI('/api/payment/member', 'GET', {
    activityId,
    userId
  });
}

/**
 * 获取活动下所有支付记录（按日期分组用）
 * @param {string} activityId - 活动id
 */
function getActivityPayments(activityId) {
  return callAPI(`/api/payment/activity/${activityId}`, 'GET');
}

/** 提交申请（活动/团队） */
function applyForJoin(activityId, targetType, targetId) {
  return callAPI('/api/application/apply', 'POST', {
    activityId,
    targetType,
    targetId
  });
}

/** 查询发给创建者的申请列表 */
function getApplicationList() {
  return callAPI('/api/application/list', 'GET');
}

/** 处理申请（同意/拒绝） */
function handleApplication(applicationId, action) {
  return callAPI('/api/application/handle', 'POST', {
    applicationId,
    action
  });
}

/** 删除支付记录 */
function deletePayment(paymentId) {
  return callAPI(`/api/payment/${paymentId}`, 'DELETE');
}

/** 查询当前用户发出的申请（申请人视角） */
function getMyApplications() {
  return callAPI('/api/application/my', 'GET');
}

/** 撤销申请（仅 pending 可撤销） */
function cancelApplication(applicationId) {
  return callAPI('/api/application/cancel', 'POST', { applicationId });
}

function createTeam(activityId, teamName) {
  return callAPI('/api/team/create', 'POST', {
    activityId,
    teamName
  });
}

/** 团队唯一邀请码加入 */
function joinTeamByInvite(activityId, inviteCode) {
  return callAPI('/api/team/join', 'POST', {
    activityId,
    inviteCode
  });
}

function dissolveTeam(teamId) {
  return callAPI(`/api/team/${teamId}/dissolve`, 'POST', {});
}

function updateTeam(teamId, teamName) {
  return callAPI(`/api/team/${teamId}`, 'PUT', { teamName });
}

function leaveTeam(teamId) {
  return callAPI(`/api/team/${teamId}/leave`, 'POST', {});
}

/** 一键均摊：服务端为每人写入均摊付款 / 均摊收款记录 */
function settleEqualShare(activityId) {
  return callAPI(`/api/activity/${activityId}/settle-equal-share`, 'POST', {});
}

function getNotificationBadgeCount() {
  return callAPI('/api/notifications/badge-count', 'GET');
}

function getSystemNotices() {
  return callAPI('/api/notifications/system/list', 'GET');
}

function getSystemNotice(id) {
  return callAPI(`/api/notifications/system/${id}`, 'GET');
}

function markSystemNoticeRead(id) {
  return callAPI(`/api/notifications/system/${id}/read`, 'POST', {});
}

function publishSystemNotice(title, body) {
  return callAPI('/api/admin/system-notice/publish', 'POST', { title, body });
}

function getOnboardingGuide() {
  return callAPI('/api/admin/onboarding-guide', 'GET');
}

function saveOnboardingGuide(bodyOrSections) {
  // 兼容字符串 body 或 { sections: [...] } 格式
  const payload = typeof bodyOrSections === 'string'
    ? { body: bodyOrSections }
    : bodyOrSections;
  return callAPI('/api/admin/onboarding-guide', 'PUT', payload);
}

// 好友相关
function getFriendList() {
  return callAPI('/api/friend/list', 'GET');
}

function getFriendRequests() {
  return callAPI('/api/friend/requests', 'GET');
}

function searchUsers(keyword) {
  return callAPI('/api/user/search', 'GET', { keyword });
}

function addFriend(friendId, extra = {}) {
  return callAPI('/api/friend/add', 'POST', {
    friendId,
    verifyMessage: extra.verifyMessage,
    remark: extra.remark
  });
}

function handleFriendRequest(friendId, action) {
  return callAPI('/api/friend/handle', 'POST', { friendId, action });
}

function removeFriend(friendId) {
  return callAPI(`/api/friend/${friendId}`, 'DELETE');
}

// 聊天相关
function sendMessage(receiverId, content, type = 'text') {
  return callAPI('/api/message/send', 'POST', { receiverId, content, type });
}

function getChatList() {
  return callAPI('/api/chat/list', 'GET');
}

function getChatHistory(friendId, opts = {}) {
  const lim = opts.limit != null ? opts.limit : 30;
  const q = { friendId, limit: lim };
  if (opts.beforeId != null && opts.beforeId !== '') {
    q.beforeId = opts.beforeId;
  }
  return callAPI('/api/chat/history', 'GET', q);
}

function getUnreadCount() {
  return callAPI('/api/chat/unread', 'GET');
}

function getUserProfile(targetId) {
  const id = encodeURIComponent(String(targetId));
  return callAPI(`/api/user/profile/${id}`, 'GET');
}

function updateFriendRemark(friendId, remark) {
  return callAPI('/api/friend/remark', 'PUT', { friendId, remark });
}

/** 创建者邀请好友加入活动（批量） */
function inviteFriendsToActivity(activityId, friendIds) {
  return callAPI(`/api/activity/${activityId}/invite-friends`, 'POST', { friendIds });
}

function clearChatWithFriend(friendId) {
  return callAPI('/api/chat/clear', 'POST', { friendId });
}

function changePassword(oldPassword, newPassword) {
  return callAPI('/api/user/change-password', 'PUT', { oldPassword, newPassword });
}

function updateMemberWeight(teamId, userId, weight) {
  return callAPI(`/api/team/${teamId}/member/${userId}/weight`, 'PUT', { weight });
}

module.exports = {
  callAPI,
  login,
  loginWithAccount,
  register,
  getActivityHall,
  getActivityPreview,
  createActivity,
  joinActivity,
  getActivityDetail,
  saveActivityNote,
  getActivityTeams,
  getTeamMembers,
  leaveActivity,
  addPayment,
  updatePayment,
  deletePayment,
  endActivity,
  updateActivity,
  updateUserInfo,
  getMyActivities,
  getMyPayments,
  getPaymentHistory,
  getMemberPayments,
  getActivityPayments,
  createTeam,
  joinTeamByInvite,
  dissolveTeam,
  updateTeam,
  leaveTeam,
  applyForJoin,
  getApplicationList,
  handleApplication,
  getMyApplications,
  cancelApplication,
  settleEqualShare,
  getNotificationBadgeCount,
  getSystemNotices,
  getSystemNotice,
  markSystemNoticeRead,
  publishSystemNotice,
  getOnboardingGuide,
  saveOnboardingGuide,
  getFriendList,
  getFriendRequests,
  searchUsers,
  addFriend,
  handleFriendRequest,
  removeFriend,
  sendMessage,
  getChatList,
  getChatHistory,
  getUnreadCount,
  getUserProfile,
  updateFriendRemark,
  clearChatWithFriend,
  inviteFriendsToActivity,
  changePassword,
  updateMemberWeight
};
