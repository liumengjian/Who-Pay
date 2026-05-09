/** 活动笔记：富文本 editor HTML 与 blocks 互转、阅读态合并文字块 */

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function genBlockId() {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 与 wx.chooseLocation 返回字段一致：name、address、latitude、longitude；chip 文案优先位置名称 name */
function locationChipLabel(name, address) {
  const n = String(name || '').trim();
  if (n) return n;
  const a = String(address || '').trim();
  return a || '地点';
}

/**
 * 用于 blocks→HTML 的 locationTagInnerHtmlAnchor（内联 style + class）；
 * mp-html 渲染时内联可能被裁减，芯片外观以 components/mp-html/node/node.wxss 中 ._a.note-loc-tag--* 为兜底，改此处请同步 wxss。
 */
/** 编辑器内：白底微阴影芯片，与旧版高饱和粉紫区分 */
const NOTE_LOC_CHIP_STYLE_EDITOR =
  'display:inline-block;vertical-align:middle;padding:8px 16px;border-radius:14px;margin:5px;' +
  'background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);' +
  'box-shadow:0 2px 10px rgba(15, 23, 42, 0.06),0 0 0 1px rgba(99,102,241,0.22);' +
  'color:#4338ca;font-size:14px;font-weight:600;line-height:1.45;';
/** 详情卡片预览：紧凑、轻投影 */
const NOTE_LOC_CHIP_STYLE_MP_PREVIEW =
  'display:inline-block;vertical-align:middle;padding:4px 12px;border-radius:10px;margin:5px;' +
  'background:#fff;box-shadow:0 1px 4px rgba(15,23,42,0.06),0 0 0 1px rgba(99,102,241,0.16);' +
  'color:#4f46e5;font-size:13px;font-weight:600;line-height:1.45;';
/** 全文阅读：略强调可点击 */
const NOTE_LOC_CHIP_STYLE_MP_READ =
  'display:inline-block;vertical-align:middle;padding:6px 14px;border-radius:12px;margin:5px;' +
  'background:#fafafa;box-shadow:0 1px 0 rgba(15,23,42,0.06);' +
  'border:1px dashed rgba(99,102,241,0.35);color:#3730a3;font-size:14px;' +
  'font-weight:600;line-height:1.45;';

const LOC_CHIP_STYLE_BY_VISUAL = {
  editor: NOTE_LOC_CHIP_STYLE_EDITOR,
  mpPreview: NOTE_LOC_CHIP_STYLE_MP_PREVIEW,
  mpRead: NOTE_LOC_CHIP_STYLE_MP_READ
};

/** 附件芯片：与地点同款层次，冷色描边区分文档 */
const NOTE_ATTACH_CHIP_STYLE =
  'display:inline-block;vertical-align:middle;padding:8px 16px;border-radius:14px;margin:10px 0;' +
  'background:linear-gradient(180deg,#ffffff 0%,#f0f9ff 100%);' +
  'box-shadow:0 2px 10px rgba(14,165,233,0.08),0 0 0 1px rgba(14,165,233,0.28);' +
  'color:#0369a1;font-size:14px;font-weight:600;line-height:1.45;';

/** 图片仅以 max-width 适应容器，不写死高度，与编辑器按原始宽高插入一致 */
const NOTE_IMG_HTML_STYLE =
  'display:block;max-width:100%;height:auto;width:auto;vertical-align:top;';

/** 阅读态 mp-html 用伪站 + query，避免自定义协议被过滤；与 detail.js parseNoteLocFromHref 对齐 */
const NOTE_MP_LOC_HREF_PREFIX = 'https://whopay.local/note-loc?';
const NOTE_MP_ATT_HREF_PREFIX = 'https://whopay.local/note-att?';

/**
 * 编辑器与 mp-html 统一用 <a>（含 href、data-note-*），禁止 <span> 地点：
 * span 在 mp-html 里易变成纯样式节点且无 linkTap。
 */
function locationTagInnerHtmlAnchor(
  name,
  address,
  latitude,
  longitude,
  locVisual,
  blockId
) {
  const vis =
    locVisual === 'mpPreview' || locVisual === 'mpRead' ? locVisual : 'editor';
  const style =
    LOC_CHIP_STYLE_BY_VISUAL[vis] || NOTE_LOC_CHIP_STYLE_EDITOR;
  const cls =
    vis === 'editor'
      ? 'note-loc-tag note-loc-tag--editor'
      : vis === 'mpPreview'
        ? 'note-loc-tag note-loc-tag--mp-preview'
        : 'note-loc-tag note-loc-tag--mp-read';
  const label = escapeHtml(locationChipLabel(name, address));
  const la = Number(latitude) || 0;
  const ln = Number(longitude) || 0;
  const nm = escapeHtml(String(name || ''));
  const ad = escapeHtml(String(address || ''));
  const qParts = [
    'lat=' + encodeURIComponent(String(la)),
    'lng=' + encodeURIComponent(String(ln)),
    'name=' + encodeURIComponent(String(name || '')),
    'address=' + encodeURIComponent(String(address || ''))
  ];
  if (blockId != null && String(blockId).trim() !== '') {
    qParts.push('bid=' + encodeURIComponent(String(blockId).trim()));
  }
  const q = qParts.join('&');
  const editorCe =
    vis === 'editor' ? 'contenteditable="false" ' : '';
  const idAttr =
    blockId != null && String(blockId).trim()
      ? ` data-note-block-id="${escapeHtml(String(blockId).trim())}"`
      : '';
  return (
    '<a ' +
    editorCe +
    'class="' +
    cls +
    '" ' +
    'data-note-type="location"' +
    idAttr +
    ' data-latitude="' +
    la +
    '" data-longitude="' +
    ln +
    '" ' +
    `data-loc-name="${nm}" data-loc-address="${ad}" ` +
    'href="' +
    NOTE_MP_LOC_HREF_PREFIX +
    q +
    '" style="' +
    style +
    '">&#32;' +
    label +
    '</a>'
  );
}

function wrapLocationEditorP(id, payloadEnc, labelHtml) {
  return (
    `<!--NOTELOC:${id}:${payloadEnc}-->` +
    `<p data-lid="${id}" contenteditable="false" style="margin:10px;padding:0;line-height:1.5;">${labelHtml}</p>`
  );
}

/** 编辑器与 mp-html 统一用 <a>，与 location 相同理由 */
function attachmentTagInnerHtml(name, url) {
  const rawName = String(name || '附件').trim() || '附件';
  const n = escapeHtml(rawName);
  const rawUrl = String(url || '');
  const u = encodeURIComponent(rawUrl);
  const nmEnc = encodeURIComponent(rawName);
  const safeUrl = escapeHtml(rawUrl);
  const safeFileName = escapeHtml(rawName);
  return (
    `<a class="note-attach-tag note-attach-tag--chip" ` +
    `data-note-type="attachment" ` +
    `data-file-url="${safeUrl}" data-file-name="${safeFileName}" ` +
    `href="${NOTE_MP_ATT_HREF_PREFIX}url=${u}&name=${nmEnc}" ` +
    `style="${NOTE_ATTACH_CHIP_STYLE}">&#32;${n}</a>`
  );
}

function buildLocationEditorParagraph(
  id,
  name,
  latitude,
  longitude,
  address
) {
  const payload = encodeURIComponent(
    JSON.stringify({
      name: String(name || ''),
      address: String(address || ''),
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0
    })
  );
  const inner = locationTagInnerHtmlAnchor(
    name,
    address,
    latitude,
    longitude,
    'editor',
    id
  );
  return wrapLocationEditorP(id, payload, inner);
}

function buildAttachmentEditorParagraph(id, name, url) {
  const payload = encodeURIComponent(
    JSON.stringify({
      name: String(name || ''),
      url: String(url || '')
    })
  );
  const label = attachmentTagInnerHtml(name, url);
  return `<!--NOTEATT:${id}:${payload}--><p data-aid="${id}" style="margin:10px;padding:0;line-height:1.5;">${label}</p>`;
}

function blocksToEditorHtml(blocks, genId) {
  const gid = genId || genBlockId;
  if (!blocks || !blocks.length) {
    return '<p><br></p>';
  }
  const flattened = [];
  for (const b of blocks) {
    if (!b || !b.type) continue;
    if (b.type === 'text') {
      const expanded = expandTextBlockEmbeddedChips(b, gid);
      for (let ei = 0; ei < expanded.length; ei++) {
        flattened.push(expanded[ei]);
      }
    } else {
      flattened.push(b);
    }
  }
  if (!flattened.length) {
    return '<p><br></p>';
  }
  const parts = [];
  for (let bi = 0; bi < flattened.length; bi++) {
    const b = flattened[bi];
    if (!b || !b.type) continue;
    if (b.type === 'text') {
      const raw = String(b.content ?? '');
      const body =
        raw.indexOf('<') >= 0
          ? raw.replace(/\n/g, '<br/>')
          : escapeHtml(raw).replace(/\n/g, '<br/>');
      parts.push(`<p>${body}</p>`);
    } else if (b.type === 'image') {
      const u = String(b.url || '').replace(/"/g, '');
      if (!u) continue;
      parts.push(`<p><img src="${u}" style="${NOTE_IMG_HTML_STYLE}"/></p>`);
    } else if (b.type === 'location') {
      const id = String(b.id || gid());
      const name = String(b.name || '');
      const addr = String(b.address || '');
      const laRaw = Number(b.latitude);
      const lnRaw = Number(b.longitude);
      const laLeg = Number(b.lat);
      const lnLeg = Number(b.lng);
      const la = Number.isFinite(laRaw)
        ? laRaw
        : Number.isFinite(laLeg)
          ? laLeg
          : 0;
      const ln = Number.isFinite(lnRaw)
        ? lnRaw
        : Number.isFinite(lnLeg)
          ? lnLeg
          : 0;
      const payload = encodeURIComponent(
        JSON.stringify({
          name,
          address: addr,
          latitude: la,
          longitude: ln
        })
      );
      const inner = locationTagInnerHtmlAnchor(name, addr, la, ln, 'editor', id);
      parts.push(wrapLocationEditorP(id, payload, inner));
    } else if (b.type === 'attachment') {
      const id = String(b.id || gid());
      parts.push(
        buildAttachmentEditorParagraph(
          id,
          String(b.name || ''),
          String(b.url || '')
        )
      );
    }
  }
  return parts.length ? parts.join('') : '<p><br></p>';
}

function parseDataAttrsFromTagOpen(openFragment) {
  const o = {};
  const frag = String(openFragment || '');
  const reD = /([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = reD.exec(frag))) {
    o[m[1]] = m[2];
  }
  const reS = /([a-zA-Z0-9_-]+)\s*=\s*'([^']*)'/g;
  while ((m = reS.exec(frag))) {
    if (o[m[1]] == null) o[m[1]] = m[2];
  }
  return o;
}

