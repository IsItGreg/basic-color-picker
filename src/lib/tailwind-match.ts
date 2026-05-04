import { TAILWIND_PALETTE } from "../content/tailwind-map";
import { type Rgb, hexToRgb, rgbToOklab, deltaEOklab } from "./color";

// Cached Oklab values for every palette color so each lookup is O(N) but cheap.
const PALETTE_OKLAB: Array<{ name: string; hex: string; oklab: ReturnType<typeof rgbToOklab> }> =
  Object.entries(TAILWIND_PALETTE).map(([name, hex]) => {
    const rgb = hexToRgb(hex)!;
    return { name, hex, oklab: rgbToOklab(rgb) };
  });

// ΔE in Oklab is on the same scale as L (0..1). 0.01 is barely-perceptible;
// we use 0.012 so the picked color must be visually indistinguishable from
// the palette entry. Tighter than this and minor JPEG/PNG noise misses real matches.
const PALETTE_MATCH_THRESHOLD = 0.012;

/**
 * Closest Tailwind palette name within the perceptual threshold, or null.
 * "exact" here means "indistinguishable to the eye", not byte-equal — small
 * sub-pixel differences from screenshot capture should still match.
 */
export function matchTailwindPalette(rgb: Rgb): { name: string; hex: string; deltaE: number } | null {
  const target = rgbToOklab(rgb);
  let best: { name: string; hex: string; deltaE: number } | null = null;
  for (const entry of PALETTE_OKLAB) {
    const d = deltaEOklab(target, entry.oklab);
    if (d < PALETTE_MATCH_THRESHOLD && (!best || d < best.deltaE)) {
      best = { name: entry.name, hex: entry.hex, deltaE: d };
    }
  }
  return best;
}
