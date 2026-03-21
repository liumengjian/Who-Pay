/**
 * Service 统一导出
 * 所有接口按业务模块组织，域名等配置在 config.js 中统一管理
 *
 * 使用示例：
 * const service = require('../../service');
 * await service.auth.login(account, password);
 * await service.user.getUserInfo(account);
 */

const auth = require('./auth.js');
const user = require('./user.js');
const activity = require('./activity.js');
const team = require('./team.js');
const payment = require('./payment.js');
const history = require('./history.js');

module.exports = {
  auth,
  user,
  activity,
  team,
  payment,
  history
};
