export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };
export type Oklab = { L: number; a: number; b: number };
export type Oklch = { L: number; C: number; h: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, digits = 0) => {
  const k = Math.pow(10, digits);
  return Math.round(v * k) / k;
};

export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      case bn:
        h = ((rn - gn) / d + 4) * 60;
        break;
    }
  }
  return { h, s, l };
}

function srgbToLinear(c: number): number {
  const cn = c / 255;
  return cn <= 0.04045 ? cn / 12.92 : Math.pow((cn + 0.055) / 1.055, 2.4);
}

// Björn Ottosson's Oklab transform — CSS Color Module 4.
export function rgbToOklab({ r, g, b }: Rgb): Oklab {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;

  const lc = Math.cbrt(l);
  const mc = Math.cbrt(m);
  const sc = Math.cbrt(s);

  return {
    L: 0.2104542553 * lc + 0.7936177850 * mc - 0.0040720468 * sc,
    a: 1.9779984951 * lc - 2.4285922050 * mc + 0.4505937099 * sc,
    b: 0.0259040371 * lc + 0.7827717662 * mc - 0.8086757660 * sc,
  };
}

export function oklabToOklch({ L, a, b }: Oklab): Oklch {
  const C = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

// Euclidean distance in Oklab — perceptually uniform enough for nearest-palette lookup.
export function deltaEOklab(x: Oklab, y: Oklab): number {
  const dL = x.L - y.L;
  const da = x.a - y.a;
  const db = x.b - y.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

export function formatRgb({ r, g, b }: Rgb, alpha = 1): string {
  if (alpha < 1) return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${round(alpha, 3)})`;
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

export function formatHsl({ h, s, l }: Hsl, alpha = 1): string {
  const hStr = round(h, 1);
  const sStr = round(s * 100, 1);
  const lStr = round(l * 100, 1);
  if (alpha < 1) return `hsla(${hStr}, ${sStr}%, ${lStr}%, ${round(alpha, 3)})`;
  return `hsl(${hStr}, ${sStr}%, ${lStr}%)`;
}

export function formatOklab({ L, a, b }: Oklab): string {
  return `oklab(${round(L * 100, 2)}% ${round(a, 4)} ${round(b, 4)})`;
}

export function formatOklch({ L, C, h }: Oklch): string {
  return `oklch(${round(L * 100, 2)}% ${round(C, 4)} ${round(h, 2)})`;
}

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

// --- Reverse transforms (Oklch / Oklab → sRGB) -----------------------
// Used to derive sRGB hex from OKLCH source values (e.g. Tailwind v4's
// theme.css). Out-of-gamut OKLCH values are clipped to sRGB rather than
// gamut-mapped — for the chroma levels Tailwind uses this is within a
// couple of units and well inside our match threshold.

function linearToSrgbChannel(c: number): number {
  const v = Math.max(0, Math.min(1, c));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export function oklabToRgb({ L, a, b }: Oklab): Rgb {
  const lc = L + 0.3963377774 * a + 0.2158037573 * b;
  const mc = L - 0.1055613458 * a - 0.0638541728 * b;
  const sc = L - 0.0894841775 * a - 1.2914855480 * b;
  const lLin = lc * lc * lc;
  const mLin = mc * mc * mc;
  const sLin = sc * sc * sc;
  const rLin =  4.0767416621 * lLin - 3.3077115913 * mLin + 0.2309699292 * sLin;
  const gLin = -1.2684380046 * lLin + 2.6097574011 * mLin - 0.3413193965 * sLin;
  const bLin = -0.0041960863 * lLin - 0.7034186147 * mLin + 1.7076147010 * sLin;
  return {
    r: Math.round(linearToSrgbChannel(rLin) * 255),
    g: Math.round(linearToSrgbChannel(gLin) * 255),
    b: Math.round(linearToSrgbChannel(bLin) * 255),
  };
}

export function oklchToOklab({ L, C, h }: Oklch): Oklab {
  const hRad = (h * Math.PI) / 180;
  return { L, a: C * Math.cos(hRad), b: C * Math.sin(hRad) };
}

export function oklchToRgb(oklch: Oklch): Rgb {
  return oklabToRgb(oklchToOklab(oklch));
}
