/**
 * 团队相关接口
 */

const { request } = require('./request.js');

/**
 * 9. 创建团队
 * @param {string} activityId - 活动id
 * @param {string} teamName - 团队名称
 * @param {string} inviteCode - 邀请码（唯一）
 */
function createTeam(activityId, teamName, inviteCode) {
  return request('/api/team/create', 'POST', { activityId, teamName, inviteCode });
}

/**
 * 10. 加入团队
 * @param {string} account - 账号
 * @param {string} activityId - 活动id
 * @param {string} teamId - 团队id
 */
function joinTeam(account, activityId, teamId) {
  return request('/api/team/join', 'POST', { account, activityId, teamId });
}

/**
 * 11. 查询某活动某团队下已有的成员
 * @param {string} activityId - 活动id
 * @param {string} teamId - 团队id
 */
function getTeamMembers(activityId, teamId) {
  return request(`/api/activity/${activityId}/team/${teamId}/members`, 'GET');
}

module.exports = {
  createTeam,
  joinTeam,
  getTeamMembers
};
