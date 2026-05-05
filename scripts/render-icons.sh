#!/usr/bin/env bash
# Render src/icons/source*.svg to PNGs at 16/32/48/128 (action + manifest
# icons).
#
# Strategy: render each PNG at its exact target size via Chrome headless
# with the SVG dropped into an HTML wrapper that uses an `<img>` element
# at the target dimensions. Chrome's SVG renderer hints the rasterization
# at small sizes — sharper than rendering at supersample resolution and
# bicubic-downscaling, which would average away the 1-pixel miter spike
# at the pin tip.
#
# Per-size source: 16/32 use the chunkier small-size variant whose
# strokes survive 16-pixel grids. 48/128 use the full-detail master.
# Per-size inset: bigger sizes get more visual margin so the pin tip
# isn't flush with the canvas edge.
#
# Usage: ./scripts/render-icons.sh
set -euo pipefail

CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
ROOT="$(cd "$(dirname "$0")/.."; pwd)"
SVG_FULL="$ROOT/src/icons/source.svg"
SVG_SMALL="$ROOT/src/icons/source-small.svg"
OUTDIR="$ROOT/src/icons"

# size:source:inset%
declare -a JOBS=(
  "16:$SVG_SMALL:0"
  "32:$SVG_SMALL:3"
  "48:$SVG_FULL:5"
  "128:$SVG_FULL:6"
)

WORK=$(mktemp -d)
trap "rm -rf $WORK" EXIT

for f in "$SVG_FULL" "$SVG_SMALL"; do
  if [ ! -f "$f" ]; then
    echo "Missing $f" >&2
    exit 1
  fi
done

echo "Direct-rendering at target sizes"
for job in "${JOBS[@]}"; do
  IFS=":" read -r size svg pct <<< "$job"
  inset=$(( size * pct / 100 ))
  inner=$(( size - 2 * inset ))
  wrap="$WORK/wrap-$size.html"
  cat > "$wrap" <<EOF
<!doctype html>
<html><head><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${size}px;height:${size}px;overflow:hidden;background:transparent;}
  img{width:${inner}px;height:${inner}px;display:block;margin:${inset}px;}
</style></head>
<body><img src="file://$svg"></body></html>
EOF

  "$CHROME" --headless --disable-gpu --no-sandbox \
    --default-background-color=00000000 --hide-scrollbars \
    --window-size=$size,$size \
    --screenshot="$OUTDIR/icon-$size.png" \
    "file://$wrap" >/dev/null 2>&1

  printf "  icon-%-3s  %5d bytes  inset=%d%%  (from %s)\n" \
    "$size" "$(wc -c < "$OUTDIR/icon-$size.png")" "$pct" "$(basename "$svg")"
done

echo "Wrote into $OUTDIR/"
