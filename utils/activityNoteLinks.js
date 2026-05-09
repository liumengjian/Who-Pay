/** mp-html / editor linktap：芯片用 DOM id（与 linkMap key 相同）对应；兼容 detail 与 href */
const noteStore = require('./activityNoteStorage.js');

function parseHrefQueryString(qs) {
  const o = {};
  String(qs || '')
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
  return o;
}

function parseNoteLocParamsFromHref(href) {
  if (!href || typeof href !== 'string') return null;
  let qs = '';
  if (href.indexOf('whopay-noteloc://open') === 0) {
    qs = href.split('?')[1] || '';
  } else {
    const prefix = 'https://whopay.local/note-loc?';
    if (href.indexOf(prefix) === 0) {
      qs = href.slice(prefix.length);
    } else {
      return null;
    }
  }
  const o = parseHrefQueryString(qs.split('#')[0]);
  if (!o || typeof o !== 'object') return null;
  const latRaw = o.lat != null && o.lat !== '' ? o.lat : o.latitude;
  const lngRaw = o.lng != null && o.lng !== '' ? o.lng : o.longitude;
  const la = parseFloat(latRaw);
  const ln = parseFloat(lngRaw);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (Math.abs(la) < 1e-8 && Math.abs(ln) < 1e-8) return null;
  return {
    lat: String(la),
    lng: String(ln),
    name: o.name != null ? String(o.name) : '',
    address: o.address != null ? String(o.address) : ''
  };
}

/** mp-html linktap：detail 为节点 attrs 与 innerText 的合并，见 https://jin-yufeng.github.io/mp-html */
function readHrefFromMpHtmlLinkTap(e) {
  const d = (e && e.detail) || {};
  const tryKeys = (o, keys) => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };
  const direct = tryKeys(d, ['href', 'HREF']);
  if (direct) return direct;
  for (const k of Object.keys(d)) {
    if (k === 'innerText') continue;
    const v = d[k];
    if (typeof v !== 'string' || !v.trim()) continue;
    if (v.indexOf('whopay.local/note-chip') >= 0) return v.trim();
    if (v.indexOf('whopay.local/note-loc') >= 0) return v.trim();
    if (v.indexOf('whopay.local/note-att') >= 0) return v.trim();
    if (v.indexOf('whopay-noteloc://') === 0) return v.trim();
    if (v.indexOf('whopay-noteatt://') === 0) return v.trim();
  }
  return '';
}

function mapOwnKey(map, s0) {
  if (!map || s0 == null) return '';
  const t = String(s0).trim();
  if (!t) return '';
  if (Object.prototype.hasOwnProperty.call(map, t)) return t;
  try {
    const dec = decodeURIComponent(t);
    if (dec && Object.prototype.hasOwnProperty.call(map, dec)) return dec;
  } catch (_) {
    /* ignore */
  }
  return '';
}

/**
 * 点击链：优先取与 linkMap 一致的 id（DOM id / detail.id），再尝试 href 中的芯片 id
 */
function resolveNoteChipIdFromLinkTap(e, linkMap) {
  const map =
    linkMap && typeof linkMap === 'object' && !Array.isArray(linkMap)
      ? linkMap
      : null;
  const d = (e && e.detail) || {};

  const tryHit = (raw) => mapOwnKey(map, raw);

  if (map && Object.keys(map).length > 0) {
    const ordered = [
      e && e.currentTarget && e.currentTarget.id,
      e && e.target && e.target.id,
      d.id,
      d.Id,
      d['data-chip-id'],
      d.dataChipId
    ];
    for (const c of ordered) {
      const hit = tryHit(c);
      if (hit) return hit;
    }
    for (const k of Object.keys(d)) {
      if (k === 'innerText' || k === 'source') continue;
      const v = d[k];
      if (typeof v === 'string') {
        const hit = tryHit(v);
        if (hit) return hit;
      }
    }
    const href = readHrefFromMpHtmlLinkTap(e);
    const pref = noteStore.NOTE_CHIP_HREF_PREFIX;
    if (href && href.indexOf(pref) === 0) {
      const rest = String(href.slice(pref.length).split('#')[0] || '').trim();
      if (rest.indexOf('=') < 0 && rest) {
        let hit = tryHit(rest);
        if (hit) return hit;
        try {
          hit = tryHit(decodeURIComponent(rest));
          if (hit) return hit;
        } catch (_) {
          /* ignore */
        }
      } else {
        const o = parseHrefQueryString(rest);
        if (o.k != null) {
          const hit = tryHit(o.k);
          if (hit) return hit;
        }
      }
    }
    const byInner = resolveNoteChipIdFromLinkMapByInnerText(d, map);
    if (byInner) return byInner;
  }
  return readChipIdFromLinkTapFallback(e);
}

