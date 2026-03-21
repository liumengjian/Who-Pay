/**
 * 支付相关接口
 */

const { request } = require('./request.js');

/**
 * 12. 支付金额
 * @param {string} account - 账号
 * @param {string} activityId - 活动id
 * @param {string} teamId - 团队id
 * @param {number} amount - 金额
 */
function addPayment(account, activityId, teamId, amount) {
  return request('/api/payment/add', 'POST', {
    account,
    activityId,
    teamId,
    amount: parseFloat(amount)
  });
}

module.exports = {
  addPayment
};
