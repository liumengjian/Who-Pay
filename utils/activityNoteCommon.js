/** 活动笔记：与 API 交互、展示清洗（activity/detail 与 activity/note 共用） */
const cloudStorage = require('./cloudStorage.js');

function genBlockId() {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function computeNoteHasPreview(blocks) {
  if (!blocks || !blocks.length) return false;
  return blocks.some((b) => {
    if (b.type === 'text') return !!(b.content && String(b.content).trim());
    if (b.type === 'image') return !!b.url;
    if (b.type === 'location') return !!b.name;
    if (b.type === 'attachment') return !!(b.name && b.url);
    return false;
  });
}

function isMediaReferenceReadyForServer(u) {
  if (!u || typeof u !== 'string') return false;
  if (cloudStorage.isCloudFileId(u)) return true;
  if (u.startsWith('data:')) return true;
  if (u.startsWith('/images/')) return true;
  if (/^https:\/\//i.test(u) && !/^https?:\/\/(tmp|usr)\//i.test(u)) return true;
  if (/^http:\/\//i.test(u) && !/^http:\/\/(tmp|usr)\//i.test(u)) return true;
  return false;
}

async function normalizeNoteBlocksForApi(blocks, activityId) {
  if (!blocks || !blocks.length) return [];
  const aid = activityId != null ? String(activityId) : '';
  const out = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    const t = String(b.type || '')
      .trim()
      .toLowerCase();
    if (!t) continue;
    const id = b.id || genBlockId();
    if (t === 'text') {
      out.push({ id, type: 'text', content: String(b.content ?? '') });
    } else if (t === 'image') {
      const u = b.url || '';
      if (!u) continue;
      if (
        isMediaReferenceReadyForServer(u) &&
        !cloudStorage.isLikelyEphemeralLocal(u)
      ) {
        out.push({ id, type: 'image', url: u });
        continue;
      }
      if (!aid) continue;
      try {
        const cloudPath = `activities/${aid}/notes/img_${id}_${Date.now()}.jpg`;
        const fid = await cloudStorage.migrateImageUrlToCloudIfNeeded(
          u,
          cloudPath
        );
        if (fid) out.push({ id, type: 'image', url: fid });
      } catch (e) {
        console.error('note image cloud upload', e);
      }
    } else if (t === 'location') {
      const laRaw = Number(b.latitude);
      const lnRaw = Number(b.longitude);
      const laLeg = Number(b.lat);
      const lnLeg = Number(b.lng);
      const latitude = Number.isFinite(laRaw)
        ? laRaw
        : Number.isFinite(laLeg)
          ? laLeg
          : 0;
      const longitude = Number.isFinite(lnRaw)
        ? lnRaw
        : Number.isFinite(lnLeg)
          ? lnLeg
          : 0;
      out.push({
        id,
        type: 'location',
        name: String(b.name || ''),
        address: String(b.address || ''),
        latitude,
        longitude
      });
    } else if (t === 'attachment') {
      const u = b.url || '';
      const name = String(b.name || '');
      if (!name || !u) continue;
      if (
        isMediaReferenceReadyForServer(u) &&
        !cloudStorage.isLikelyEphemeralLocal(u)
      ) {
        out.push({ id, type: 'attachment', name, url: u });
        continue;
      }
      if (!aid) continue;
      try {
        const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] || 'bin';
        const cloudPath = `activities/${aid}/notes/att_${id}_${Date.now()}.${ext}`;
        const fid = await cloudStorage.migrateAttachmentUrlToCloudIfNeeded(
          u,
          cloudPath
        );
        if (fid) out.push({ id, type: 'attachment', name, url: fid });
      } catch (e) {
        console.error('note attachment', e);
      }
    }
  }
  return out;
}

function sanitizeNoteBlocksForView(blocks) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((b) => {
      if (!b || typeof b !== 'object') return null;
      const type = String(b.type || '')
        .trim()
        .toLowerCase();
      const id = b.id != null ? String(b.id) : genBlockId();
      if (type === 'text') {
        return { id, type: 'text', content: String(b.content ?? '') };
      }
      if (type === 'image') {
        const url = String(b.url || '').trim();
        if (!url) return null;
        return { id, type: 'image', url };
      }
      if (type === 'location') {
        const name = String(b.name || '').trim();
        if (!name) return null;
        const laRaw = Number(b.latitude);
        const lnRaw = Number(b.longitude);
        const laLegacy = Number(b.lat);
        const lnLegacy = Number(b.lng);
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
        return {
          id,
          type: 'location',
          name,
          address: String(b.address || ''),
          latitude,
          longitude
        };
      }
      if (type === 'attachment') {
        const name = String(b.name || '').trim();
        const url = String(b.url || '').trim();
        if (!name || !url) return null;
        return { id, type: 'attachment', name, url };
      }
      return null;
    })
    .filter(Boolean);
}

/** 从块上读取经纬度（兼容 lat/lng） */
function locationCoordsFromBlock(b) {
  if (!b || typeof b !== 'object') return { la: NaN, ln: NaN };
  const laRaw = Number(b.latitude);
  const lnRaw = Number(b.longitude);
  const laLeg = Number(b.lat);
  const lnLeg = Number(b.lng);
  const la = Number.isFinite(laRaw)
    ? laRaw
    : Number.isFinite(laLeg)
      ? laLeg
      : NaN;
  const ln = Number.isFinite(lnRaw)
    ? lnRaw
    : Number.isFinite(lnLeg)
      ? lnLeg
      : NaN;
  return { la, ln };
}

function locationCoordsMissingOrZero(la, ln) {
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return true;
  if (Math.abs(la) < 1e-8 && Math.abs(ln) < 1e-8) return true;
  return false;
}

