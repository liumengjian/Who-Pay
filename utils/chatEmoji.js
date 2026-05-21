const { catalog } = require('./chatEmojiCatalog.js');
const { CLOUD_ENV, CLOUD_STORAGE_BUCKET } = require('../service/config.js');

const EMOJI_CLOUD_PREFIX = `cloud://${CLOUD_ENV}.${CLOUD_STORAGE_BUCKET}/files/emoji`;
const EMOJI_TOKEN_RE = /\[emoji:([^\]]+)\]/g;
const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

let _urlCache = Object.create(null);

function getCatalog() {
  return catalog;
}

function emojiKey(category, filename) {
  return `${category}/${filename}`;
}

function toCloudFileId(key) {
  const k = String(key || '').trim().replace(/^\/+/, '');
  if (!k) return '';
  return `${EMOJI_CLOUD_PREFIX}/${k}`;
}

function localPreviewPath(key) {
  const k = String(key || '').trim().replace(/^\/+/, '');
  if (!k) return '';
  return `/images/weibo/${k}`;
}

function makeEmojiToken(key) {
  return `[emoji:${String(key || '').trim()}]`;
}

function containsEmojiToken(text) {
  EMOJI_TOKEN_RE.lastIndex = 0;
  return EMOJI_TOKEN_RE.test(String(text || ''));
}

function parseEmojiText(text) {
  const raw = String(text || '');
  if (!raw) return [{ type: 'text', text: '' }];
  const segments = [];
  let last = 0;
  let m;
  EMOJI_TOKEN_RE.lastIndex = 0;
  while ((m = EMOJI_TOKEN_RE.exec(raw))) {
    if (m.index > last) {
      segments.push({ type: 'text', text: raw.slice(last, m.index) });
    }
    const key = m[1];
    segments.push({
      type: 'emoji',
      key,
      cloudId: toCloudFileId(key),
      preview: localPreviewPath(key)
    });
    last = m.index + m[0].length;
  }
  if (last < raw.length) {
    segments.push({ type: 'text', text: raw.slice(last) });
  }
  if (!segments.length) {
    segments.push({ type: 'text', text: raw });
  }
  return segments;
}

function resolveEmojiUrls(keys) {
  const list = (keys || [])
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  const uniq = [...new Set(list)];
  const out = {};
  const pending = [];
  uniq.forEach((key) => {
    if (_urlCache[key]) {
      out[key] = _urlCache[key];
      return;
    }
    pending.push(key);
  });
  if (!pending.length) return Promise.resolve(out);

  const fileList = pending.map(toCloudFileId).filter(Boolean);
  if (!fileList.length || !wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
    pending.forEach((key) => {
      out[key] = localPreviewPath(key);
      _urlCache[key] = out[key];
    });
    return Promise.resolve(out);
  }

  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList,
      config: CLOUD_ENV ? { env: CLOUD_ENV } : undefined,
      success: (res) => {
        const rows = (res && res.fileList) || [];
        rows.forEach((row, i) => {
          const key = pending[i];
          const url =
            (row && (row.tempFileURL || row.tempUrl || row.download_url)) ||
            localPreviewPath(key);
          out[key] = url;
          _urlCache[key] = url;
        });
        pending.forEach((key) => {
          if (!out[key]) {
            out[key] = localPreviewPath(key);
            _urlCache[key] = out[key];
          }
        });
        resolve(out);
      },
      fail: () => {
        pending.forEach((key) => {
          out[key] = localPreviewPath(key);
          _urlCache[key] = out[key];
        });
        resolve(out);
      }
    });
  });
}

function pad2(n) {
  return n < 10 ? `0${n}` : String(n);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatChatTimeLabel(currentTime, prevTime) {
  const cur = currentTime ? new Date(currentTime) : null;
  if (!cur || Number.isNaN(cur.getTime())) {
    return { show: false, label: '' };
  }
  const prev = prevTime ? new Date(prevTime) : null;
  const gapMs =
    prev && !Number.isNaN(prev.getTime()) ? cur.getTime() - prev.getTime() : Infinity;
  if (gapMs < 5 * 60 * 1000) {
    return { show: false, label: '' };
  }

  const now = new Date();
  const hm = `${pad2(cur.getHours())}:${pad2(cur.getMinutes())}`;
  const curDay = startOfDay(cur).getTime();
  const today = startOfDay(now).getTime();
  const diffDay = Math.round((today - curDay) / 86400000);

  if (diffDay === 0) return { show: true, label: hm };
  if (diffDay === 1) return { show: true, label: `昨天 ${hm}` };
  if (diffDay > 1 && diffDay < 7) {
    return { show: true, label: `星期${WEEK_LABELS[cur.getDay()]} ${hm}` };
  }
  if (cur.getFullYear() === now.getFullYear()) {
    return { show: true, label: `${cur.getMonth() + 1}月${cur.getDate()}日 ${hm}` };
  }
  return {
    show: true,
    label: `${cur.getFullYear()}年${cur.getMonth() + 1}月${cur.getDate()}日 ${hm}`
  };
}

function collectEmojiKeysFromMessages(messages) {
  const keys = new Set();
  (messages || []).forEach((m) => {
    const segs = m.bubble && m.bubble.segments;
    if (!segs) return;
    segs.forEach((s) => {
      if (s.type === 'emoji' && s.key) keys.add(s.key);
    });
  });
  return [...keys];
}

function applyEmojiUrlsToMessages(messages, urlMap) {
  return (messages || []).map((m) => {
    if (!m.bubble || !m.bubble.segments) return m;
    const segments = m.bubble.segments.map((s) => {
      if (s.type !== 'emoji') return s;
      return {
        ...s,
        url: (urlMap && urlMap[s.key]) || s.preview || localPreviewPath(s.key)
      };
    });
    return {
      ...m,
      bubble: { ...m.bubble, segments }
    };
  });
}

module.exports = {
  getCatalog,
  emojiKey,
  toCloudFileId,
  localPreviewPath,
  makeEmojiToken,
  containsEmojiToken,
  parseEmojiText,
  resolveEmojiUrls,
  formatChatTimeLabel,
  collectEmojiKeysFromMessages,
  applyEmojiUrlsToMessages
};
