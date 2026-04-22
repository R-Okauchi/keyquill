#!/usr/bin/env bash
# Generate Chrome/Firefox extension icon PNGs (16/32/48/128) from the
# high-resolution source-icon.png. Uses macOS `sips` (Lanczos resample)
# for highest-quality downscaling.
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
  # Center-crop to square, then Lanczos downscale.
  TMP=$(mktemp -d)
  # Detect dimensions; assume landscape or square source
  DIM=$(sips -g pixelWidth -g pixelHeight "$SRC_RASTER" | awk '/pixel/ {print $2}' | sort -n | head -1)
  sips -c "$DIM" "$DIM" "$SRC_RASTER" --out "$TMP/square.png" >/dev/null
  for size in 16 32 48 128; do
    sips -Z "$size" "$TMP/square.png" --out "$DST/icon-${size}.png" >/dev/null
    echo "Generated $DST/icon-${size}.png ($size x $size)"
  done
  rm -rf "$TMP"
elif [ -f "$SRC_SVG" ]; then
  echo "Raster source missing; falling back to SVG: $SRC_SVG"
  for size in 16 32 48 128; do
    npx --yes @resvg/resvg-js-cli --fit-width "$size" "$SRC_SVG" "$DST/icon-${size}.png"
  done
else
  echo "No icon source found (expected $SRC_RASTER or $SRC_SVG)" >&2
  exit 1
fi