/** 无 linkMap 或无法按 map 命中时的兜底（仍读 id / data-* / href） */
function readChipIdFromLinkTapFallback(e) {
  const d = (e && e.detail) || {};
  const ordered = [
    e && e.currentTarget && e.currentTarget.id,
    e && e.target && e.target.id,
    d.id,
    d.Id,
    d['data-chip-id'],
    d.dataChipId
  ];
  for (const c of ordered) {
    if (c != null && String(c).trim()) return String(c).trim();
  }
  const href = readHrefFromMpHtmlLinkTap(e);
  const pref = noteStore.NOTE_CHIP_HREF_PREFIX;
  if (href && href.indexOf(pref) === 0) {
    const rest = href.slice(pref.length).split('#')[0];
    if (rest.indexOf('=') < 0 && String(rest).trim()) {
      try {
        return decodeURIComponent(String(rest).trim());
      } catch (_) {
        return String(rest).trim();
      }
    }
    const o = parseHrefQueryString(rest);
    if (o.k != null && String(o.k).trim()) return String(o.k).trim();
  }
  return '';
}

function readChipIdFromLinkTap(e) {
  return readChipIdFromLinkTapFallback(e);
}

function readDetailStr(d, keys) {
  for (const k of keys) {
    const v = d[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function readDetailFloat(d, keys) {
  for (const k of keys) {
    const n = parseFloat(d[k]);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

/** 打开微信地图（可在地图页使用「导航」等到目的地） */
function openWxMapNavigationForNote(locParams, showError) {
  const show = typeof showError === 'function' ? showError : () => {};
  if (!locParams) {
    show('地点参数无效');
    return;
  }
  const la = parseFloat(locParams.lat);
  const ln = parseFloat(locParams.lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    show('地点坐标无效');
    return;
  }
  wx.openLocation({
    latitude: la,
    longitude: ln,
    name: (locParams.name && String(locParams.name).trim()) || '地点',
    address: (locParams.address && String(locParams.address)) || '',
    scale: 15,
    fail: (err) => {
      const msg = (err && err.errMsg) || '';
      if (msg.indexOf('cancel') >= 0) return;
      show(msg || '无法打开地图');
    }
  });
}

function parseNoteAttParamsFromHref(href) {
  if (!href || typeof href !== 'string') return null;
  if (href.indexOf('whopay-noteatt://open') === 0) {
    return parseHrefQueryString(href.split('?')[1] || '');
  }
  const prefix = 'https://whopay.local/note-att?';
  if (href.indexOf(prefix) === 0) {
    return parseHrefQueryString(href.slice(prefix.length));
  }
  return null;
}

/** wx.openDocument 可选 fileType；可从文件名或 URL 路径猜扩展名 */
function inferWxOpenDocumentFileType(fileName, urlHint) {
  const tryExt = (s) => {
    const n = String(s || '').toLowerCase();
    const m = n.match(/\.([a-z0-9]+)(?:\?|#|$)/);
    if (!m) return '';
    const ext = m[1];
    return /^(pdf|doc|docx|xls|xlsx|ppt|pptx)$/.test(ext) ? ext : '';
  };
  const fromName = tryExt(fileName);
  if (fromName) return fromName;
  return tryExt(urlHint);
}

/** linktap detail 里兼容多种 data-* / dataset 键名 */
function readAttachmentDataFileUrlFromDetail(d) {
  if (!d || typeof d !== 'object') return '';
  const keys = [
    'data-file-url',
    'dataFileUrl',
    'data-file_url',
    'fileUrl',
    'file-url'
  ];
  for (const k of keys) {
    const v = d[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

/**
 * fileType 与真实类型不一致时部分机型打开失败：失败则去掉 fileType 再试一次
 */
function invokeOpenDocumentWithRetry(filePath, fileType, showError) {
  const show = typeof showError === 'function' ? showError : () => {};
  const once = (withType) => {
    const o = { filePath, showMenu: true };
    if (withType && fileType) o.fileType = fileType;
    wx.openDocument({
      ...o,
      fail: (err) => {
        if (withType && fileType) once(false);
        else show((err && err.errMsg) || '无法打开文件');
      }
    });
  };
  once(true);
}

function readTapNoteLocationFromEvent(e) {
  const mk = (e && e.mark) || {};
  const ds = (e && e.currentTarget && e.currentTarget.dataset) || {};
  const pick = (o, a, b) => {
    const u = o[a];
    const v = o[b];
    const s =
      u != null && u !== ''
        ? u
        : v != null && v !== ''
          ? v
          : '';
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };
  let la = pick(mk, 'lat', 'latitude');
  let ln = pick(mk, 'lng', 'longitude');
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    la = pick(ds, 'lat', 'latitude');
    ln = pick(ds, 'lng', 'longitude');
  }
  const nameVal = mk.name != null && mk.name !== '' ? mk.name : ds.name;
  const addrVal =
    mk.address != null && mk.address !== '' ? mk.address : ds.address;
  const blockId =
    mk.locid != null && mk.locid !== ''
      ? mk.locid
      : ds.locId != null && ds.locId !== ''
        ? ds.locId
        : ds.id != null && ds.id !== ''
          ? ds.id
          : null;
  return {
    la,
    ln,
    name: nameVal,
    address: addrVal,
    blockId
  };
}

function resolveNoteLocationForOpenLocation(page, e) {
  const { la, ln, name, address, blockId } = readTapNoteLocationFromEvent(e);
  let outLa = la;
  let outLn = ln;
  let outName = name;
  let outAddr = address;
  if (!Number.isFinite(outLa) || !Number.isFinite(outLn)) {
    if (blockId != null && blockId !== '') {
      const merged = page.data.noteReadMergedBlocks || [];
      const raw = page.data.activityNoteBlocks || [];
      const hit =
        merged.find(
          (x) => x && x.type === 'location' && String(x.id) === String(blockId)
        ) ||
        raw.find(
          (x) => x && x.type === 'location' && String(x.id) === String(blockId)
        );
      if (hit) {
        outLa = Number(hit.latitude);
        outLn = Number(hit.longitude);
        outName = hit.name;
        outAddr = hit.address;
      }
    }
  }
  if (!Number.isFinite(outLa) || !Number.isFinite(outLn)) {
    return { ok: false };
  }
  return {
    ok: true,
    la: outLa,
    ln: outLn,
    name: outName,
    addr: outAddr
  };
}

function labelFromNoteLocInnerText(innerText) {
  return String(innerText || '')
    .replace(/\uFE0F/g, '')
    .replace(/^[\s\u200B]*\uD83D\uDCCD\s*/u, '')
    .trim();
}

function labelFromNoteAttInnerText(innerText) {
  let s = String(innerText || '').replace(/\uFE0F/g, '');
  s = s.replace(/^[\s\u200B]*(?:\uD83D\uDCC4|\uD83D\uDCCE)\s*/u, '');
  return s.trim();
}

/**
 * 部分环境下 mp-html linktap 的 detail 无 id/href，仅有 innerText；按 chip 展示名在 linkMap 中唯一命中
 */
function resolveNoteChipIdFromLinkMapByInnerText(d, linkMap) {
  const map = linkMap && typeof linkMap === 'object' ? linkMap : {};
  const innerRaw = d.innerText != null ? String(d.innerText) : '';
  if (!innerRaw.trim()) return '';

  const locLabel = labelFromNoteLocInnerText(innerRaw);
  if (locLabel) {
    const hits = [];
    for (const k of Object.keys(map)) {
      const ent = map[k];
      if (!ent || ent.kind !== 'loc') continue;
      if (String(ent.name || '').trim() === locLabel) hits.push(k);
    }
    if (hits.length === 1) return hits[0];
  }

  const attLabel = labelFromNoteAttInnerText(innerRaw);
  if (attLabel) {
    const hits = [];
    for (const k of Object.keys(map)) {
      const ent = map[k];
      if (!ent || ent.kind !== 'att') continue;
      if (String(ent.name || '').trim() === attLabel) hits.push(k);
    }
    if (hits.length === 1) return hits[0];
  }

  return '';
}

function resolveNoteAttachmentFromBlocksByLabel(innerText, blocks) {
  const label = labelFromNoteAttInnerText(innerText);
  if (!label || !blocks || !blocks.length) return null;
  const atts = blocks.filter(
    (b) => b && String(b.type || '').trim().toLowerCase() === 'attachment'
  );
  if (!atts.length) return null;
  const exact = atts.find((b) => String(b.name || '').trim() === label);
  const hit =
    exact ||
    atts.find(
      (b) =>
        label.includes(String(b.name || '').trim()) ||
        String(b.name || '').trim().includes(label)
    );
  if (!hit || !hit.url) return null;
  return { url: String(hit.url), name: String(hit.name || label || '') };
}

/**
 * 微信 editor getContents 常剥掉 <a> 的 href/data-*，linktap detail 只剩 innerText；用笔记 blocks 按地点名回退解析坐标
 */
function resolveNoteLocationFromBlocksByLabel(innerText, blocks) {
  const label = labelFromNoteLocInnerText(innerText);
  if (!label || !blocks || !blocks.length) return null;
  const locs = blocks.filter(
    (b) => b && String(b.type || '').trim().toLowerCase() === 'location'
  );
  if (!locs.length) return null;
  const exact = locs.find((b) => String(b.name || '').trim() === label);
  const hit =
    exact ||
    locs.find(
      (b) =>
        label.includes(String(b.name || '').trim()) ||
        String(b.name || '').trim().includes(label)
    );
  if (!hit) return null;
  const la = Number(hit.latitude);
  const ln = Number(hit.longitude);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (Math.abs(la) < 1e-8 && Math.abs(ln) < 1e-8) return null;
  return {
    lat: String(la),
    lng: String(ln),
    name: hit.name != null ? String(hit.name) : label,
    address: hit.address != null ? String(hit.address) : ''
  };
}

function tryOpenNoteLocationFromStrippedLinkTap(d, noteBlocksForLocResolve, show) {
  const innerRaw = d.innerText != null ? String(d.innerText) : '';
  const blocks = noteBlocksForLocResolve;
  if (!blocks || !blocks.length) return false;
  const locParams = resolveNoteLocationFromBlocksByLabel(innerRaw, blocks);
  if (!locParams) return false;
  openWxMapNavigationForNote(locParams, show);
  return true;
}

function tryOpenNoteAttachmentFromStrippedLinkTap(
  d,
  noteBlocksForResolve,
  openAtt
) {
  const innerRaw = d.innerText != null ? String(d.innerText) : '';
  if (!innerRaw) return false;
  const blocks = noteBlocksForResolve;
  if (!blocks || !blocks.length) return false;
  const hit = resolveNoteAttachmentFromBlocksByLabel(innerRaw, blocks);
  if (!hit || !hit.url) return false;
  const open = typeof openAtt === 'function' ? openAtt : () => {};
  open(hit);
  return true;
}

function dispatchActivityNoteMpHtmlLinkTap(
  e,
  { showError, openNoteAttachment, linkMap, noteBlocksForLocResolve }
) {
  const d = (e && e.detail) || {};
  const show = typeof showError === 'function' ? showError : () => {};
  const openAtt =
    typeof openNoteAttachment === 'function' ? openNoteAttachment : () => {};
  const map =
    linkMap && typeof linkMap === 'object' && !Array.isArray(linkMap)
      ? linkMap
      : {};

  const chipId = resolveNoteChipIdFromLinkTap(e, map);
  console.warn("map",chipId,map)
  if (chipId && map[chipId]) {
    const ent = map[chipId];
    if (ent && ent.kind === 'loc') {
      openWxMapNavigationForNote(
        {
          lat: String(ent.lat),
          lng: String(ent.lng),
          name: (ent.name && String(ent.name).trim()) || '地点',
          address: ent.address != null ? String(ent.address) : ''
        },
        show
      );
      return;
    }
    if (ent && ent.kind === 'att' && ent.url) {
      openAtt({ url: String(ent.url), name: String(ent.name || '') });
      return;
    }
  }

  const typeRaw = readDetailStr(d, [
    'data-note-type',
    'dataNoteType'
  ]).toLowerCase();
  const la = readDetailFloat(d, [
    'data-latitude',
    'dataLatitude',
    'latitude'
  ]);
  const ln = readDetailFloat(d, [
    'data-longitude',
    'dataLongitude',
    'longitude'
  ]);
  const coordsOk =
    Number.isFinite(la) &&
    Number.isFinite(ln) &&
    (Math.abs(la) > 1e-8 || Math.abs(ln) > 1e-8);

  if (typeRaw === 'attachment') {
    const fileUrl =
      d['data-file-url'] != null ? String(d['data-file-url']).trim() : '';
    const fileUrlAlt =
      d['dataFileUrl'] != null ? String(d['dataFileUrl']).trim() : '';
    const url =
      fileUrl ||
      fileUrlAlt ||
      readAttachmentDataFileUrlFromDetail(d);
    if (url) {
      const nm =
        d['data-file-name'] != null
          ? String(d['data-file-name']).trim()
          : d['dataFileName'] != null
            ? String(d['dataFileName']).trim()
            : '';
      openAtt({ url, name: nm });
      return;
    }
    const innerTxt = d.innerText != null ? String(d.innerText) : '';
    const fromBlocks = resolveNoteAttachmentFromBlocksByLabel(
      innerTxt,
      noteBlocksForLocResolve
    );
    if (fromBlocks && fromBlocks.url) {
      openAtt(fromBlocks);
      return;
    }
  }

  if (typeRaw === 'location' || (coordsOk && typeRaw !== 'attachment')) {
    if (coordsOk) {
      const nm = readDetailStr(d, ['data-loc-name', 'dataLocName', 'name']);
      const ad = readDetailStr(d, [
        'data-loc-address',
        'dataLocAddress',
        'address'
      ]);
      openWxMapNavigationForNote(
        {
          lat: String(la),
          lng: String(ln),
          name: nm,
          address: ad
        },
        show
      );
      return;
    }
    if (tryOpenNoteLocationFromStrippedLinkTap(d, noteBlocksForLocResolve, show)) {
      return;
    }
  }

  const href = readHrefFromMpHtmlLinkTap(e);
  if (!href) {
    if (
      tryOpenNoteAttachmentFromStrippedLinkTap(
        d,
        noteBlocksForLocResolve,
        openAtt
      )
    ) {
      return;
    }
    tryOpenNoteLocationFromStrippedLinkTap(d, noteBlocksForLocResolve, show);
    return;
  }
  const locParams = parseNoteLocParamsFromHref(href);
  if (locParams) {
    openWxMapNavigationForNote(locParams, show);
    return;
  }
  const attParams = parseNoteAttParamsFromHref(href);
  if (attParams && attParams.url) {
    openAtt({
      url: String(attParams.url),
      name: attParams.name != null ? String(attParams.name) : ''
    });
    return;
  }
  if (
    !tryOpenNoteAttachmentFromStrippedLinkTap(
      d,
      noteBlocksForLocResolve,
      openAtt
    )
  ) {
    tryOpenNoteLocationFromStrippedLinkTap(d, noteBlocksForLocResolve, show);
  }
}

module.exports = {
  parseHrefQueryString,
  parseNoteLocParamsFromHref,
  parseNoteAttParamsFromHref,
  inferWxOpenDocumentFileType,
  invokeOpenDocumentWithRetry,
  readAttachmentDataFileUrlFromDetail,
  readTapNoteLocationFromEvent,
  resolveNoteLocationForOpenLocation,
  readHrefFromMpHtmlLinkTap,
  openWxMapNavigationForNote,
  readChipIdFromLinkTap,
  resolveNoteChipIdFromLinkTap,
  dispatchActivityNoteMpHtmlLinkTap,
  resolveNoteLocationFromBlocksByLabel,
  resolveNoteAttachmentFromBlocksByLabel,
  labelFromNoteLocInnerText,
  labelFromNoteAttInnerText
};
