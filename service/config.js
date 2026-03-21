/**
 * API 配置 - 域名等统一变量
 * 可根据环境切换（开发/测试/生产）
 */

// API 基础域名，按环境自定义配置
const API_BASE_URL = 'https://www.pluto0.com';

// 上传接口基础地址（若与 API 一致可不单独配置）
const UPLOAD_BASE_URL = API_BASE_URL;

// 如需分环境，可在此扩展：
// const env = 'development'; // development | test | production
// const API_BASE_URL_MAP = {
//   development: 'http://localhost:3000',
//   test: 'https://test.example.com',
//   production: 'https://www.pluto0.com'
// };
// const API_BASE_URL = API_BASE_URL_MAP[env] || API_BASE_URL_MAP.production;

module.exports = {
  API_BASE_URL,
  UPLOAD_BASE_URL
};
