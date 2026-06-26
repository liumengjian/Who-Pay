/**
 * 对象存储：上传 / 删除 / 将历史 base64 等迁移为 CDN URL
 * 自建服务器模式：通过 HTTP 上传到后端 /api/files/upload，后端存到腾讯云 COS
 * 云托管模式（回退）：通过 wx.cloud.* API
 */

const { USE_CLOUD_CONTAINER, CLOUD_ENV, API_BASE_URL, COS_CDN_DOMAIN, CLOUD_STORAGE_PATH_PREFIX } = require('../service/config.js');
const { normalizeStorageUrl } = require('./storageUrl.js');

/** 与控制台存储路径对齐：自动加 files/ 等前缀（已含前缀则不再重复） */
function normalizeUploadCloudPath(cloudPath) {
  const raw = String(cloudPath || '').trim().replace(/^\/+/, '');
  if (!raw) return raw;
  const prefix = String(CLOUD_STORAGE_PATH_PREFIX || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  if (!prefix) return raw;
  if (raw === prefix || raw.startsWith(prefix + '/')) return raw;
  return `${prefix}/${raw}`;
}

/**
 * 自建服务器模式下，始终返回 true（只要配置了 API_BASE_URL）
 * 云托管模式下，检查 wx.cloud.uploadFile 是否可用
 */
function cloudReady() {
  if (!USE_CLOUD_CONTAINER) {
    return !!API_BASE_URL;
  }
  return !!(wx.cloud && typeof wx.cloud.uploadFile === 'function');
}

/**
 * 检查是否为云存储 fileID（cloud:// 前缀）
 * 自建服务器模式下不再使用 cloud://，但兼容历史数据
 */
function isCloudFileId(s) {
  return typeof s === 'string' && /^cloud:\/\//i.test(s.trim());
}

/** 是否为 CDN URL（自建服务器模式下的文件引用） */
function isCdnUrl(s) {
  if (!COS_CDN_DOMAIN) return false;
  return typeof s === 'string' && s.trim().startsWith(COS_CDN_DOMAIN);
}

/** 是否为 data:image/...;base64,... */
function isDataImageUrl(s) {
  return typeof s === 'string' && /^data:image\/[\w+.-]+;base64,/i.test(s.trim());
}

/** 小程序本地临时资源（需上传后才能长久保存） */
function isLikelyEphemeralLocal(u) {
  if (!u || typeof u !== 'string') return false;
  const s = u.trim();
  if (s.startsWith('wxfile://')) return true;
  if (/^https?:\/\/(tmp|usr)\//i.test(s)) return true;
  if (s.startsWith('file://')) return true;
  return false;
}

/** 已是云文件、网络图、本地包内资源时，可直接写入笔记/展示，无需再上传 */
function isImageStoredReference(u) {
  if (!u || typeof u !== 'string') return false;
  const s = u.trim();
  if (isCloudFileId(s)) return true;
  if (isCdnUrl(s)) return true;
  if (s.startsWith('/images/')) return true;
  if (/^https:\/\//i.test(s) && !/^https?:\/\/(tmp|usr)\//i.test(s)) return true;
  if (/^http:\/\//i.test(s) && !/^http:\/\/(tmp|usr)\//i.test(s)) return true;
  return false;
}

function compressLocalIfPossible(filePath, quality) {
  const q = quality != null ? quality : 72;
  return new Promise((resolve) => {
    if (!filePath || !wx.compressImage) {
      resolve(filePath);
      return;
    }
    wx.compressImage({
      src: filePath,
      quality: q,
      success: (res) => resolve(res.tempFilePath || filePath),
      fail: () => resolve(filePath)
    });
  });
}

/**
 * 上传文件到后端 /api/files/upload（自建服务器模式）
 * @param {string} filePath 本地临时路径
 * @param {string} cloudPath 对象存储路径，如 users/1/a.jpg
 * @returns {Promise<string>} CDN URL
 */
function uploadFileViaHttp(filePath, cloudPath) {
  const token = wx.getStorageSync('token');
  const finalPath = normalizeUploadCloudPath(cloudPath);
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${API_BASE_URL}/api/files/upload`,
      filePath,
      name: 'file',
      formData: {
        path: finalPath
      },
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.success && data.url) {
            resolve(normalizeStorageUrl(data.url));
          } else {
            reject(new Error(data.message || '上传失败'));
          }
        } catch (e) {
          reject(new Error('解析上传响应失败'));
        }
      },
      fail: reject
    });
  });
}

/**
 * 上传文件（兼容云托管和自建服务器两种模式）
 * @param {string} filePath 本地临时路径
 * @param {string} cloudPath 对象存储路径，勿以 / 开头，如 users/1/a.jpg
 */
function uploadLocalFile(filePath, cloudPath) {
  return new Promise((resolve, reject) => {
    if (!cloudReady()) {
      reject(new Error('存储未初始化'));
      return;
    }

    // 自建服务器模式：HTTP 上传
    if (!USE_CLOUD_CONTAINER) {
      uploadFileViaHttp(filePath, cloudPath).then(resolve).catch(reject);
      return;
    }

    // 云托管模式（回退）：wx.cloud.uploadFile
    const finalPath = normalizeUploadCloudPath(cloudPath);
    wx.cloud.uploadFile({
      cloudPath: finalPath,
      filePath,
      config: { env: CLOUD_ENV },
      success: (res) => resolve(normalizeStorageUrl(res.fileID)),
      fail: reject
    });
  });
}

async function uploadLocalImage(filePath, cloudPath, options) {
  const q = options && options.compressQuality;
  const src = await compressLocalIfPossible(filePath, q);
  return uploadLocalFile(src, cloudPath);
}

/**
 * 批量删除文件
 */
function deleteCloudFiles(fileList) {
  const ids = (fileList || [])
    .map((x) => String(x || '').trim())
    .filter((x) => isCloudFileId(x) || isCdnUrl(x) || /^https?:\/\//i.test(x));
  if (!ids.length) return Promise.resolve();

  // 自建服务器模式：HTTP 删除
  if (!USE_CLOUD_CONTAINER) {
    const token = wx.getStorageSync('token');
    return new Promise((resolve) => {
      wx.request({
        url: `${API_BASE_URL}/api/files/delete`,
        method: 'POST',
        data: { urls: ids },
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        success: () => resolve(),
        fail: (e) => {
          console.warn('[cloudStorage] deleteFiles HTTP', e);
          resolve();
        }
      });
    });
  }

  // 云托管模式（回退）
  const cloudIds = ids.filter((x) => isCloudFileId(x));
  if (!cloudIds.length) return Promise.resolve();
  if (!cloudReady() || typeof wx.cloud.deleteFile !== 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    wx.cloud.deleteFile({
      fileList: cloudIds,
      success: () => resolve(),
      fail: (e) => {
        console.warn('[cloudStorage] deleteFile', e);
        resolve();
      }
    });
  });
}

function dataUrlToTempPath(dataUrl) {
  const m = /^data:image\/([\w+.-]+);base64,(.*)$/i.exec(String(dataUrl).trim());
  if (!m) return Promise.reject(new Error('invalid data url'));
  const extMap = {
    jpeg: 'jpg',
    jpg: 'jpg',
    png: 'png',
    gif: 'gif',
    webp: 'webp'
  };
  const rawExt = m[1].toLowerCase();
  const ext = extMap[rawExt] || 'jpg';
  const basePath = wx.env && wx.env.USER_DATA_PATH;
  if (!basePath) return Promise.reject(new Error('no USER_DATA_PATH'));
  const dest = `${basePath}/mig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  if (!wx.base64ToArrayBuffer) {
    return Promise.reject(new Error('base64 decode unsupported'));
  }
  const buf = wx.base64ToArrayBuffer(m[2]);
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath: dest,
      data: buf,
      success: () => resolve(dest),
      fail: reject
    });
  });
}

