/**
 * 活动相关接口
 */

const { request } = require('./request.js');

/**
 * 5. 查询已加入的活动
 * @param {string} accountId - 账号id
 */
function getJoinedActivities(accountId) {
  return request(`/api/activity/pageHistory`, 'GET');
}

/**
 * 6. 创建活动
 * @param {string} name - 活动名称
 * @param {string} inviteCode - 邀请码（唯一）
 */
function createActivity(name, inviteCode) {
  return request('/api/activity/save', 'POST', { name, inviteCode });
}

/**
 * 7. 加入活动
 * @param {string} account - 账号
 * @param {string} activityId - 活动id
 */
function joinActivity(account, activityId) {
  return request('/api/activity/join', 'POST', { account, activityId });
}

/**
 * 8. 查询活动下的团队
 * @param {string} activityId - 活动id
 */
function getActivityTeams(activityId) {
  return request(`/api/activity/${activityId}/teams`, 'GET');
}

module.exports = {
  getJoinedActivities,
  createActivity,
  joinActivity,
  getActivityTeams
};
