/**
 * 活动笔记 API（独立文件，避免页面内从 cloud 解构 saveActivityNote 在真机上偶发为 undefined）
 */
const cloud = require('./cloud.js');

function saveActivityNote(activityId, body) {
  return cloud.callAPI(`/api/activity/${activityId}/note`, 'PUT', body || {});
}

module.exports = {
  saveActivityNote
};
