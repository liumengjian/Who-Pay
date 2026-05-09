'use strict';

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function hsvToRgb(h, s, v) {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) {
    rp = c;
    gp = x;
  } else if (hh < 120) {
    rp = x;
    gp = c;
  } else if (hh < 180) {
    gp = c;
    bp = x;
  } else if (hh < 240) {
    gp = x;
    bp = c;
  } else if (hh < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  return [
    Math.round((rp + m) * 255),
    Math.round((gp + m) * 255),
    Math.round((bp + m) * 255)
  ];
}

function rgbToHexLower(r, g, b) {
  const h = (n) =>
    ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2);
  return '#' + h(r) + h(g) + h(b);
}

function rgbaCss(r, g, b, a) {
  return `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${clamp01(a)})`;
}

/**
 * 按触点相对盘心的方位角取色相：顶为 0°，顺时针增加。
 * rIn/rOut 保留兼容调用方；色相仅依赖方向，内白芯与环上同角度一致，故不再对内径返回 null（避免“划不动”）。
 * 仅当触点与盘心重合无法定方向时返回 null。
 */
function clientPointToHue(cx, cy, rIn, rOut, clientX, clientY) {
  const dx = clientX - cx;
  const dy = clientY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1e-3) return null;
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  deg = (deg + 90 + 360) % 360;
  return deg;
}

function clientPointToLinear01(left, width, clientX) {
  if (width <= 0) return 0;
  return clamp01((clientX - left) / width);
}

module.exports = {
  clamp01,
  hsvToRgb,
  rgbToHexLower,
  rgbaCss,
  clientPointToHue,
  clientPointToLinear01
};
