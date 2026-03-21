/**
 * 历史记录相关接口
 */

const { request } = require('./request.js');

/**
 * 13. 查询历史活动
 * @param {string} account - 账号
 */
function getHistoryActivities(account) {
  return request(`/api/history/activities?account=${encodeURIComponent(account)}`, 'GET');
}

/**
 * 14. 查询历史支付金额
 * @param {string} account - 账号
 */
function getHistoryPayments(account) {
  return request(`/api/history/payments?account=${encodeURIComponent(account)}`, 'GET');
}

module.exports = {
  getHistoryActivities,
  getHistoryPayments
};
