/**
 * 聊天输入 editor：delta ↔ 带 [emoji:key] 的文本
 * emoji 在 editor 内以 insertImage 插入，占 1 个逻辑字符，光标/退格由组件原生处理
 */
const chatEmoji = require('./chatEmoji.js');

const EMOJI_IMG_PX = 22;

function extractEmojiKeyFromOp(op) {
  if (!op || !op.insert || typeof op.insert !== 'object') return '';
  const alt = (op.attributes && op.attributes.alt) || '';
  const m = /\[emoji:([^\]]+)\]/.exec(String(alt));
  if (m) return m[1].trim();
  const src = String(op.insert.image || '');
  const prefix = '/images/weibo/';
  const idx = src.indexOf(prefix);
  if (idx >= 0) return src.slice(idx + prefix.length);
  return '';
}

/** 从 editor getContents / bindinput 的 detail 解析为发送用文本 */
function deltaToContent(detailOrRes) {
  const ops =
    (detailOrRes && detailOrRes.delta && detailOrRes.delta.ops) || [];
  let out = '';
  ops.forEach((op) => {
    if (!op || op.insert == null) return;
    if (typeof op.insert === 'string') {
      out += op.insert.replace(/\n/g, '');
      return;
    }
    if (typeof op.insert === 'object') {
      const key = extractEmojiKeyFromOp(op);
      if (key) out += chatEmoji.makeEmojiToken(key);
    }
  });
  return out;
}

function isComposeEmpty(detailOrRes) {
  return !String(deltaToContent(detailOrRes) || '').trim();
}

function insertEmojiOptions(key) {
  const k = String(key || '').trim();
  return {
    src: chatEmoji.toCloudFileId(k),
    width: `${EMOJI_IMG_PX}px`,
    height: `${EMOJI_IMG_PX}px`,
    alt: chatEmoji.makeEmojiToken(k)
  };
}

function clearEditor(ctx) {
  if (!ctx || typeof ctx.setContents !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    ctx.setContents({ html: '' });
    resolve();
  });
}

module.exports = {
  EMOJI_IMG_PX,
  deltaToContent,
  isComposeEmpty,
  insertEmojiOptions,
  clearEditor
};
