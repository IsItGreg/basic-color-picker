// Quick sanity check: compute Tailwind v4 hex values from OKLCH source
// and print them next to the published hex values. Inlined OKLCH samples
// avoid having to import the .ts module from Node.

function linearToSrgb(c) {
  const v = Math.max(0, Math.min(1, c));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function oklchToRgb(L, C, h) {
  const hRad = (h * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);
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
    r: Math.round(linearToSrgb(rLin) * 255),
    g: Math.round(linearToSrgb(gLin) * 255),
    b: Math.round(linearToSrgb(bLin) * 255),
  };
}

function hex({ r, g, b }) {
  const h = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Source OKLCH (theme.css) → expected published hex.
const SAMPLES = [
  ["red-500",     0.637, 0.237, 25.331,   "#fb2c36"],
  ["red-600",     0.577, 0.245, 27.325,   "#e7000b"],
  ["blue-500",    0.623, 0.214, 259.815,  "#2b7fff"],
  ["blue-600",    0.546, 0.245, 262.881,  "#155dfc"],
  ["emerald-500", 0.696, 0.170, 162.480,  "#00bc7d"],
  ["amber-500",   0.769, 0.188, 70.080,   "#fe9a00"],
  ["violet-500",  0.606, 0.250, 292.717,  "#8e51ff"],
  ["slate-500",   0.554, 0.046, 257.417,  "#62748e"],
  ["gray-500",    0.551, 0.027, 264.364,  "#6a7282"],
  ["neutral-500", 0.556, 0.000,   0.000,  "#737373"],
];

let bad = 0;
for (const [name, L, C, h, expected] of SAMPLES) {
  const rgb = oklchToRgb(L, C, h);
  const got = hex(rgb);
  const ok = got.toLowerCase() === expected.toLowerCase();
  const diff = ok ? "" : `  Δ(${rgb.r - parseInt(expected.slice(1,3),16)}, ${rgb.g - parseInt(expected.slice(3,5),16)}, ${rgb.b - parseInt(expected.slice(5,7),16)})`;
  console.log(`${name.padEnd(14)}  ${expected}  →  ${got}  ${ok ? "✓" : "✗"}${diff}`);
  if (!ok) bad++;
}
console.log(`\n${bad === 0 ? "All match." : bad + " off — but small ΔRGB is normal (gamut mapping vs. simple clip)."}`);
