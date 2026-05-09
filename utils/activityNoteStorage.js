/**
 * 活动笔记：content（HTML）+ linkMap（芯片 id → 跳转字段），与后端 noteJson 一致
 */
/** 图片仅以 max-width 适应容器；与 mp-html / editor 阅读态一致 */
const NOTE_IMG_HTML_STYLE =
  'display:block;max-width:100%;height:auto;width:auto;vertical-align:top;';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function genChipId() {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const NOTE_CHIP_HREF_PREFIX = 'https://whopay.local/note-chip?k=';

/** mp-html 内联可能被裁减；芯片兜底样式见 components/mp-html/node/node.wxss（._a.note-chip-*） */
/** mp-html / rich-text 只吃 inline style，页面 class 不会作用到节点内部 */
const NOTE_CHIP_LOC_STYLE =
  'display:inline-block;vertical-align:middle;padding:6px 14px;border-radius:12px;margin:5px 0;' +
  'background:#fafafa;box-shadow:0 1px 0 rgba(15,23,42,0.06);' +
  'border:1px dashed rgba(99,102,241,0.35);color:#3730a3;font-size:15px;' +
  'font-weight:600;line-height:1.45;text-decoration:none;';
const NOTE_CHIP_ATT_STYLE =
  'display:inline-block;vertical-align:middle;padding:6px 14px;border-radius:12px;margin:5px 0;' +
  'background:linear-gradient(180deg,#ffffff 0%,#f0f9ff 100%);' +
  'box-shadow:0 1px 4px rgba(14,165,233,0.12),0 0 0 1px rgba(14,165,233,0.25);' +
  'color:#0369a1;font-size:15px;font-weight:600;line-height:1.45;text-decoration:none;';

const cloudStorage = require('./cloudStorage.js');

function chipHref(id) {
  return NOTE_CHIP_HREF_PREFIX + encodeURIComponent(String(id));
}

/** getContents 后 href 仍存在；indexOf 需避免 c_1 误匹配 c_10 */
function chipHrefAppearsInNoteHtml(html, id) {
  const full = chipHref(id);
  const s = String(html || '');
  let from = 0;
  while (true) {
    const idx = s.indexOf(full, from);
    if (idx < 0) return false;
    const after = s.charAt(idx + full.length);
    if (!after || /["'>&\s]/.test(after)) return true;
    from = idx + 1;
  }
}

/** 地点芯片：`<a id>` 与 linkMap 的 key 一致，点击时用 id 查 map */
function buildLocChipHtml(id, name, lat, lng, address) {
  const cid = String(id);
  const nm = escapeHtml(String(name || '地点').trim() || '地点');
  const stAttr = escapeHtml(NOTE_CHIP_LOC_STYLE);
  return (
    `<p><a id="${cid}" data-chip-id="${cid}" data-chip-type="loc" contenteditable="false" ` +
    `class="note-chip-loc" style="${stAttr}" href="${chipHref(cid)}">${nm}</a></p>`
  );
}

/** 附件芯片：同上，id === linkMap key */
function buildAttChipHtml(id, displayName) {
  const cid = String(id);
  const nm = escapeHtml(String(displayName || '附件').trim() || '附件');
  const stAttr = escapeHtml(NOTE_CHIP_ATT_STYLE);
  return (
    `<p><a id="${cid}" data-chip-id="${cid}" data-chip-type="att" contenteditable="false" ` +
    `class="note-chip-att" style="${stAttr}" href="${chipHref(cid)}">${nm}</a></p>`
  );
}

/** 去掉 <a ...> 开始标签上的 style，避免残缺 style 阻止补上芯片标签样式 */
function stripOpeningAnchorStyleAttr(inner) {
  return String(inner || '')
    .replace(/\sstyle\s*=\s*"[^"]*"/gi, '')
    .replace(/\sstyle\s*=\s*'[^']*'/gi, '');
}

/**
 * 阅读/预览：mp-html 只吃内联 style；为地点/附件芯片强制完整「标签」样式（与编辑器一致）
 * 旧 HTML 可能无 id；补上与 data-chip-id 相同的 id，便于 linktap 与 linkMap 对应
 */
function ensureChipStylesInNoteHtml(html) {
  let s = String(html || '');
  if (
    !s.includes('data-chip-type') &&
    !s.includes('note-chip-loc') &&
    !s.includes('note-chip-att')
  ) {
    return s;
  }
  s = s.replace(
    /<a(\s+[^>]*?\bdata-chip-id="([^"]+)"[^>]*?)>/gi,
    (full, inner, cid) => {
      if (/\bid\s*=/i.test(inner)) return full;
      return `<a id="${cid}"${inner}>`;
    }
  );
  const stL = escapeHtml(NOTE_CHIP_LOC_STYLE);
  const stA = escapeHtml(NOTE_CHIP_ATT_STYLE);
  let out = s.replace(
    /<a(\s+[^>]*\bdata-chip-type="loc"[^>]*)>/gi,
    (full, inner) => `<a style="${stL}"${stripOpeningAnchorStyleAttr(inner)}>`
  );
  out = out.replace(
    /<a(\s+[^>]*\bdata-chip-type="att"[^>]*)>/gi,
    (full, inner) => `<a style="${stA}"${stripOpeningAnchorStyleAttr(inner)}>`
  );
  out = out.replace(
    /<a(\s+[^>]*\bclass="[^"]*\bnote-chip-loc\b[^"]*"[^>]*)>/gi,
    (full, inner) => {
      if (/\bdata-chip-type\s*=/i.test(inner)) return full;
      return `<a style="${stL}"${stripOpeningAnchorStyleAttr(inner)}>`;
    }
  );
  out = out.replace(
    /<a(\s+[^>]*\bclass="[^"]*\bnote-chip-att\b[^"]*"[^>]*)>/gi,
    (full, inner) => {
      if (/\bdata-chip-type\s*=/i.test(inner)) return full;
      return `<a style="${stA}"${stripOpeningAnchorStyleAttr(inner)}>`;
    }
  );
  return out;
}

function pruneLinkMapToHtml(html, linkMap) {
  const s = String(html || '');
  const m = linkMap && typeof linkMap === 'object' ? linkMap : {};
  const next = Object.create(null);
  for (const k of Object.keys(m)) {
    const id = String(k);
    const q = escapeHtml(id).replace(/"/g, '&quot;');
    const byDataAttr =
      s.indexOf(`data-chip-id="${id}"`) >= 0 ||
      s.indexOf(`data-chip-id='${id}'`) >= 0 ||
      s.indexOf('data-chip-id="' + q + '"') >= 0;
    const byChipHref = chipHrefAppearsInNoteHtml(s, id);
    if (byDataAttr || byChipHref) {
      next[k] = m[k];
    }
  }
  return next;
}

/** 保存时用内存中的 linkMap（坐标/附件元数据以 _noteLinkMap 为准，不依赖 editor getContents 的 HTML） */
function cloneLinkMapForSave(linkMap) {
  const m = linkMap && typeof linkMap === 'object' ? linkMap : {};
  const next = Object.create(null);
  for (const k of Object.keys(m)) {
    const v = m[k];
    if (!v || typeof v !== 'object') continue;
    if (v.kind === 'loc') {
      const lat = Number(v.lat);
      const lng = Number(v.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      next[k] = {
        kind: 'loc',
        lat,
        lng,
        name: String(v.name || ''),
        address: String(v.address || '')
      };
    } else if (v.kind === 'att') {
      const url = String(v.url || '').trim();
      if (!url) continue;
      next[k] = { kind: 'att', url, name: String(v.name || '') };
    }
  }
  return next;
}

function plainLen(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

function notePreviewFromContent(content, linkMap) {
  const c = String(content || '').trim();
  const map = linkMap && typeof linkMap === 'object' ? linkMap : {};
  const hasMap = Object.keys(map).length > 0;
  if (!c && !hasMap) {
    return { activityNoteHasPreview: false, activityNotePreviewHtml: '' };
  }
  const pl = plainLen(c);
  if (!pl && !hasMap) {
    return { activityNoteHasPreview: false, activityNotePreviewHtml: '' };
  }
  if (c.length <= 5000) {
    return { activityNoteHasPreview: true, activityNotePreviewHtml: c };
  }
  const excerpt = c.slice(0, 4500);
  return {
    activityNoteHasPreview: true,
    activityNotePreviewHtml: excerpt + '<p>…</p>'
  };
}

function extractImageUrlsFromHtml(html) {
  const urls = [];
  const s = String(html || '');
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m[1]) urls.push(m[1]);
  }
  return urls;
}

/**
 * 保存前：把编辑器里本地/temp/base64 图片 src 上传为云 fileID，避免临时路径失效。
 */
async function migrateNoteHtmlImagesToCloud(html, activityId) {
  const s = String(html || '');
  const aid = activityId != null ? String(activityId) : '';
  if (!aid || !s) return s;
  const urls = extractImageUrlsFromHtml(s);
  const seen = Object.create(null);
  let out = s;
  for (const url of urls) {
    const u = String(url || '').trim();
    if (!u || seen[u]) continue;
    seen[u] = 1;
    if (cloudStorage.isImageStoredReference(u)) continue;
    if (
      !cloudStorage.isLikelyEphemeralLocal(u) &&
      !cloudStorage.isDataImageUrl(u)
    ) {
      continue;
    }
    try {
      const cloudPath = `activities/${aid}/notes/img_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 10)}.jpg`;
      const fid = await cloudStorage.migrateImageUrlToCloudIfNeeded(
        u,
        cloudPath
      );
      if (fid && fid !== u) out = out.split(u).join(fid);
    } catch (e) {
      console.warn('[note] image migrate', e);
    }
  }
  return out;
}

/** 保存前：linkMap 里附件若为本地路径，上传云存储 */
async function migrateNoteLinkMapAttachmentsToCloud(linkMap, activityId) {
  const aid = activityId != null ? String(activityId) : '';
  const m = linkMap && typeof linkMap === 'object' ? linkMap : {};
  if (!aid || !Object.keys(m).length) return m;
  const out = { ...m };
  for (const k of Object.keys(out)) {
    const ent = out[k];
    if (!ent || ent.kind !== 'att') continue;
    const u = String(ent.url || '').trim();
    if (!u) continue;
    if (
      cloudStorage.isCloudFileId(u) ||
      (/^https?:\/\//i.test(u) && !cloudStorage.isLikelyEphemeralLocal(u))
    ) {
      continue;
    }
    try {
      const ext = (String(ent.name || '').match(/\.([a-z0-9]+)$/i) || [])[1] || 'bin';
      const cloudPath = `activities/${aid}/notes/att_${k}_${Date.now()}.${ext}`;
      const fid = await cloudStorage.migrateAttachmentUrlToCloudIfNeeded(
        u,
        cloudPath
      );
      if (fid) out[k] = { ...ent, url: fid };
    } catch (e) {
      console.warn('[note] att migrate', e);
    }
  }
  return out;
}

function normalizeLinkMapForClient(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = Object.create(null);
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    if (!v || typeof v !== 'object') continue;
    const kind = String(v.kind || '').toLowerCase();
    if (kind === 'loc') {
      let lat = Number(v.lat);
      let lng = Number(v.lng);
      if (!Number.isFinite(lat)) lat = Number(v.latitude);
      if (!Number.isFinite(lng)) lng = Number(v.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      out[k] = {
        kind: 'loc',
        lat,
        lng,
        name: String(v.name || ''),
        address: String(v.address || '')
      };
    } else if (kind === 'att') {
      const url = String(v.url || '').trim();
      if (!url) continue;
      out[k] = { kind: 'att', url, name: String(v.name || '') };
    }
  }
  return out;
}

module.exports = {
  NOTE_IMG_HTML_STYLE,
  escapeHtml,
  genChipId,
  NOTE_CHIP_HREF_PREFIX,
  NOTE_CHIP_LOC_STYLE,
  NOTE_CHIP_ATT_STYLE,
  chipHref,
  buildLocChipHtml,
  buildAttChipHtml,
  pruneLinkMapToHtml,
  cloneLinkMapForSave,
  plainLen,
  notePreviewFromContent,
  extractImageUrlsFromHtml,
  normalizeLinkMapForClient,
  migrateNoteHtmlImagesToCloud,
  migrateNoteLinkMapAttachmentsToCloud,
  ensureChipStylesInNoteHtml
};