/** text 块内嵌地点：<a> 上 data-* 常被剥掉，href / NOTELOC 注释仍带坐标（与 note-loc query 约定一致） */
function tryLatLngNameFromNoteLocHref(hrefRaw) {
  const h = unescapeHtmlAttr(String(hrefRaw || '').trim());
  if (!h || h.indexOf(NOTE_MP_LOC_HREF_PREFIX) !== 0) return null;
  const qs = h.slice(NOTE_MP_LOC_HREF_PREFIX.length).split('#')[0];
  const o = Object.create(null);
  String(qs)
    .split('&')
    .forEach((pair) => {
      const i = pair.indexOf('=');
      if (i < 0) return;
      const k = decodeURIComponent(pair.slice(0, i).replace(/\+/g, ' '));
      const v = decodeURIComponent(
        (pair.slice(i + 1) || '').replace(/\+/g, ' ')
      );
      o[k] = v;
    });
  const la = parseFloat(o.lat);
  const ln = parseFloat(o.lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  return {
    la,
    ln,
    name: o.name != null ? String(o.name) : '',
    address: o.address != null ? String(o.address) : '',
    blockId: o.bid != null && String(o.bid).trim() ? String(o.bid).trim() : ''
  };
}

function tryUrlNameFromNoteAttHref(hrefRaw) {
  const h = unescapeHtmlAttr(String(hrefRaw || '').trim());
  if (!h || h.indexOf(NOTE_MP_ATT_HREF_PREFIX) !== 0) return null;
  const qs = h.slice(NOTE_MP_ATT_HREF_PREFIX.length).split('#')[0];
  const o = Object.create(null);
  String(qs)
    .split('&')
    .forEach((pair) => {
      const i = pair.indexOf('=');
      if (i < 0) return;
      const k = decodeURIComponent(pair.slice(0, i).replace(/\+/g, ' '));
      const v = decodeURIComponent(
        (pair.slice(i + 1) || '').replace(/\+/g, ' ')
      );
      o[k] = v;
    });
  const url = o.url != null ? String(o.url) : '';
  if (!String(url).trim()) return null;
  return {
    url,
    name: o.name != null ? String(o.name) : ''
  };
}

/**
 * text 块内嵌附件芯片（与地点一样常被并进一段 HTML）；拆成独立 attachment 块以便各用一段 <p>
 */
function splitTextBlockEmbeddedAttachments(block, genId) {
  const gid = genId || genBlockId;
  const raw = String((block && block.content) || '');
  if (!raw || raw.indexOf('<') < 0) return null;
  const strictRe =
    /<a\s(?=[^>]*\bclass="[^"]*note-attach-tag)([^>]*)>([\s\S]*?)<\/a>/gi;
  const looseRe =
    /<a\b([^>]*\bdata-note-type=["']attachment["'][^>]*)>([\s\S]*?)<\/a>/gi;
  const hasStrict = strictRe.test(raw);
  strictRe.lastIndex = 0;
  const hasLoose =
    !hasStrict &&
    (() => {
      const ok = looseRe.test(raw);
      looseRe.lastIndex = 0;
      return ok;
    })();
  if (!hasStrict && !hasLoose) return null;

  const run = (re) => {
    const segments = [];
    let last = 0;
    let m;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) {
        const h = raw.slice(last, m.index);
        if (h.trim()) segments.push({ kind: 'text', html: h });
      }
      const attrs = parseDataAttrsFromTagOpen(m[1] || '');
      let url = String(
        attrs['data-file-url'] != null ? attrs['data-file-url'] : ''
      ).trim();
      url = unescapeHtmlAttr(url);
      let name =
        attrs['data-file-name'] != null ? String(attrs['data-file-name']) : '';
      name = unescapeHtmlAttr(name);
      if (!name.trim()) {
        name = labelFromNoteAttInnerText(stripHtmlPlain(m[2] || ''));
      }
      const fromHref = tryUrlNameFromNoteAttHref(attrs['href']);
      if (fromHref) {
        if (!url) url = fromHref.url;
        if (!String(name).trim() && fromHref.name) name = fromHref.name;
      }
      if (!String(url).trim()) {
        segments.push({ kind: 'text', html: m[0] });
      } else {
        segments.push({ kind: 'att', url, name: name || '附件' });
      }
      last = m.index + m[0].length;
    }
    if (last < raw.length) {
      const h = raw.slice(last);
      if (h.trim()) segments.push({ kind: 'text', html: h });
    }
    return segments;
  };

  const segs = hasStrict ? run(strictRe) : run(looseRe);
  if (!segs.length) return null;
  const out = [];
  for (const s of segs) {
    if (s.kind === 'text') {
      out.push({ id: gid(), type: 'text', content: s.html });
    } else {
      out.push({
        id: gid(),
        type: 'attachment',
        name: String(s.name || '附件'),
        url: String(s.url || '')
      });
    }
  }
  return out.length ? out : null;
}