/**
 * 保存前：editor 导出可能剥掉 NOTELOC 注释但仍保留 <p data-lid>/<span data-lid>，用快照里的 location 块恢复结构化坐标，避免入库后只剩无坐标正文
 */
function reconcileTextBlocksWithLocationSnapshot(blocks, snapshot) {
  if (!Array.isArray(blocks) || !Array.isArray(snapshot) || !snapshot.length) {
    return blocks;
  }
  const byId = Object.create(null);
  for (const b of snapshot) {
    if (
      b &&
      String(b.type || '').trim().toLowerCase() === 'location' &&
      b.id != null &&
      String(b.id).trim() !== ''
    ) {
      byId[String(b.id)] = b;
    }
  }
  if (!Object.keys(byId).length) return blocks;

  const lidRe = /\bdata-lid=(["'])([^"']+)\1/gi;
  const allLidsResolvable = (raw) => {
    const s = String(raw || '');
    let m;
    lidRe.lastIndex = 0;
    let any = false;
    while ((m = lidRe.exec(s)) !== null) {
      any = true;
      if (!byId[m[2]]) return false;
    }
    return any;
  };

  const out = [];
  for (const b of blocks) {
    if (!b || String(b.type || '').trim().toLowerCase() !== 'text') {
      out.push(b);
      continue;
    }
    const raw = String(b.content || '');
    if (!allLidsResolvable(raw)) {
      out.push(b);
      continue;
    }

    const locWrapRe =
      /<(p|span|div)\b[^>]*\bdata-lid=(["'])([^"']+)\2[^>]*>[\s\S]*?<\/\1>/gi;
    let last = 0;
    let m;
    let splitCount = 0;
    while ((m = locWrapRe.exec(raw)) !== null) {
      const id = m[3];
      const loc = byId[id];
      if (!loc) {
        last = m.index + m[0].length;
        continue;
      }
      splitCount += 1;
      if (m.index > last) {
        const prefix = raw.slice(last, m.index);
        if (prefix.trim()) {
          out.push({ ...b, id: genBlockId(), content: prefix });
        }
      }
      const la0 = locationCoordsFromBlock(loc);
      out.push({
        id: String(loc.id || id),
        type: 'location',
        name: String(loc.name || ''),
        address: String(loc.address || ''),
        latitude: Number.isFinite(la0.la) ? la0.la : 0,
        longitude: Number.isFinite(la0.ln) ? la0.ln : 0
      });
      last = m.index + m[0].length;
    }
    if (!splitCount) {
      out.push(b);
      continue;
    }
    if (last < raw.length) {
      const rest = raw.slice(last);
      if (rest.trim()) {
        out.push({ ...b, id: genBlockId(), content: rest });
      }
    }
  }
  return out.length ? out : blocks;
}

/**
 * editorHtmlToBlocks 可能产出 id 正确但坐标已被剥成 0 的 location 块（reconcile 只拆 text，不拆已是 location 的项）。
 * 保存前用快照里同 id 的地点坐标覆盖；pendingById 为选点后立即写入的坐标（优先于快照）。
 */
function reconcileLocationBlockCoordsFromSnapshot(
  blocks,
  snapshot,
  pendingById
) {
  if (!Array.isArray(blocks) || !blocks.length) return blocks;
  const byId = Object.create(null);
  if (Array.isArray(snapshot) && snapshot.length) {
    for (const b of snapshot) {
      if (
        b &&
        String(b.type || '').trim().toLowerCase() === 'location' &&
        b.id != null &&
        String(b.id).trim() !== ''
      ) {
        byId[String(b.id)] = b;
      }
    }
  }
  if (pendingById && typeof pendingById === 'object') {
    for (const id of Object.keys(pendingById)) {
      const p = pendingById[id];
      if (!p || typeof p !== 'object') continue;
      const la = Number(
        p.latitude != null ? p.latitude : p.lat != null ? p.lat : NaN
      );
      const ln = Number(
        p.longitude != null ? p.longitude : p.lng != null ? p.lng : NaN
      );
      if (!Number.isFinite(la) || !Number.isFinite(ln)) continue;
      if (Math.abs(la) < 1e-8 && Math.abs(ln) < 1e-8) continue;
      const prev = byId[id];
      byId[id] = {
        id,
        type: 'location',
        name: String(
          (p.name != null ? p.name : '') || (prev && prev.name) || ''
        ),
        address: String(
          (p.address != null ? p.address : '') || (prev && prev.address) || ''
        ),
        latitude: la,
        longitude: ln
      };
    }
  }
  if (!Object.keys(byId).length) return blocks;

  return blocks.map((b) => {
    if (!b || String(b.type || '').trim().toLowerCase() !== 'location') {
      return b;
    }
    const cur = locationCoordsFromBlock(b);
    if (!locationCoordsMissingOrZero(cur.la, cur.ln)) return b;
    const snap = byId[String(b.id)];
    if (!snap) return b;
    const s = locationCoordsFromBlock(snap);
    if (locationCoordsMissingOrZero(s.la, s.ln)) return b;
    return {
      ...b,
      latitude: s.la,
      longitude: s.ln,
      name: String(b.name || snap.name || ''),
      address: String(
        b.address != null && String(b.address) !== ''
          ? b.address
          : snap.address || ''
      )
    };
  });
}

module.exports = {
  genBlockId,
  computeNoteHasPreview,
  isMediaReferenceReadyForServer,
  normalizeNoteBlocksForApi,
  sanitizeNoteBlocksForView,
  reconcileTextBlocksWithLocationSnapshot,
  reconcileLocationBlockCoordsFromSnapshot
};
