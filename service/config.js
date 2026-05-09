/**
 * API 配置 - 域名等统一变量
 * 可根据环境切换（开发/测试/生产）
 */

/**
 * 真机走微信云托管时，用 wx.cloud.callContainer，无需配置合法域名到该 HTTPS。
 * 浏览器 / Postman / 未开通云开发时，仍可用 API_BASE_URL + wx.request。
 */
const USE_CLOUD_CONTAINER = true;

/** 云开发 / 云托管环境 ID（与 wx.cloud.init、callContainer、uploadFile 的 config.env 一致） */
const CLOUD_ENV = 'prod-4g6txya8d2f21745';

/** 对象存储桶 ID（控制台对象存储 · 存储桶列表，与 fileID 中 bucket 段一致） */
const CLOUD_STORAGE_BUCKET = '7072-prod-4g6txya8d2f21745-1413661498';

/** 对象存储地域 */
const CLOUD_STORAGE_REGION = 'ap-shanghai';

/**
 * 控制台「存储路径」中的业务目录前缀（7072-.../files → 上传 cloudPath 使用 files/...）
 * 设为 '' 则仍用代码里写的路径（如 users/、activities/）直传根目录。
 */
const CLOUD_STORAGE_PATH_PREFIX = 'files';

/**
 * 云托管服务名，必须与 callContainer 请求头 X-WX-SERVICE 一致
 * （控制台服务名，你示例里为 koa-eeo7）
 */
const CLOUD_SERVICE = 'koa-eeo7';

/**
 * wx.request 直连时的 HTTPS 根地址（仅当未使用 callContainer 时生效）
 * 与浏览器访问一致，例如：https://koa-eeo7-243325-4-1413661498.sh.run.tcloudbase.com
 */
const API_BASE_URL =
  'https://koa-eeo7-243325-4-1413661498.sh.run.tcloudbase.com';

module.exports = {
  API_BASE_URL,
  USE_CLOUD_CONTAINER,
  CLOUD_ENV,
  CLOUD_SERVICE,
  CLOUD_STORAGE_BUCKET,
  CLOUD_STORAGE_REGION,
  CLOUD_STORAGE_PATH_PREFIX
};