/**
 * 若为 data:image base64，则上传并返回 URL；已是 CDN URL / cloud:// / 合法网络 URL / 包内路径则原样返回。
 * @param {string} url
 * @param {string} cloudPath 目标 cloudPath
 */
async function migrateImageUrlToCloudIfNeeded(url, cloudPath) {
  const u = normalizeStorageUrl(String(url || '').trim());
  if (!u) return u;
  if (isCloudFileId(u)) return u;
  if (isCdnUrl(u)) return u;
  if (u.startsWith('/images/')) return u;
  if (/^https?:\/\//i.test(u) && !isLikelyEphemeralLocal(u)) return u;
  if (!cloudReady()) return u;

  if (isDataImageUrl(u)) {
    let tmp;
    try {
      tmp = await dataUrlToTempPath(u);
      const fid = await uploadLocalImage(tmp, cloudPath, { compressQuality: 78 });
      return fid;
    } finally {
      if (tmp) {
        try {
          wx.getFileSystemManager().unlinkSync(tmp);
        } catch (e) {
          /* ignore */
        }
      }
    }
  }

  if (isLikelyEphemeralLocal(u) || (!u.includes(':') && u.length > 2)) {
    try {
      return await uploadLocalImage(u, cloudPath, { compressQuality: 78 });
    } catch (e) {
      console.warn('[cloudStorage] upload local failed', e);
      return u;
    }
  }

  return u;
}

/**
 * 笔记附件：与 migrateImageUrlToCloudIfNeeded 同策略，走上传（不压缩）
 */
async function migrateAttachmentUrlToCloudIfNeeded(url, cloudPath) {
  const u = normalizeStorageUrl(String(url || '').trim());
  if (!u) return u;
  if (isCloudFileId(u)) return u;
  if (isCdnUrl(u)) return u;
  if (u.startsWith('/images/')) return u;
  if (/^https?:\/\//i.test(u) && !isLikelyEphemeralLocal(u)) return u;
  if (!cloudReady()) return u;

  const octetRe = /^data:application\/octet-stream;base64,([\s\S]+)$/i.exec(
    u
  );
  if (octetRe) {
    let tmp;
    try {
      const basePath = wx.env && wx.env.USER_DATA_PATH;
      if (!basePath) return u;
      const extMatch = String(cloudPath).match(/\.([a-z0-9]+)$/i);
      const suffix = extMatch ? `.${extMatch[1]}` : '.bin';
      tmp = `${basePath}/note_att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${suffix}`;
      const buf = wx.base64ToArrayBuffer(octetRe[1]);
      await new Promise((resolve, reject) => {
        wx.getFileSystemManager().writeFile({
          filePath: tmp,
          data: buf,
          success: resolve,
          fail: reject
        });
      });
      const fid = await uploadLocalFile(tmp, cloudPath);
      return fid;
    } catch (e) {
      console.warn('[cloudStorage] migrate attachment data url', e);
      return u;
    } finally {
      if (tmp) {
        try {
          wx.getFileSystemManager().unlinkSync(tmp);
        } catch (e) {
          /* ignore */
        }
      }
    }
  }

  if (isLikelyEphemeralLocal(u) || (!u.includes(':') && u.length > 2)) {
    try {
      return await uploadLocalFile(u, cloudPath);
    } catch (e) {
      console.warn('[cloudStorage] migrate attachment local', e);
      return u;
    }
  }

  return u;
}

/**
 * 笔记附件：拉取到本地临时路径供 wx.openDocument 使用。
 * 自建服务器模式：CDN URL 直接用 wx.downloadFile 下载
 * 云托管模式：云文件优先 wx.cloud.downloadFile
 */
function downloadNoteAttachmentToTempPath(url) {
  const raw = normalizeStorageUrl(String(url || '').trim());
  if (!raw) return Promise.reject(new Error('附件地址无效'));
  if (raw.startsWith('data:')) {
    return Promise.reject(new Error('暂不支持预览此类附件'));
  }

  // 自建服务器模式：直接用 wx.downloadFile + URL
  if (!USE_CLOUD_CONTAINER) {
    if (/^https?:\/\//i.test(raw)) {
      return new Promise((resolve, reject) => {
        wx.downloadFile({
          url: raw,
          success: (r) => {
            if (r.statusCode === 200 && r.tempFilePath) resolve(r.tempFilePath);
            else reject(new Error('下载失败'));
          },
          fail: reject
        });
      });
    }
    return Promise.resolve(raw);
  }

  // 以下为云托管模式（回退）
  const getTempUrlThenHttpDownload = () =>
    new Promise((resolve, reject) => {
      if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
        reject(new Error('云存储未就绪'));
        return;
      }
      wx.cloud.getTempFileURL({
        fileList: [raw],
        success: (res) => {
          const row = res.fileList && res.fileList[0];
          const tmp =
            row && (row.tempFileURL || row.tempUrl || row.download_url);
          if (!tmp) {
            reject(new Error('无法获取附件下载地址'));
            return;
          }
          wx.downloadFile({
            url: tmp,
            success: (r) => {
              if (r.statusCode === 200 && r.tempFilePath) {
                resolve(r.tempFilePath);
              } else reject(new Error('下载失败'));
            },
            fail: reject
          });
        },
        fail: reject
      });
    });

  if (isCloudFileId(raw)) {
    if (!cloudReady()) {
      return Promise.reject(new Error('云存储未就绪'));
    }
    if (typeof wx.cloud.downloadFile === 'function') {
      return new Promise((resolve, reject) => {
        const opt = {
          fileID: raw,
          success: (res) => {
            if (res.tempFilePath) resolve(res.tempFilePath);
            else reject(new Error('云下载无临时路径'));
          },
          fail: reject
        };
        if (CLOUD_ENV) opt.config = { env: CLOUD_ENV };
        wx.cloud.downloadFile(opt);
      }).catch(() => getTempUrlThenHttpDownload());
    }
    return getTempUrlThenHttpDownload();
  }

  if (/^https?:\/\//i.test(raw)) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url: raw,
        success: (r) => {
          if (r.statusCode === 200 && r.tempFilePath) resolve(r.tempFilePath);
          else reject(new Error('下载失败'));
        },
        fail: reject
      });
    });
  }

  return Promise.resolve(raw);
}

/**
 * 是否需要做「上传存储并换 URL」的迁移（当前仅对 data:image base64 为 true）
 */
function needsMigrateToCloud(url) {
  return isDataImageUrl(url);
}

module.exports = {
  cloudReady,
  isCloudFileId,
  isCdnUrl,
  isDataImageUrl,
  isLikelyEphemeralLocal,
  isImageStoredReference,
  uploadLocalFile,
  uploadLocalImage,
  downloadNoteAttachmentToTempPath,
  deleteCloudFiles,
  migrateImageUrlToCloudIfNeeded,
  migrateAttachmentUrlToCloudIfNeeded,
  needsMigrateToCloud
};
