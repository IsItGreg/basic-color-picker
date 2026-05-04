import { TAILWIND_PALETTE as V3_HEX } from "../content/tailwind-map";
import {
  TAILWIND_V4_PALETTE_OKLCH as V4_OKLCH,
  TAILWIND_V4_LITERAL_HEX as V4_LITERAL,
} from "../content/tailwind-v4-map";
import {
  type Rgb,
  type Oklab,
  hexToRgb,
  rgbToHex,
  rgbToOklab,
  oklchToRgb,
  deltaEOklab,
} from "./color";

export type TailwindVersion = "v3" | "v4" | "both";

type PaletteEntry = {
  name: string;
  v3Rgb?: Rgb;
  v3Oklab?: Oklab;
  v4Rgb?: Rgb;
  v4Oklab?: Oklab;
};

// Build a single keyed palette from both sources. v4 introduces new families
// (mauve, olive, mist, taupe) that v3 doesn't have, and v4 generally restates
// every shared family in different OKLCH values.
const PALETTE: Map<string, PaletteEntry> = (() => {
  const m = new Map<string, PaletteEntry>();
  const get = (name: string): PaletteEntry => {
    let e = m.get(name);
    if (!e) { e = { name }; m.set(name, e); }
    return e;
  };

  for (const [name, hex] of Object.entries(V3_HEX)) {
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    const e = get(name);
    e.v3Rgb = rgb;
    e.v3Oklab = rgbToOklab(rgb);
  }
  for (const [name, oklch] of Object.entries(V4_OKLCH)) {
    const rgb = oklchToRgb(oklch);
    const e = get(name);
    e.v4Rgb = rgb;
    e.v4Oklab = rgbToOklab(rgb);
  }
  for (const [name, hex] of Object.entries(V4_LITERAL)) {
    const rgb = hexToRgb(hex);
    if (!rgb) continue;
    const e = get(name);
    e.v4Rgb = rgb;
    e.v4Oklab = rgbToOklab(rgb);
  }
  return m;
})();

// Slightly looser than v0.1 (which was 0.012 against just v3): v4 colors are
// derived through OKLCH→sRGB conversion and may differ from a browser's
// gamut-mapped result by a unit or two. Still well below "perceptibly
// different" — typical perceptibility threshold in Oklab is ~0.02.
const MATCH_THRESHOLD = 0.018;

export type PaletteMatch = {
  name: string;
  version: TailwindVersion;
  hex: string;     // displayable swatch — v4 hex when available, else v3
  deltaE: number;
};

/**
 * Closest Tailwind class name across v3 and v4 within the perceptibility
 * threshold. Tagged with which version's hex matched.
 */
export function matchTailwindPalette(rgb: Rgb): PaletteMatch | null {
  const target = rgbToOklab(rgb);
  let best: PaletteMatch | null = null;
  for (const e of PALETTE.values()) {
    const v3D = e.v3Oklab ? deltaEOklab(target, e.v3Oklab) : Infinity;
    const v4D = e.v4Oklab ? deltaEOklab(target, e.v4Oklab) : Infinity;
    const minD = Math.min(v3D, v4D);
    if (minD >= MATCH_THRESHOLD) continue;

    let version: TailwindVersion;
    let hex: string;
    if (v3D < MATCH_THRESHOLD && v4D < MATCH_THRESHOLD && Math.abs(v3D - v4D) < 0.003) {
      version = "both";
      hex = rgbToHex(e.v4Rgb ?? e.v3Rgb!);
    } else if (v4D < v3D) {
      version = "v4";
      hex = rgbToHex(e.v4Rgb!);
    } else {
      version = "v3";
      hex = rgbToHex(e.v3Rgb!);
    }
    if (!best || minD < best.deltaE) {
      best = { name: e.name, version, hex, deltaE: minD };
    }
  }
  return best;
}

/**
 * Resolve a Tailwind color token (e.g. "red-500", "white") to its v3 and v4
 * sRGB values, or `null` for either if that version doesn't define it.
 * Used by element-class detection: a `bg-red-500` on the picked element
 * should match if the picked pixel's color is close to *either* v3-red-500
 * or v4-red-500.
 */
export function resolveTailwindToken(token: string): { v3?: Rgb; v4?: Rgb } | null {
  const e = PALETTE.get(token);
  if (!e) return null;
  return { v3: e.v3Rgb, v4: e.v4Rgb };
}

/** All known Tailwind color tokens across both versions, for class regex lookup. */
export const TAILWIND_TOKENS: ReadonlySet<string> = new Set(PALETTE.keys());
