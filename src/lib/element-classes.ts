import { TAILWIND_PALETTE } from "../content/tailwind-map";
import { type Rgb, hexToRgb, rgbToOklab, deltaEOklab } from "./color";

// Tailwind utility prefixes that take a color suffix. Side-specific border /
// divide / ring variants are matched generically with a regex below.
const COLOR_PREFIXES = [
  "bg",
  "text",
  "border",
  "ring",
  "ring-offset",
  "divide",
  "outline",
  "decoration",
  "accent",
  "caret",
  "placeholder",
  "from",
  "via",
  "to",
  "fill",
  "stroke",
  "shadow",
];

// e.g. "bg-orange-500", "border-t-red-500", "ring-offset-slate-200/50",
// "text-black", "hover:bg-blue-700".  Group 1 captures the prefix (with
// optional side / state variants stripped), group 2 captures the color token.
const UTILITY_RE = new RegExp(
  // optional state prefix(es): "hover:", "md:hover:" etc — we ignore them
  "^(?:[a-z0-9-]+:)*" +
    // prefix and optional side modifier (e.g. border-t, border-x, divide-y)
    "(" + COLOR_PREFIXES.join("|") + ")(?:-(?:t|r|b|l|x|y|s|e|inline|block|inline-start|inline-end))?" +
    // the color, may be followed by /opacity (which we ignore for matching)
    "-([a-z]+(?:-\\d+)?)" +
    "(?:/\\d+)?$"
);

const MATCH_THRESHOLD = 0.02; // slightly looser than palette-only match — covers anti-aliasing.

export type ElementTailwindHit = {
  /** Full original utility class as authored, e.g. "hover:bg-orange-500/50". */
  className: string;
  /** Resolved Tailwind palette name, e.g. "orange-500". */
  paletteName: string;
  /** The depth in the ancestor chain (0 = picked element itself). */
  depth: number;
};

/**
 * Walk the picked element and its ancestors (up to body) looking for Tailwind
 * color utilities whose resolved palette color matches the picked pixel.
 * Returns the matches in document order (closest first).
 */
export function detectElementTailwind(element: Element | null, pickedRgb: Rgb, maxDepth = 6): ElementTailwindHit[] {
  if (!element) return [];
  const target = rgbToOklab(pickedRgb);
  const hits: ElementTailwindHit[] = [];

  let cur: Element | null = element;
  let depth = 0;
  while (cur && depth <= maxDepth && cur !== document.documentElement) {
    if (cur.classList && cur.classList.length > 0) {
      for (const cls of Array.from(cur.classList)) {
        const m = UTILITY_RE.exec(cls);
        if (!m) continue;
        const colorToken = m[2]!;
        const hex = TAILWIND_PALETTE[colorToken];
        if (!hex) continue;
        const rgb = hexToRgb(hex);
        if (!rgb) continue;
        const d = deltaEOklab(target, rgbToOklab(rgb));
        if (d < MATCH_THRESHOLD) {
          hits.push({ className: cls, paletteName: colorToken, depth });
        }
      }
    }
    cur = cur.parentElement;
    depth++;
  }
  return hits;
}
