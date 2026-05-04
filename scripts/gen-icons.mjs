// Generates 16/32/48/128 PNG icons on a transparent background, using only
// node:zlib. No third-party deps.
//   node scripts/gen-icons.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ b) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(size, drawPixel) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (1 + size * 4));
  let off = 0;
  for (let y = 0; y < size; y++) {
    raw[off++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = drawPixel(x, y, size);
      raw[off++] = r;
      raw[off++] = g;
      raw[off++] = b;
      raw[off++] = a;
    }
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Geometry helpers ---------------------------------------------
function distToSegment(px, py, ax, ay, bx, by) {
  const lx = bx - ax, ly = by - ay;
  const len2 = lx * lx + ly * ly;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * lx + (py - ay) * ly) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * lx), py - (ay + t * ly));
}

function aaCoverage(distInside) {
  if (distInside >= 0.5) return 1;
  if (distInside <= -0.5) return 0;
  return distInside + 0.5;
}

function over(dst, src) {
  const sa = src[3] / 255;
  const da = dst[3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa === 0) return [0, 0, 0, 0];
  const out = [0, 0, 0, 0];
  for (let i = 0; i < 3; i++) out[i] = Math.round((src[i] * sa + dst[i] * da * (1 - sa)) / oa);
  out[3] = Math.round(oa * 255);
  return out;
}

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const xv = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1)      [r, g, b] = [c, xv, 0];
  else if (hp < 2) [r, g, b] = [xv, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, xv];
  else if (hp < 4) [r, g, b] = [0, xv, c];
  else if (hp < 5) [r, g, b] = [xv, 0, c];
  else             [r, g, b] = [c, 0, xv];
  const m = l - c / 2;
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

// --- Icon -----------------------------------------------------------
// A transparent icon with a saturated color lens and a bold eyedropper. This
// keeps the mark closer to the product while avoiding a generic app-tile look.
const INK = [11, 14, 20];
const HIGHLIGHT = [255, 255, 255];
const METAL = [241, 245, 249];
const TIP = [189, 197, 208];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixRgb(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function roundedRectSdf(px, py, left, top, right, bottom, radius) {
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const hx = (right - left) / 2 - radius;
  const hy = (bottom - top) / 2 - radius;
  const qx = Math.abs(px - cx) - hx;
  const qy = Math.abs(py - cy) - hy;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

function drawRoundedRect(pixel, x, y, box, radius, color) {
  const cov = aaCoverage(-roundedRectSdf(x, y, box[0], box[1], box[2], box[3], radius));
  if (cov <= 0) return pixel;
  return over(pixel, [...color, Math.round(cov * 255)]);
}

function drawCircle(pixel, x, y, cx, cy, radius, color) {
  const cov = aaCoverage(radius - Math.hypot(x - cx, y - cy));
  if (cov <= 0) return pixel;
  return over(pixel, [...color, Math.round(cov * 255)]);
}

function drawCapsule(pixel, x, y, ax, ay, bx, by, halfWidth, color) {
  const cov = aaCoverage(halfWidth - distToSegment(x, y, ax, ay, bx, by));
  if (cov <= 0) return pixel;
  return over(pixel, [...color, Math.round(cov * 255)]);
}

function drawCapsuleStroke(pixel, x, y, ax, ay, bx, by, halfWidth, strokeWidth, color) {
  return drawCapsule(pixel, x, y, ax, ay, bx, by, halfWidth + strokeWidth, color);
}

function drawIcon(x, y, size) {
  let pixel = [0, 0, 0, 0];
  const small = size <= 16;
  const s = size;

  const cx = s * 0.46;
  const cy = s * 0.54;
  const radius = s * 0.42;
  const distC = Math.hypot(x - cx, y - cy);

  // A soft shadow and rim let the wheel stay visible against browser chrome.
  const shadowCov = aaCoverage(radius - Math.hypot(x - cx, y - (cy + s * 0.025)));
  if (shadowCov > 0) pixel = over(pixel, [0, 0, 0, Math.round(shadowCov * 42)]);

  if (distC <= radius + 0.5) {
    const angle = (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
    const hue = (angle + 360) % 360;
    const saturation = clamp(0.35 + (distC / radius) * 0.72, 0, 1);
    const lightness = 0.56 - clamp((distC / radius) * 0.08, 0, 0.08);
    const rgb = hslToRgb(hue, saturation, lightness);
    const cov = aaCoverage(radius - distC);
    pixel = over(pixel, [...rgb, Math.round(cov * 255)]);
  }

  const rimOuter = aaCoverage(radius - distC);
  const rimInner = aaCoverage(radius - s * 0.045 - distC);
  const rimCov = clamp(rimOuter - rimInner, 0, 1);
  if (rimCov > 0) pixel = over(pixel, [15, 23, 42, Math.round(rimCov * 165)]);

  const highlight = aaCoverage(s * 0.14 - Math.hypot(x - s * 0.31, y - s * 0.31));
  if (highlight > 0) pixel = over(pixel, [...HIGHLIGHT, Math.round(highlight * 48)]);

  // Eyedropper: simple and high-contrast, with a larger handle than the first
  // icon so it still reads as a picker at 16px.
  const tipX = s * 0.23;
  const tipY = s * 0.75;
  const shaftA = [s * 0.32, s * 0.66];
  const shaftB = [s * 0.66, s * 0.32];
  const handle = [s * 0.76, s * 0.22];
  const outline = small ? s * 0.04 : s * 0.032;
  const bodyHalf = small ? s * 0.06 : s * 0.064;

  pixel = drawCapsuleStroke(pixel, x, y, shaftA[0], shaftA[1], shaftB[0], shaftB[1], bodyHalf, outline, INK);
  pixel = drawCapsule(pixel, x, y, shaftA[0], shaftA[1], shaftB[0], shaftB[1], bodyHalf, METAL);

  pixel = drawCircle(pixel, x, y, handle[0], handle[1], s * 0.13 + outline, INK);
  pixel = drawCircle(pixel, x, y, handle[0], handle[1], s * 0.13, [248, 250, 252]);
  if (!small) pixel = drawCircle(pixel, x, y, handle[0] - s * 0.035, handle[1] - s * 0.035, s * 0.026, [255, 255, 255, 170]);

  pixel = drawCapsuleStroke(pixel, x, y, tipX, tipY, shaftA[0] + s * 0.025, shaftA[1] - s * 0.025, bodyHalf * 0.55, outline, INK);
  pixel = drawCapsule(pixel, x, y, tipX, tipY, shaftA[0] + s * 0.025, shaftA[1] - s * 0.025, bodyHalf * 0.55, TIP);

  const dropR = small ? s * 0.055 : s * 0.065;
  pixel = drawCircle(pixel, x, y, s * 0.21, s * 0.80, dropR + outline * 0.75, INK);
  pixel = drawCircle(pixel, x, y, s * 0.21, s * 0.80, dropR, [45, 212, 191]);

  return pixel;
}

mkdirSync("src/icons", { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const png = makePng(size, drawIcon);
  writeFileSync(`src/icons/icon-${size}.png`, png);
  console.log(`wrote src/icons/icon-${size}.png (${png.length} bytes)`);
}
