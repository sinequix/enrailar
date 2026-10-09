#!/usr/bin/env bash
# Rasteriza los SVG de marca con Chrome headless (ImageMagick no renderiza bien SVG).
# Cada PNG se renderiza a escala entera con --force-device-scale-factor; no se re-muestrea.
# Uso: bash scripts/brand/raster.sh
set -euo pipefail
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
B="$ROOT/apps/web/public/brand"
A="$ROOT/docs/brand/assets"
APPS="$ROOT/docs/brand/applications"
TMP="$(mktemp -d)"

# shot <html|svg> <png> <ancho> <alto> <escala>
shot() {
  "$CH" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --force-device-scale-factor="$5" --window-size="$3,$4" --screenshot="$2" "file://$1" >/dev/null 2>&1
}

# wrap <svg> <ancho> [alto] -> html que muestra el svg a ese tamaño, sin márgenes
wrap() {
  local f="$TMP/$(basename "$1" .svg)-$2.html" h="${3:-$2}"
  printf '<!doctype html><html><body style="margin:0"><img src="file://%s" width="%s" height="%s" style="display:block"></body></html>' "$1" "$2" "$h" > "$f"
  echo "$f"
}

# Favicon: grilla de 16 a 1×, 2× y 3× -> 16, 32, 48.
for s in 1 2 3; do shot "$(wrap "$B/favicon.svg" 16)" "$TMP/favicon-$s.png" 16 16 "$s"; done
magick "$TMP/favicon-1.png" "$TMP/favicon-2.png" "$TMP/favicon-3.png" "$B/favicon.ico"

# Íconos con fondo blanco (iOS pinta de negro la transparencia): 180 y 512 desde icon.svg (40).
shot "$(wrap "$B/icon.svg" 180)" "$B/apple-touch-icon.png" 180 180 1
shot "$(wrap "$B/icon.svg" 512)" "$B/icon-512.png" 512 512 1

# Aplicaciones del manual.
shot "$APPS/og.html" "$B/og.png" 1200 630 1
cp "$B/og.png" "$A/og.png"
shot "$APPS/credencial.html" "$A/credencial.png" 480 720 2
shot "$APPS/firma-email.html" "$A/firma-email.png" 704 420 2
shot "$APPS/slide-portada.html" "$A/slide-portada.png" 1280 720 2

# Lámina de logo ampliada para el manual: renders reales a 1× y 2× que la lámina muestra con
# image-rendering: pixelated, más las variantes en vector.
mkdir -p "$TMP/px"
shot "$(wrap "$B/logo-horizontal.svg" 148 32)" "$TMP/px/logo-horizontal-1x.png" 148 32 1
shot "$(wrap "$B/logo-horizontal.svg" 148 32)" "$TMP/px/logo-horizontal-2x.png" 148 32 2
shot "$(wrap "$B/simbolo.svg" 32)" "$TMP/px/simbolo-1x.png" 32 32 1
shot "$(wrap "$B/simbolo-mono.svg" 32)" "$TMP/px/simbolo-mono-1x.png" 32 32 1
shot "$(wrap "$B/favicon.svg" 16)" "$TMP/px/favicon-1x.png" 16 16 1
shot "$(wrap "$B/favicon.svg" 16)" "$TMP/px/favicon-2x.png" 16 16 2
sed "s#__PX__#$TMP/px#g" "$APPS/logo-sheet.html" > "$APPS/.logo-sheet.tmp.html"
shot "$APPS/.logo-sheet.tmp.html" "$ROOT/docs/brand/screenshots/logo-sheet.png" 1200 1480 2
rm -f "$APPS/.logo-sheet.tmp.html"

# Compresión: las piezas con fotografía van a paleta de 8 bits (como las versiones anteriores).
for f in "$B/og.png" "$A/slide-portada.png"; do magick "$f" -strip -dither FloydSteinberg -colors 255 PNG8:"$f"; done
cp "$B/og.png" "$A/og.png"
for f in "$A/credencial.png" "$A/firma-email.png" "$B/icon-512.png" "$B/apple-touch-icon.png" "$ROOT/docs/brand/screenshots/logo-sheet.png"; do
  magick "$f" -strip -define png:compression-level=9 "$f"
done

rm -rf "$TMP"
echo "raster ok"
