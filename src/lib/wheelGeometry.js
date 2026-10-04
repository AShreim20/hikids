// Pure geometry for the prize wheel — no React, no DOM, so it can be tested
// in isolation. Two concepts are deliberately kept apart:
//
//   VISUAL SEGMENT SIZE  = 360 / (number of active rewards). Always equal.
//   WIN PROBABILITY      = configured by the admin, used ONLY by the server's
//                          wheel_spin() to pick the winner. Nothing in this
//                          file knows or cares about it.
//
// Angles are in degrees, clockwise from the top (where the fixed pointer is).

export const CX = 150;
export const CY = 150;
export const R = 140;
// Static logo hub radius in SVG units (the HTML hub is 25% of the wheel width
// of a 300-unit viewBox => 37.5; a hair larger here keeps labels clear of it).
export const HUB_R = 38;
export const LABEL_IN = HUB_R + 9;
// Labels stop short of the rim so the fixed pointer tip never touches the
// outer end of the winning label.
export const LABEL_OUT = R - 12;
export const LABEL_MID = (LABEL_IN + LABEL_OUT) / 2;

// Fraction of the winning segment's width the pointer may land inside. The
// remaining margin is split evenly between both borders, so the pointer can
// never rest next to — let alone inside — a neighbouring segment.
export const SAFE_ZONE = 0.65;

export const segmentAngle = (count) => (count > 0 ? 360 / count : 0);
export const segmentCenter = (index, count) => index * segmentAngle(count) + segmentAngle(count) / 2;

const rad = (deg) => (deg * Math.PI) / 180;

export function polar(cx, cy, r, angleDeg) {
  const a = rad(angleDeg);
  return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a) };
}

export function arcPath(cx, cy, radius, start, end) {
  if (end - start >= 359.999) {
    // Full circle (a single reward) — an arc with start === end renders nothing.
    return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.001} ${cy - radius} Z`;
  }
  const s = polar(cx, cy, radius, start);
  const e = polar(cx, cy, radius, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y} Z`;
}

// ── Landing ────────────────────────────────────────────────────────────────

// Rotation (deg, always >= current) that brings a point inside segment
// `index` under the fixed pointer. `offsetUnit` in [-1, 1] places the landing
// point inside the safe zone: 0 = dead centre, ±1 = the edge of the safe zone
// (still 17.5% of the segment away from the real border). The winner is
// decided by the server BEFORE this is called — this only chooses where, inside
// that already-chosen segment, the visual stops.
export function landingRotation({ current, index, count, offsetUnit = 0, turns = 5 }) {
  const seg = segmentAngle(count);
  const clamped = Math.max(-1, Math.min(1, offsetUnit));
  const target = segmentCenter(index, count) + clamped * (seg * SAFE_ZONE) / 2;
  const desiredMod = (((360 - target) % 360) + 360) % 360;
  const currentMod = ((current % 360) + 360) % 360;
  const delta = ((desiredMod - currentMod) + 360) % 360 + 360 * turns;
  return current + delta;
}

// Which segment sits under the pointer for a given wheel rotation. Used by
// the tests (and handy for assertions) — the UI never decides a winner with it.
export function segmentAtPointer(rotation, count) {
  const wheelAngle = (((360 - rotation) % 360) + 360) % 360;
  return Math.floor(wheelAngle / segmentAngle(count)) % count;
}

// ── Labels ─────────────────────────────────────────────────────────────────

const FS_MAX = 17;
const FS_MIN = 8;
const LINE_HEIGHT = 1.15;

const isArabic = (s) => /[؀-ۿ]/.test(s);
// Average glyph advance as a fraction of the font size, deliberately a little
// pessimistic so text errs towards fitting rather than touching the borders.
const charWidth = (s) => (isArabic(s) ? 0.52 : 0.58);

// Greedy word-wrap into at most `maxLines` lines of at most `maxChars`
// characters. The width is searched upwards from the longest word so the
// lines come out balanced (no one long line + a stub), instead of filling the
// first line to the brim. Returns null if it can't fit.
function wrap(words, maxChars, maxLines) {
  const longest = Math.max(...words.map((w) => w.length));
  if (longest > maxChars) return null;
  const total = words.join(' ').length;
  for (let width = longest; width <= Math.min(total, maxChars); width += 1) {
    const lines = [];
    let line = '';
    for (const w of words) {
      if (!line) line = w;
      else if (line.length + 1 + w.length <= width) line += ` ${w}`;
      else { lines.push(line); line = w; }
    }
    lines.push(line);
    if (lines.length <= maxLines) return lines;
  }
  return null;
}