function labelFromNoteAttInnerText(innerText) {
  let s = String(innerText || '').replace(/\uFE0F/g, '');
  s = s.replace(/^[\s\u200B]*(?:\uD83D\uDCC4|\uD83D\uDCCE)\s*/u, '');
  return s.trim();
}

/** 先拆附件芯片，再拆地点芯片，避免多段内容糅在一个 text 的 <p> 里 */
function expandTextBlockEmbeddedChips(block, gid) {
  const seq = splitTextBlockEmbeddedAttachments(block, gid) || [block];
  const out = [];
  for (const piece of seq) {
    if (!piece || piece.type !== 'text') {
      out.push(piece);
      continue;
    }
    const locs = splitTextBlockEmbeddedLocations(piece, gid);
    if (locs) out.push.apply(out, locs);
    else out.push(piece);
  }
  return out;
}

function tryLocationFromLastNoteLocCommentBefore(htmlBefore) {
  const s = String(htmlBefore || '');
  const re = /<!--NOTELOC:[^:]+:([\s\S]*?)-->/g;
  let enc = null;
  let m;
  while ((m = re.exec(s)) !== null) enc = m[1];
  if (!enc) return null;
  try {
    const json = JSON.parse(decodeURIComponent(enc));
    const la = Number(json.latitude);
    const ln = Number(json.longitude);
    const laL = Number(json.lat);
    const lnL = Number(json.lng);
    const laFin = Number.isFinite(la)
      ? la
      : Number.isFinite(laL)
        ? laL
        : NaN;
    const lnFin = Number.isFinite(ln)
      ? ln
      : Number.isFinite(lnL)
        ? lnL
        : NaN;
    if (!Number.isFinite(laFin) || !Number.isFinite(lnFin)) return null;
    return {
      la: laFin,
      ln: lnFin,
      name: json.name != null ? String(json.name) : '',
      address: json.address != null ? String(json.address) : ''
    };
  } catch (e) {
    return null;
  }
}

