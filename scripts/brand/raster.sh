#!/usr/bin/env bash
# Rasteriza los SVG de marca con Chrome headless (ImageMagick no renderiza bien SVG).
# Uso: bash scripts/brand/raster.sh
set -euo pipefail
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
B="$ROOT/apps/web/public/brand"
TMP="$(mktemp -d)"
shot() { # svg out size
  "$CH" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --window-size="$3,$3" --screenshot="$TMP/$2" "file://$B/$1" >/dev/null 2>&1
  magick "$TMP/$2" -resize "${3}x${3}!" "$B/$2"
}
shot icon.svg icon-512.png 512
shot icon.svg apple-touch-icon.png 180
shot favicon.svg favicon-48.png 48
shot favicon.svg favicon-32.png 32
shot favicon.svg favicon-16.png 16
magick "$B/favicon-16.png" "$B/favicon-32.png" "$B/favicon-48.png" "$B/favicon.ico"
rm -f "$B/favicon-16.png" "$B/favicon-32.png" "$B/favicon-48.png"
for f in logo-horizontal logo-apilado logo-invertido logo-mono simbolo wordmark; do
  "$CH" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --window-size=640,220 --screenshot="$TMP/pv-$f.png" "file://$B/$f.svg" >/dev/null 2>&1
done
magick "$TMP"/pv-logo-horizontal.png "$TMP"/pv-logo-apilado.png "$TMP"/pv-logo-invertido.png "$TMP"/pv-logo-mono.png "$TMP"/pv-simbolo.png -append /tmp/enrailar-fonts/pv-all.png
echo "icons ok: $TMP"
