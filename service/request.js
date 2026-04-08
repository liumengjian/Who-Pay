/**
 * 统一请求封装
 * - 云托管：`wx.cloud.callContainer`（env + X-WX-SERVICE + path）
 * - 其它：`wx.request` + API_BASE_URL
 */

const {
  API_BASE_URL,
  USE_CLOUD_CONTAINER,
  CLOUD_ENV,
  CLOUD_SERVICE
} = require('./config.js');

/**
 * 获取请求头（所有接口携带 token）
 */
function getHeaders() {
  const token = wx.getStorageSync('token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function normalizeBody(raw) {
  if (raw == null) return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (e) {
      return raw;
    }
  }
  return raw;
}

function parseResponse(res) {
  const statusCode = res.statusCode;
  const data = normalizeBody(res.data);
  return { statusCode, data };
}

/** GET 时将 data 序列化到 path（与原先 wx.request 行为一致） */
function pathWithQuery(path, method, data) {
  if (method !== 'GET' || !data || typeof data !== 'object') return path;
  const keys = Object.keys(data);
  if (keys.length === 0) return path;
  const qs = keys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join('&');
  return path.includes('?') ? `${path}&${qs}` : `${path}?${qs}`;
}

function handleResult(res, path, resolve, reject) {
  const { statusCode, data } = parseResponse(res);
  if (statusCode === 200) {
    if (data && data.success === false) {
      reject(new Error(data.message || '操作失败'));
    } else {
      resolve(data);
    }
  } else {
    reject(new Error(`请求失败: ${statusCode}`));
  }
}

function canUseCallContainer() {
  return (
    USE_CLOUD_CONTAINER &&
    wx.cloud &&
    typeof wx.cloud.callContainer === 'function'
  );
}

/**
 * 发起 API 请求
 * @param {string} path - 接口路径（如 /api/auth/login），勿带域名
 * @param {string} method - GET | POST | PUT | DELETE
 * @param {object} data - 请求体；GET 时会转成 query
 */
function request(path, method = 'GET', data = {}) {
  const m = String(method || 'GET').toUpperCase();
  const finalPath = pathWithQuery(path, m, data);
  const containerPath = finalPath.startsWith('/') ? finalPath : `/${finalPath}`;

  return new Promise((resolve, reject) => {
    if (canUseCallContainer()) {
      const header = {
        ...getHeaders(),
        'X-WX-SERVICE': CLOUD_SERVICE
      };
      wx.cloud.callContainer({
        config: {
          env: CLOUD_ENV
        },
        path: containerPath,
        header,
        method: m,
        data: m === 'GET' ? {} : data,
        success(res) {
          handleResult(res, path, resolve, reject);
        },
        fail(err) {
          console.error(`callContainer ${containerPath} 失败:`, err);
          reject(err);
        }
      });
    } else {
      wx.request({
        url: `${API_BASE_URL}${finalPath}`,
        method: m,
        data: m === 'GET' ? {} : data,
        header: getHeaders(),
        success(res) {
          handleResult(res, path, resolve, reject);
        },
        fail(err) {
          console.error(`调用API ${path} 失败:`, err);
          reject(err);
        }
      });
    }
  });
}

module.exports = {
  request,
  getHeaders
};