function stripHtmlPlain(h) {
  return String(h)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function unescapeHtmlAttr(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

/**
 * 从仍是 text 块的内嵌 HTML 里拆出地点：含 <a class="note-loc-tag">，或旧版 p>span 紫色 chip（无坐标时 lat/lng 为 0）
 */
function splitTextBlockEmbeddedLocations(block, genId) {
  const gid = genId || genBlockId;
  const raw = String((block && block.content) || '');
  if (!raw || raw.indexOf('<') < 0) return null;
  const anchorRe =
    /<a\b(?=[^>]*\bclass=["'][^"']*note-loc-tag)([^>]*)>([\s\S]*?)<\/a>/gi;
  /** editor 可能去掉 class，但正文仍含  */
  const looseAnchorRe = /<a\b([^>]*)>([\s\S]*?[\s\S]*?)<\/a>/gi;
  const legacyPSpanRe =
    /<p\b[^>]*>\s*<span\b[^>]*style="[^"]*color:\s*rgb\(\s*113\s*,\s*94\s*,\s*189\s*\)[^"]*"[^>]*>\s*([^<]+)<\/span>\s*<\/p>/gi;
  const hasStrict = anchorRe.test(raw);
  anchorRe.lastIndex = 0;
  const hasLegacy = legacyPSpanRe.test(raw);
  legacyPSpanRe.lastIndex = 0;
  const hasLoose =
    !hasStrict &&
    !hasLegacy &&
    (() => {
      const ok = looseAnchorRe.test(raw);
      looseAnchorRe.lastIndex = 0;
      return ok;
    })();
  if (!hasStrict && !hasLegacy && !hasLoose) return null;

  const segments = [];

  const runAnchorSegments = (re) => {
    let last = 0;
    let m;
    while ((m = re.exec(raw)) !== null) {
      if (m.index > last) {
        const h = raw.slice(last, m.index);
        if (h.trim()) segments.push({ kind: 'text', html: h });
      }
      const attrs = parseDataAttrsFromTagOpen(m[1] || '');
      let la = parseFloat(attrs['data-latitude']);
      let ln = parseFloat(attrs['data-longitude']);
      let nm =
        attrs['data-loc-name'] != null
          ? attrs['data-loc-name']
          : stripHtmlPlain(m[2] || '').replace(/^\s*/, '');
      let addr =
        attrs['data-loc-address'] != null ? attrs['data-loc-address'] : '';
      const fromHref = tryLatLngNameFromNoteLocHref(attrs['href']);
      const attrsLaOk = Number.isFinite(la) && Number.isFinite(ln);
      const attrsZero =
        attrsLaOk && Math.abs(la) < 1e-8 && Math.abs(ln) < 1e-8;
      if (fromHref && (!attrsLaOk || attrsZero)) {
        la = fromHref.la;
        ln = fromHref.ln;
        if (fromHref.name && !String(nm).trim()) nm = fromHref.name;
        if (fromHref.address != null && !String(addr).trim())
          addr = fromHref.address;
      }
      const needNoteLoc =
        !Number.isFinite(la) ||
        !Number.isFinite(ln) ||
        (Math.abs(la) < 1e-8 && Math.abs(ln) < 1e-8);
      if (needNoteLoc) {
        const fromNote = tryLocationFromLastNoteLocCommentBefore(
          raw.slice(0, m.index)
        );
        if (
          fromNote &&
          Number.isFinite(fromNote.la) &&
          Number.isFinite(fromNote.ln)
        ) {
          la = fromNote.la;
          ln = fromNote.ln;
          if (fromNote.name && !String(nm).trim()) nm = fromNote.name;
          if (fromNote.address != null && !String(addr).trim())
            addr = fromNote.address;
        }
      }
      segments.push({
        kind: 'loc',
        name: nm,
        address: addr,
        la: Number.isFinite(la) ? la : 0,
        ln: Number.isFinite(ln) ? ln : 0,
        stableId: (() => {
          if (attrs['data-note-block-id'] != null) {
            const s = String(
              unescapeHtmlAttr(String(attrs['data-note-block-id']))
            ).trim();
            if (s) return s;
          }
          if (fromHref && fromHref.blockId) return String(fromHref.blockId).trim();
          return '';
        })()
      });
      last = m.index + m[0].length;
    }
    if (last < raw.length) {
      const h = raw.slice(last);
      if (h.trim()) segments.push({ kind: 'text', html: h });
    }
  };

  if (hasStrict) {
    runAnchorSegments(anchorRe);
  } else if (hasLoose) {
    runAnchorSegments(looseAnchorRe);
  } else {
    let last = 0;
    let m;
    while ((m = legacyPSpanRe.exec(raw)) !== null) {
      if (m.index > last) {
        const h = raw.slice(last, m.index);
        if (h.trim()) segments.push({ kind: 'text', html: h });
      }
      const name = String(m[1] || '').trim();
      segments.push({
        kind: 'loc',
        name: name || '地点',
        address: '',
        la: 0,
        ln: 0
      });
      last = m.index + m[0].length;
    }
    if (last < raw.length) {
      const h = raw.slice(last);
      if (h.trim()) segments.push({ kind: 'text', html: h });
    }
  }

  const out = [];
  for (const seg of segments) {
    if (seg.kind === 'text') {
      out.push({ id: gid(), type: 'text', content: seg.html });
    } else {
      out.push({
        id: seg.stableId ? String(seg.stableId) : gid(),
        type: 'location',
        name: seg.name,
        address: seg.address,
        latitude: seg.la,
        longitude: seg.ln
      });
    }
  }
  return out.length ? out : null;
}

function coerceBlocksForMpHtml(blocks, genId) {
  const gid = genId || genBlockId;
  if (!blocks || !blocks.length) return blocks;
  const out = [];
  for (const b of blocks) {
    if (!b || b.type !== 'text') {
      out.push(b);
      continue;
    }
    const expanded = expandTextBlockEmbeddedChips(b, gid);
    out.push.apply(out, expanded);
  }
  return out;
}

/** 阅读态 / 卡片预览：供 mp-html（地点样式与编辑器一致；图片不强制高度） */
function blocksToMpHtml(blocks, genId) {
  const coerced = coerceBlocksForMpHtml(blocks, genId);
  return blocksToEditorHtml(coerced, genId);
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 与外层 <p>/<span> 配对的闭合标签结束位置（exclusive），用于内容里嵌套了子 <p> 时避免误把内层 </p> 当成外层结束。
 * openTagGtInclusive：外层起始标签末尾的 `>` 下标。
 */
function findMatchingCloseEndExclusive(s, openTagGtInclusive, tagName) {
  const tn = String(tagName || 'p');
  if (!tn) return -1;
  const combined = new RegExp(`<${tn}\\b[^>]*>|</${tn}>`, 'gi');
  let depth = 1;
  combined.lastIndex = openTagGtInclusive + 1;
  let m;
  while ((m = combined.exec(s)) !== null) {
    const piece = m[0];
    if (/^<\//i.test(piece)) {
      depth--;
      if (depth === 0) return m.index + piece.length;
      if (depth < 0) return -1;
    } else {
      depth++;
    }
  }
  return -1;
}

function tryConsumeLocationParagraph(s, from) {
  if (s.length < from + 12 || s.slice(from, from + 12) !== '<!--NOTELOC:') {
    return null;
  }
  const head = /^<!--NOTELOC:([^:]+):([\s\S]*?)-->/.exec(s.slice(from));
  if (!head) return null;
  const id = head[1];
  const payloadEnc = head[2];
  let pos = from + head[0].length;
  while (pos < s.length && /\s/.test(s[pos])) pos++;
  if (pos >= s.length || s[pos] !== '<') return null;
  const gt = s.indexOf('>', pos);
  if (gt < 0) return null;
  const openTag = s.slice(pos, gt + 1);
  if (!new RegExp(`data-lid=["']${escapeRegExp(id)}["']`).test(openTag)) {
    return null;
  }
  const isP = /^<p\b/i.test(openTag);
  const isSpan = /^<span\b/i.test(openTag);
  const isDiv = /^<div\b/i.test(openTag);
  if (!isP && !isSpan && !isDiv) return null;
  const tagName = isP ? 'p' : isSpan ? 'span' : 'div';
  const endExclusive = findMatchingCloseEndExclusive(s, gt, tagName);
  if (endExclusive < 0) return null;
  const closeLen = isP ? '</p>'.length : isSpan ? '</span>'.length : '</div>'.length;
  const innerStart = gt + 1;
  const innerEnd = endExclusive - closeLen;
  return {
    end: endExclusive,
    id,
    payloadEnc,
    innerStart,
    innerEnd
  };
}

/**
 * 编辑器常剥离 NOTELOC 注释，仅留下 <p data-lid> + 内层 <a>；从锚点的 href / data-* 合成 payload，与 tryConsumeLocationParagraph 输出形状一致。
 */
function tryConsumeDataLidLocationParagraph(s, from) {
  if (from >= s.length || s[from] !== '<') return null;
  if (s.length >= from + 12 && s.slice(from, from + 12) === '<!--NOTELOC:') {
    return null;
  }
  if (s.length >= from + 12 && s.slice(from, from + 12) === '<!--NOTEATT:') {
    return null;
  }
  const gt = s.indexOf('>', from);
  if (gt < 0) return null;
  const openTag = s.slice(from, gt + 1);
  const isP = /^<p\b/i.test(openTag);
  const isSpan = /^<span\b/i.test(openTag);
  const isDiv = /^<div\b/i.test(openTag);
  if (!isP && !isSpan && !isDiv) return null;
  const lidM = /\bdata-lid=["']([^"']+)["']/.exec(openTag);
  const tagName = isP ? 'p' : isSpan ? 'span' : 'div';
  const endExclusive = findMatchingCloseEndExclusive(s, gt, tagName);
  if (endExclusive < 0) return null;
  const closeLen = isP ? '</p>'.length : isSpan ? '</span>'.length : '</div>'.length;
  const innerStart = gt + 1;
  const innerEnd = endExclusive - closeLen;
  const innerHtml = s.slice(innerStart, innerEnd);
  const am = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(innerHtml.trim());
  if (!am) return null;
  const attrs = parseDataAttrsFromTagOpen(am[1] || '');
  const hrefRaw = unescapeHtmlAttr(String(attrs['href'] || '').trim());
  const isLoc =
    /note-loc-tag/i.test(attrs['class'] || '') ||
    String(attrs['data-note-type'] || '')
      .trim()
      .toLowerCase() === 'location' ||
    (hrefRaw && hrefRaw.indexOf(NOTE_MP_LOC_HREF_PREFIX) === 0);
  if (!isLoc) return null;
  const fromHref = tryLatLngNameFromNoteLocHref(attrs['href']);
  let id = lidM ? String(lidM[1] || '').trim() : '';
  if (!id) {
    const bid =
      attrs['data-note-block-id'] != null
        ? unescapeHtmlAttr(String(attrs['data-note-block-id']))
        : '';
    id = String(bid || '').trim();
  }
  if (!id && fromHref && fromHref.blockId) {
    id = String(fromHref.blockId).trim();
  }
  if (!id) return null;
  let la = parseFloat(attrs['data-latitude']);
  let ln = parseFloat(attrs['data-longitude']);
  let nm =
    attrs['data-loc-name'] != null
      ? unescapeHtmlAttr(String(attrs['data-loc-name']))
      : '';
  let addr =
    attrs['data-loc-address'] != null
      ? unescapeHtmlAttr(String(attrs['data-loc-address']))
      : '';
  const attrsLaOk = Number.isFinite(la) && Number.isFinite(ln);
  const attrsZero =
    attrsLaOk && Math.abs(la) < 1e-8 && Math.abs(ln) < 1e-8;
  if (fromHref && (!attrsLaOk || attrsZero)) {
    la = fromHref.la;
    ln = fromHref.ln;
    if (fromHref.name && !String(nm).trim()) nm = fromHref.name;
    if (fromHref.address != null && !String(addr).trim()) {
      addr = fromHref.address;
    }
  }
  if (!String(nm).trim()) {
    nm =
      stripHtmlPlain(am[2] || '')
        .replace(/^\s*/, '')
        .trim() || '地点';
  }
  if (!Number.isFinite(la)) la = 0;
  if (!Number.isFinite(ln)) ln = 0;
  const payloadEnc = encodeURIComponent(
    JSON.stringify({
      name: String(nm),
      address: String(addr || ''),
      latitude: la,
      longitude: ln
    })
  );
  return {
    end: endExclusive,
    id,
    payloadEnc,
    innerStart,
    innerEnd
  };
}

function tryConsumeStandaloneLocationAnchor(s, from) {
  if (from >= s.length || s[from] !== '<') return null;
  const sub = s.slice(from);
  const openRe = /^<a\b([^>]*)>/i.exec(sub);
  if (!openRe) return null;
  const attrs = parseDataAttrsFromTagOpen(openRe[1] || '');
  const hrefRaw = unescapeHtmlAttr(String(attrs['href'] || '').trim());
  const isLoc =
    /note-loc-tag/i.test(attrs['class'] || '') ||
    String(attrs['data-note-type'] || '').trim().toLowerCase() === 'location' ||
    (hrefRaw && hrefRaw.indexOf(NOTE_MP_LOC_HREF_PREFIX) === 0);
  if (!isLoc) return null;
  const fromHref = tryLatLngNameFromNoteLocHref(attrs['href']);
  let id =
    attrs['data-note-block-id'] != null
      ? String(
          unescapeHtmlAttr(String(attrs['data-note-block-id'])) || ''
        ).trim()
      : '';
  if (!id && fromHref && fromHref.blockId) {
    id = String(fromHref.blockId).trim();
  }
  if (!id) return null;
  let la = parseFloat(attrs['data-latitude']);
  let ln = parseFloat(attrs['data-longitude']);
  let nm =
    attrs['data-loc-name'] != null
      ? unescapeHtmlAttr(String(attrs['data-loc-name']))
      : '';
  let addr =
    attrs['data-loc-address'] != null
      ? unescapeHtmlAttr(String(attrs['data-loc-address']))
      : '';
  const attrsLaOk = Number.isFinite(la) && Number.isFinite(ln);
  const attrsZero =
    attrsLaOk && Math.abs(la) < 1e-8 && Math.abs(ln) < 1e-8;
  if (fromHref && (!attrsLaOk || attrsZero)) {
    la = fromHref.la;
    ln = fromHref.ln;
    if (fromHref.name && !String(nm).trim()) nm = fromHref.name;
    if (fromHref.address != null && !String(addr).trim()) {
      addr = fromHref.address;
    }
  }
  const innerStartIdx = from + openRe[0].length;
  const closeRel = s.indexOf('</a>', innerStartIdx);
  if (closeRel < 0) return null;
  const innerSlice = s.slice(innerStartIdx, closeRel);
  if (!String(nm).trim()) {
    nm =
      stripHtmlPlain(innerSlice || '')
        .replace(/^\s*/, '')
        .trim() || '地点';
  }
  if (!Number.isFinite(la)) la = 0;
  if (!Number.isFinite(ln)) ln = 0;
  const endExclusive = closeRel + '</a>'.length;
  const payloadEnc = encodeURIComponent(
    JSON.stringify({
      name: String(nm),
      address: String(addr || ''),
      latitude: la,
      longitude: ln
    })
  );
  return {
    end: endExclusive,
    id,
    payloadEnc,
    innerStart: NaN,
    innerEnd: NaN
  };
}

function tryConsumeAttachmentParagraph(s, from) {
  if (s.length < from + 12 || s.slice(from, from + 12) !== '<!--NOTEATT:') {
    return null;
  }
  const head = /^<!--NOTEATT:([^:]+):([\s\S]*?)-->/.exec(s.slice(from));
  if (!head) return null;
  const id = head[1];
  const payloadEnc = head[2];
  let pos = from + head[0].length;
  while (pos < s.length && /\s/.test(s[pos])) pos++;
  if (pos >= s.length || s[pos] !== '<') return null;
  const gt = s.indexOf('>', pos);
  if (gt < 0) return null;
  const pOpenTag = s.slice(pos, gt + 1);
  if (!new RegExp(`data-aid=["']${escapeRegExp(id)}["']`).test(pOpenTag)) {
    return null;
  }
  const endExclusive = findMatchingCloseEndExclusive(s, gt, 'p');
  if (endExclusive < 0) return null;
  return { end: endExclusive, id, payloadEnc };
}

function tryConsumeImgToken(s, from) {
  if (from >= s.length || s.slice(from, from + 4).toLowerCase() !== '<img') {
    return null;
  }
  const m = /^<img[^>]*src=["']([^"']+)["'][^>]*\/?>/i.exec(s.slice(from));
  if (!m) return null;
  return { end: from + m[0].length, url: m[1] };
}

/** 去掉地点段内已输出的定位 <a>，剩余交给 ingest（避免附件/文字被和地点打成一块） */
function stripLeadingLocationAnchorHtml(innerHtml) {
  const s0 = String(innerHtml || '');
  const s = s0.replace(/^\s+/, '');
  const patterns = [
    /<a\b[^>]*\bdata-note-type=["']location["'][^>]*>[\s\S]*?<\/a>/i,
    /<a\b[^>]*\bclass="[^"]*note-loc-tag[^"]*"[^>]*>[\s\S]*?<\/a>/i,
    /<a\b[^>]*\bdata-latitude=["'][^"']+["'][^>]*\bdata-longitude=["'][^"']+["'][^>]*>[\s\S]*?<\/a>/i
  ];
  for (const re of patterns) {
    const m = re.exec(s);
    if (m && m.index === 0) {
      return s.slice(m[0].length).replace(/^\s+/, '');
    }
  }
  return s0;
}

/**
 * 解析碎片中的 NOTEATT / 图，其余累积为 text（不含 NOTELOC，防递归）
 */
function ingestEditorFragmentsNoNoteLoc(htmlFragment, blocks, genId) {
  const gid = genId || genBlockId;
  const s = String(htmlFragment || '');
  if (!s.trim()) return;
  let i = 0;
  let textStart = 0;
  const flushUpTo = (endExclusive) => {
    if (endExclusive <= textStart) return;
    const chunk = s.slice(textStart, endExclusive).trim();
    textStart = endExclusive;
    if (!chunk) return;
    if (!chunk.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()) return;
    blocks.push({ id: gid(), type: 'text', content: chunk });
  };

  while (i < s.length) {
    if (s[i] === '<') {
      const att = tryConsumeAttachmentParagraph(s, i);
      if (att) {
        if (i > textStart) flushUpTo(i);
        try {
          const json = JSON.parse(decodeURIComponent(att.payloadEnc));
          blocks.push({
            id: String(att.id),
            type: 'attachment',
            name: String(json.name || ''),
            url: String(json.url || '')
          });
        } catch (e) {
          /* skip */
        }
        textStart = att.end;
        i = att.end;
        continue;
      }
      const img = tryConsumeImgToken(s, i);
      if (img) {
        if (i > textStart) flushUpTo(i);
        blocks.push({ id: gid(), type: 'image', url: img.url });
        textStart = img.end;
        i = img.end;
        continue;
      }
    }
    i++;
  }
  flushUpTo(s.length);
}

function pushLocationBlockFromPayload(blocks, locId, payloadEnc) {
  try {
    const json = JSON.parse(decodeURIComponent(payloadEnc));
    const laRaw = Number(json.latitude);
    const lnRaw = Number(json.longitude);
    const laLegacy = Number(json.lat);
    const lnLegacy = Number(json.lng);
    const latitude = Number.isFinite(laRaw)
      ? laRaw
      : Number.isFinite(laLegacy)
        ? laLegacy
        : 0;
    const longitude = Number.isFinite(lnRaw)
      ? lnRaw
      : Number.isFinite(lnLegacy)
        ? lnLegacy
        : 0;
    blocks.push({
      id: String(locId),
      type: 'location',
      name: String(json.name || '地点'),
      address: String(json.address || ''),
      latitude,
      longitude
    });
  } catch (e) {
    /* skip corrupt */
  }
}

function normalizeEditorLocationHtml(html) {
  let s = String(html || '');
  const ops = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '<' && s.slice(i, i + 12) === '<!--NOTELOC:') {
      const loc = tryConsumeLocationParagraph(s, i);
      if (loc) {
        const segment = s.slice(i, loc.end);
        if (locationSegmentAnchorDrifted(segment, loc.payloadEnc)) {
          let anchorInner;
          try {
            const json = JSON.parse(decodeURIComponent(loc.payloadEnc));
            anchorInner = locationTagInnerHtmlAnchor(
              String(json.name || ''),
              String(json.address || ''),
              Number(json.latitude) || 0,
              Number(json.longitude) || 0,
              'editor',
              loc.id
            );
          } catch (e) {
            anchorInner = null;
          }
          if (anchorInner) {
            let rebuilt;
            let tail = '';
            if (
              Number.isFinite(loc.innerStart) &&
              loc.innerEnd > loc.innerStart
            ) {
              tail = stripLeadingLocationAnchorHtml(
                s.slice(loc.innerStart, loc.innerEnd)
              );
            }
            if (tail) {
              rebuilt =
                `<!--NOTELOC:${loc.id}:${loc.payloadEnc}-->` +
                `<p data-lid="${loc.id}" contenteditable="false" style="margin:10px;padding:0;line-height:1.5;">` +
                anchorInner +
                tail +
                '</p>';
            } else {
              rebuilt = wrapLocationEditorP(loc.id, loc.payloadEnc, anchorInner);
            }
            ops.push({
              start: i,
              end: loc.end,
              text: rebuilt
            });
          }
        }
        i = loc.end;
        continue;
      }
    }
    i++;
  }
  if (!ops.length) {
    return { html: s, changed: false };
  }
  for (let k = ops.length - 1; k >= 0; k--) {
    const op = ops[k];
    s = s.slice(0, op.start) + op.text + s.slice(op.end);
  }
  return { html: s, changed: true };
}

function locationSegmentAnchorDrifted(segment, payloadEnc) {
  try {
    const json = JSON.parse(decodeURIComponent(payloadEnc));
    const la = Number(json.latitude) || 0;
    const ln = Number(json.longitude) || 0;
    const name = String(json.name || '');
    const address = String(json.address || '');
    const am = /<a\b([^>]*)>([\s\S]*?)<\/a>/i.exec(segment);
    if (!am) return true;
    const attrs = parseDataAttrsFromTagOpen(am[1] || '');
    const alat = Number(attrs['data-latitude']);
    const alng = Number(attrs['data-longitude']);
    if (!Number.isFinite(alat) || !Number.isFinite(alng)) return true;
    if (alat !== la || alng !== ln) return true;
    if (
      unescapeHtmlAttr(attrs['data-loc-name'] || '') !== name ||
      unescapeHtmlAttr(attrs['data-loc-address'] || '') !== address
    ) {
      return true;
    }
    const innerLabel = stripHtmlPlain(am[2] || '')
      .replace(/^\s*/, '')
      .trim();
    if (innerLabel !== String(locationChipLabel(name, address) || '').trim()) {
      return true;
    }
    return false;
  } catch (e) {
    return true;
  }
}

/** 将 editor 导出的 HTML 切成 blocks；NOTELOC/NOTEATT 与紧随的整段 <p> 一起消费，避免内部 <img> 被当成独立图片块 */
function editorHtmlToBlocks(html, genId) {
  const gid = genId || genBlockId;
  const s = String(html || '');
  if (!String(s).trim()) {
    return [{ id: gid(), type: 'text', content: '' }];
  }
  const blocks = [];
  let i = 0;
  let textStart = 0;

  const flushUpTo = (endExclusive) => {
    if (endExclusive <= textStart) return;
    const chunk = s.slice(textStart, endExclusive).trim();
    textStart = endExclusive;
    if (!chunk) return;
    if (!chunk.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()) return;
    blocks.push({ id: gid(), type: 'text', content: chunk });
  };

  while (i < s.length) {
    if (s[i] === '<') {
      const loc = tryConsumeLocationParagraph(s, i);
      if (loc) {
        if (i > textStart) flushUpTo(i);
        pushLocationBlockFromPayload(blocks, loc.id, loc.payloadEnc);
        if (
          Number.isFinite(loc.innerStart) &&
          Number.isFinite(loc.innerEnd) &&
          loc.innerEnd > loc.innerStart
        ) {
          const tail = stripLeadingLocationAnchorHtml(
            s.slice(loc.innerStart, loc.innerEnd)
          );
          ingestEditorFragmentsNoNoteLoc(tail, blocks, gid);
        }
        textStart = loc.end;
        i = loc.end;
        continue;
      }
      const locDl = tryConsumeDataLidLocationParagraph(s, i);
      if (locDl) {
        if (i > textStart) flushUpTo(i);
        pushLocationBlockFromPayload(blocks, locDl.id, locDl.payloadEnc);
        if (
          Number.isFinite(locDl.innerStart) &&
          Number.isFinite(locDl.innerEnd) &&
          locDl.innerEnd > locDl.innerStart
        ) {
          const tail = stripLeadingLocationAnchorHtml(
            s.slice(locDl.innerStart, locDl.innerEnd)
          );
          ingestEditorFragmentsNoNoteLoc(tail, blocks, gid);
        }
        textStart = locDl.end;
        i = locDl.end;
        continue;
      }
      const locStandalone = tryConsumeStandaloneLocationAnchor(s, i);
      if (locStandalone) {
        if (i > textStart) flushUpTo(i);
        pushLocationBlockFromPayload(
          blocks,
          locStandalone.id,
          locStandalone.payloadEnc
        );
        textStart = locStandalone.end;
        i = locStandalone.end;
        continue;
      }
      const att = tryConsumeAttachmentParagraph(s, i);
      if (att) {
        if (i > textStart) flushUpTo(i);
        try {
          const json = JSON.parse(decodeURIComponent(att.payloadEnc));
          blocks.push({
            id: String(att.id),
            type: 'attachment',
            name: String(json.name || ''),
            url: String(json.url || '')
          });
        } catch (e) {
          /* skip */
        }
        textStart = att.end;
        i = att.end;
        continue;
      }
      const img = tryConsumeImgToken(s, i);
      if (img) {
        if (i > textStart) flushUpTo(i);
        blocks.push({ id: gid(), type: 'image', url: img.url });
        textStart = img.end;
        i = img.end;
        continue;
      }
    }
    i++;
  }
  flushUpTo(s.length);

  if (!blocks.length) {
    const plain = stripHtmlPlain(s);
    blocks.push({
      id: gid(),
      type: 'text',
      content: plain || stripHtmlPlain(s.replace(/<p>/gi, '').replace(/<\/p>/gi, '\n'))
    });
  }
  return blocks;
}

function mergeNoteBlocksForRead(blocks) {
  if (!blocks || !blocks.length) return [];
  const out = [];
  let buf = [];
  const flush = () => {
    if (!buf.length) return;
    if (buf.length === 1) {
      out.push(buf[0]);
    } else {
      const content = buf.map((b) => b.content || '').join('<br/>');
      out.push({
        id: buf[0].id,
        type: 'text',
        content
      });
    }
    buf = [];
  };
  for (const b of blocks) {
    if (b && b.type === 'text') buf.push(b);
    else {
      flush();
      if (b) out.push(b);
    }
  }
  flush();
  return out;
}

/** 先把 text 里内嵌的地点/附件拆成独立块，再合并相邻纯文字（与 blocksToMpHtml 前置结构一致，供链接坐标回退与阅读合并） */
function mergeNoteBlocksForReadWithEmbeddedCoerce(blocks, genId) {
  const expanded = coerceBlocksForMpHtml(blocks, genId);
  return mergeNoteBlocksForRead(expanded);
}

/** editorHtmlToBlocks 之后：把仍揉在 text 里的地点/附件芯片拆成独立块（真机常把整段导出成一个 text） */
function expandParsedEditorBlocks(blocks, genId) {
  const gid = genId || genBlockId;
  if (!Array.isArray(blocks) || !blocks.length) return blocks;
  const out = [];
  for (const b of blocks) {
    if (
      !b ||
      String(b.type || '').trim().toLowerCase() !== 'text'
    ) {
      out.push(b);
      continue;
    }
    const expanded = expandTextBlockEmbeddedChips(b, gid);
    for (const p of expanded) out.push(p);
  }
  return out.length ? out : blocks;
}

module.exports = {
  escapeHtml,
  stripHtmlPlain,
  blocksToEditorHtml,
  editorHtmlToBlocks,
  mergeNoteBlocksForRead,
  mergeNoteBlocksForReadWithEmbeddedCoerce,
  buildLocationEditorParagraph,
  buildAttachmentEditorParagraph,
  locationChipLabel,
  locationTagInnerHtmlAnchor,
  blocksToMpHtml,
  coerceBlocksForMpHtml,
  expandParsedEditorBlocks,
  normalizeEditorLocationHtml,
  NOTE_IMG_HTML_STYLE,
  NOTE_MP_LOC_HREF_PREFIX,
  NOTE_MP_ATT_HREF_PREFIX
};
