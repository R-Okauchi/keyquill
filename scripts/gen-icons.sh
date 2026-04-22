#!/usr/bin/env bash
# Generate Chrome/Firefox extension icon PNGs (16/32/48/128) from the
# high-resolution source-icon.png. Uses Python PIL with alpha-bbox crop
# so the artwork fills the final square (avoids tiny icons caused by
# transparent padding in the source).
#
# If source-icon.png is missing, fall back to the placeholder SVG logo
# via @resvg/resvg-js-cli.

set -euo pipefail

DST="packages/keyquill-extension/public/icons"
SRC_RASTER="$DST/source-icon.png"
SRC_SVG="$DST/logo.svg"

mkdir -p "$DST"

if [ -f "$SRC_RASTER" ]; then
  echo "Using raster source: $SRC_RASTER"
  python3 - "$SRC_RASTER" "$DST" <<'PY'
import sys
from PIL import Image
import numpy as np

src_path, dst_dir = sys.argv[1], sys.argv[2]
src = Image.open(src_path).convert("RGBA")
arr = np.array(src)
alpha = arr[:, :, 3]
ys, xs = np.where(alpha > 10)
x0, x1 = int(xs.min()), int(xs.max())
y0, y1 = int(ys.min()), int(ys.max())

bw, bh = x1 - x0, y1 - y0
side = max(bw, bh)
margin = int(side * 0.08)  # 8% breathing room
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
half = side // 2 + margin
sq_x0 = max(0, cx - half)
sq_y0 = max(0, cy - half)
sq_x1 = min(arr.shape[1], cx + half)
sq_y1 = min(arr.shape[0], cy + half)

cropped = src.crop((sq_x0, sq_y0, sq_x1, sq_y1))

for size in (16, 32, 48, 128):
    img = cropped.resize((size, size), Image.LANCZOS)
    img.save(f"{dst_dir}/icon-{size}.png", optimize=True)
    print(f"Generated {dst_dir}/icon-{size}.png ({size}x{size})")
PY
elif [ -f "$SRC_SVG" ]; then
  echo "Raster source missing; falling back to SVG: $SRC_SVG"
  for size in 16 32 48 128; do
    npx --yes @resvg/resvg-js-cli --fit-width "$size" "$SRC_SVG" "$DST/icon-${size}.png"
  done
else
  echo "No icon source found (expected $SRC_RASTER or $SRC_SVG)" >&2
  exit 1
fi
