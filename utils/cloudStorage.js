/**
 * 微信云托管对象存储：上传 / 删除 / 将历史 base64 等迁移为 cloud fileID
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/src/development/storage/miniapp/upload.html
 */

const { CLOUD_ENV, CLOUD_STORAGE_PATH_PREFIX } = require('../service/config.js');

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

function cloudReady() {
  return !!(wx.cloud && typeof wx.cloud.uploadFile === 'function');
}

function isCloudFileId(s) {
  return typeof s === 'string' && /^cloud:\/\//i.test(s.trim());
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
 * @param {string} filePath 本地临时路径
 * @param {string} cloudPath 对象存储路径，勿以 / 开头，如 users/1/a.jpg
 */
function uploadLocalFile(filePath, cloudPath) {
  return new Promise((resolve, reject) => {
    if (!cloudReady()) {
      reject(new Error('云存储未初始化'));
      return;
    }
    const finalPath = normalizeUploadCloudPath(cloudPath);
    wx.cloud.uploadFile({
      cloudPath: finalPath,
      filePath,
      config: { env: CLOUD_ENV },
      success: (res) => resolve(res.fileID),
      fail: reject
    });
  });
}

async function uploadLocalImage(filePath, cloudPath, options) {
  const q = options && options.compressQuality;
  const src = await compressLocalIfPossible(filePath, q);
  return uploadLocalFile(src, cloudPath);
}

function deleteCloudFiles(fileList) {
  const ids = (fileList || [])
    .map((x) => String(x || '').trim())
    .filter((x) => isCloudFileId(x));
  if (!ids.length) return Promise.resolve();
  if (!cloudReady() || typeof wx.cloud.deleteFile !== 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    wx.cloud.deleteFile({
      fileList: ids,
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
 * 若为 data:image base64，则上传并返回 fileID；已是 cloud:// / 合法网络 URL / 包内路径则原样返回。
 * @param {string} url
 * @param {string} cloudPath 目标 cloudPath
 */
async function migrateImageUrlToCloudIfNeeded(url, cloudPath) {
  const u = String(url || '').trim();
  if (!u) return u;
  if (isCloudFileId(u)) return u;
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
 * 笔记附件：与 migrateImageUrlToCloudIfNeeded 同策略，走 wx.cloud.uploadFile（不压缩），目录与图片一致 activities/{id}/notes/
 */
async function migrateAttachmentUrlToCloudIfNeeded(url, cloudPath) {
  const u = String(url || '').trim();
  if (!u) return u;
  if (isCloudFileId(u)) return u;
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
 * 云文件优先 wx.cloud.downloadFile，避免临时 HTTPS 链接不在 downloadFile 合法域名内导致失败。
 */
function downloadNoteAttachmentToTempPath(url) {
  const raw = String(url || '').trim();
  if (!raw) return Promise.reject(new Error('附件地址无效'));
  if (raw.startsWith('data:')) {
    return Promise.reject(new Error('暂不支持预览此类附件'));
  }

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
 * 是否需要做「上传云存储并换 URL」的迁移（当前仅对 data:image base64 为 true）
 */
function needsMigrateToCloud(url) {
  return isDataImageUrl(url);
}

module.exports = {
  CLOUD_ENV,
  cloudReady,
  isCloudFileId,
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
