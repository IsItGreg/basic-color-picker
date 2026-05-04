import { resolveTailwindToken, TAILWIND_TOKENS, type TailwindVersion } from "./tailwind-match";
import { type Rgb, rgbToOklab, deltaEOklab } from "./color";

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

const UTILITY_RE = new RegExp(
  "^(?:[a-z0-9-]+:)*" +
    "(" + COLOR_PREFIXES.join("|") + ")(?:-(?:t|r|b|l|x|y|s|e|inline|block|inline-start|inline-end))?" +
    "-([a-z]+(?:-\\d+)?)" +
    "(?:/\\d+)?$"
);

const MATCH_THRESHOLD = 0.025; // a touch looser than the palette match — picks may be over partly anti-aliased text/borders

export type ElementTailwindHit = {
  className: string;
  paletteName: string;
  version: TailwindVersion;
  depth: number;
};

export function detectElementTailwind(
  element: Element | null,
  pickedRgb: Rgb,
  maxDepth = 6,
): ElementTailwindHit[] {
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
        const token = m[2]!;
        if (!TAILWIND_TOKENS.has(token)) continue;
        const resolved = resolveTailwindToken(token);
        if (!resolved) continue;

        const v3D = resolved.v3 ? deltaEOklab(target, rgbToOklab(resolved.v3)) : Infinity;
        const v4D = resolved.v4 ? deltaEOklab(target, rgbToOklab(resolved.v4)) : Infinity;
        const minD = Math.min(v3D, v4D);
        if (minD >= MATCH_THRESHOLD) continue;

        let version: TailwindVersion;
        if (v3D < MATCH_THRESHOLD && v4D < MATCH_THRESHOLD && Math.abs(v3D - v4D) < 0.003) {
          version = "both";
        } else if (v4D < v3D) {
          version = "v4";
        } else {
          version = "v3";
        }
        hits.push({ className: cls, paletteName: token, version, depth });
      }
    }
    cur = cur.parentElement;
    depth++;
  }
  return hits;
}
