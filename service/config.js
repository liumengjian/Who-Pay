/**
 * API 配置 - 域名等统一变量
 * 可根据环境切换（开发/测试/生产）
 */

/**
 * 自建服务器模式：false = 使用 wx.request 直连 HTTPS 后端
 * 云托管模式（回退）：true = 使用 wx.cloud.callContainer
 */
const USE_CLOUD_CONTAINER = false;

// ========== 以下为云托管模式配置（回退用，当前未启用） ==========
/** 云开发 / 云托管环境 ID */
const CLOUD_ENV = 'prod-4g6txya8d2f21745';
/** 对象存储桶 ID */
const CLOUD_STORAGE_BUCKET = '7072-prod-4g6txya8d2f21745-1413661498';
/** 对象存储地域 */
const CLOUD_STORAGE_REGION = 'ap-shanghai';
/** 云托管服务名 */
const CLOUD_SERVICE = 'koa-eeo7';
const CLOUD_STORAGE_PATH_PREFIX = 'whopay';
// ========== 云托管配置结束 ==========

/**
 * 自建服务器 HTTPS 接口根地址（Nginx 通过 /whopay/ 前缀转发到后端）
 * 例如：https://who-pay.example.com/whopay
 */
const API_BASE_URL = 'https://www.prina.site/whopay';
// const API_BASE_URL = 'http://111.229.133.119';

/**
 * 腾讯云 COS CDN 域名（对象存储文件访问）
 * 存储桶：prina-1413661498，地域：ap-shanghai
 */
const COS_CDN_DOMAIN = 'https://prina-1413661498.cos.ap-shanghai.myqcloud.com';
/** 当前对外展示/入库的存储资源前缀（Nginx 通过 /whopay 代理到新存储桶） */
const STORAGE_URL_PREFIX = `${COS_CDN_DOMAIN}/whopay`;

/**
 * 社交功能开关（好友 / 聊天 / 邀请好友等）
 * true = 开启；false = 隐藏所有社交相关 UI 与入口
 */
const ENABLE_SOCIAL = false;

module.exports = {
  API_BASE_URL,
  USE_CLOUD_CONTAINER,
  CLOUD_ENV,
  CLOUD_SERVICE,
  CLOUD_STORAGE_BUCKET,
  CLOUD_STORAGE_REGION,
  CLOUD_STORAGE_PATH_PREFIX,
  ENABLE_SOCIAL,
  COS_CDN_DOMAIN,
  STORAGE_URL_PREFIX,
};