function truncate(text, maxChars) {
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(1, maxChars - 1))}…`;
}

// Height a label may occupy: the wedge's width where the label starts (its
// narrowest point), minus padding, capped so wide wedges don't get huge type.
function wedgeHeight(count) {
  if (count <= 1) return 60;
  return Math.min(2 * LABEL_IN * Math.sin(rad(segmentAngle(count) / 2)) - 6, 50);
}

const MAX_LINES = 3;
// How much bigger than the smallest label a short label may be — keeps the
// wheel looking like one design without letting a single long reward name
// shrink every other label to its size.
const MAX_SIZE_SPREAD = 1.35;

// For every label: the largest font size at which it fits (up to 3 lines)
// inside its own wedge. A label that can't fit even at the minimum size is
// shortened with an ellipsis on its last line — never dropped.
export function layoutLabels(labels, count) {
  const length = LABEL_OUT - LABEL_IN;
  const maxH = wedgeHeight(count);

  const fit = (words, text, fs) => {
    const maxChars = Math.floor(length / (fs * charWidth(text)));
    const maxLines = Math.max(1, Math.min(MAX_LINES, Math.floor(maxH / (fs * LINE_HEIGHT))));
    return wrap(words, maxChars, maxLines);
  };

  const prepared = labels.map((raw) => {
    const text = String(raw || '').trim().replace(/\s+/g, ' ');
    const words = text.split(' ').filter(Boolean);
    let size = FS_MIN;
    let lines = null;
    if (words.length) {
      for (let fs = FS_MAX; fs >= FS_MIN; fs -= 0.5) {
        const l = fit(words, text, fs);
        if (l) { size = fs; lines = l; break; }
      }
    }
    return { text, words, size, lines };
  });

  const smallest = Math.min(...prepared.filter((p) => p.words.length).map((p) => p.size), FS_MAX);
  const items = prepared.map((p) => {
    if (!p.words.length) return { lines: [], fontSize: FS_MIN, truncated: false };
    const fontSize = Math.min(p.size, Math.max(smallest * MAX_SIZE_SPREAD, FS_MIN));
    if (p.lines) {
      // Re-wrap at the (possibly reduced) size so the lines stay balanced.
      return { lines: fit(p.words, p.text, fontSize) || p.lines, fontSize, truncated: false };
    }
    // Doesn't fit even at the minimum size: hard-wrap by characters, ellipsis last.
    const maxChars = Math.floor(length / (FS_MIN * charWidth(p.text)));
    const maxLines = Math.max(1, Math.min(MAX_LINES, Math.floor(maxH / (FS_MIN * LINE_HEIGHT))));
    // Word-aware: fill whole words per line; only a single word longer than a
    // whole line is split by characters.
    const out = [];
    let line = '';
    for (const w of p.words) {
      if (!line) line = w;
      else if (line.length + 1 + w.length <= maxChars) line += ` ${w}`;
      else { out.push(line); line = w; }
      while (line.length > maxChars) { out.push(line.slice(0, maxChars)); line = line.slice(maxChars); }
    }
    if (line) out.push(line);
    const shown = out.slice(0, maxLines);
    if (out.length > maxLines) shown[maxLines - 1] = truncate(out.slice(maxLines - 1).join(' '), maxChars);
    return { lines: shown, fontSize: FS_MIN, truncated: out.length > maxLines };
  });

  return { items };
}

// Text on the left half of the wheel is flipped 180° so it never reads upside
// down; the label's centre stays on the same radial position either way.
export function labelRotation(centerAngle) {
  return centerAngle <= 180 ? centerAngle - 90 : centerAngle + 90;
}

// ── Colours ────────────────────────────────────────────────────────────────

export const SLICE_COLORS = [
  '#5D3F85', '#FF5977', '#F5A623', '#3BB4A2', '#4A90E2',
  '#E94B6E', '#7B6CA6', '#FFB84D', '#2EC4B6', '#9B5DE5',
];

// Cycle the palette, but never let the last slice share a colour with the
// first (they touch at the top when count % palette length == 1).
export function sliceColor(index, count) {
  const len = SLICE_COLORS.length;
  if (count > 1 && index === count - 1 && index % len === 0) return SLICE_COLORS[len - 1];
  return SLICE_COLORS[index % len];
}

export function textColorFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#1f1230' : '#ffffff';
}
