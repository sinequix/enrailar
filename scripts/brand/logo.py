#!/usr/bin/env python3
"""Compone los SVG del logo de Enrailar en píxeles enteros.

Uso: python3 scripts/brand/logo.py [scripts/brand/wordmark.json] [apps/web/public/brand]

Todo se dibuja a tamaño de uso: el símbolo en una grilla de 32 px (y una de 16 px para el
favicon), el wordmark con altura de x 16 px y fuste 4 px. No hay transforms, strokes,
filtros ni imágenes: cada forma es un relleno con coordenadas enteras, así el lockup
horizontal (147 × 32) se ve nítido a 1× y 2× en la cabecera.

Genera: simbolo, simbolo-mono, favicon (16), icon (fondo blanco, 40), wordmark,
logo-horizontal, logo-apilado, logo-mono, logo-invertido, logo-blanco.
Los PNG/ICO se generan después con scripts/brand/raster.sh.
"""
import json
import sys
from pathlib import Path

INK = "#0E2A42"           # azul-riel
CELESTE = "#1C5A88"       # celeste-700
CELESTE_SOFT = "#8DBEE2"  # celeste-300
GOLD = "#D9A520"          # oro-500
GOLD_SOFT = "#F2CC6B"     # oro-300
WHITE = "#FFFFFF"

GAP = 8  # px entre símbolo y wordmark en el lockup horizontal


def svg(w, h, body, label="Enrailar"):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
        f'role="img" aria-label="{label}"><title>{label}</title>{body}</svg>'
    )


def rails(dx, dy, color, grid=32):
    """Dos rieles cortados por la estación: cuatro tramos con punta exterior redonda."""
    if grid == 32:
        # riel 4 px, tramos 0..8 y 24..32, en y 8..12 y 20..24, radio exterior 2
        d = ""
        for y in (8, 20):
            d += f"M{dx + 2} {dy + y}h6v4h-6a2 2 0 0 1 0-4z"
            d += f"M{dx + 24} {dy + y}h6a2 2 0 0 1 0 4h-6z"
    else:
        # grilla 16: riel 2 px, tramos 0..4 y 12..16, en y 4..6 y 10..12, radio 1
        d = ""
        for y in (4, 10):
            d += f"M{dx + 1} {dy + y}h3v2h-3a1 1 0 0 1 0-2z"
            d += f"M{dx + 12} {dy + y}h3a1 1 0 0 1 0 2h-3z"
    return f'<path fill="{color}" d="{d}"/>'


def disc(dx, dy, color, grid=32, ring=False):
    c, r = (16, 6) if grid == 32 else (8, 3)
    cx, cy = dx + c, dy + c
    if not ring:
        return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{color}"/>'
    ri = r // 2  # anillo de 3 px en la grilla de 32
    # anillo como un solo relleno (sentido invertido en el agujero, sin fill-rule)
    d = (
        f"M{cx} {cy - r}a{r} {r} 0 1 1 0 {2 * r}a{r} {r} 0 1 1 0 {-2 * r}z"
        f"M{cx} {cy - ri}a{ri} {ri} 0 1 0 0 {2 * ri}a{ri} {ri} 0 1 0 0 {-2 * ri}z"
    )
    return f'<path fill="{color}" d="{d}"/>'


def symbol(dx, dy, rail_color, disc_color, grid=32, ring=False):
    return rails(dx, dy, rail_color, grid) + disc(dx, dy, disc_color, grid, ring)


def path_d(contours, dx, dy):
    out = []
    for ops in contours:
        for op, pts in ops:
            if op == "moveTo":
                out.append(f"M{pts[0][0] + dx} {pts[0][1] + dy}")
            elif op == "lineTo":
                out.append(f"L{pts[0][0] + dx} {pts[0][1] + dy}")
            elif op == "qCurveTo":
                (cx, cy), (x, y) = pts
                out.append(f"Q{cx + dx} {cy + dy} {x + dx} {y + dy}")
            elif op in ("closePath", "endPath"):
                out.append("Z")
    return "".join(out)


def wordmark(data, dx, dy, text_color, dot_color):
    d = "".join(path_d(g["contours"], dx, dy) for g in data["glyphs"])
    dot = data["dot"]
    return (
        f'<path fill="{text_color}" d="{d}"/>'
        f'<circle cx="{dot["cx"] + dx}" cy="{dot["cy"] + dy}" r="{dot["r"]}" fill="{dot_color}"/>'
    )


def main(src, out):
    data = json.loads(Path(src).read_text())
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    ww = data["width"]           # ancho del wordmark
    asc = data["ascender"]       # y del ascendente dentro de la caja de 32 (2)
    base = data["baseline"]      # 24

    def horizontal(rail, disc_c, text, dot, ring=False):
        w = 32 + GAP + ww
        return svg(w, 32, symbol(0, 0, rail, disc_c, ring=ring) + wordmark(data, 32 + GAP, 0, text, dot))

    files = {
        "logo-horizontal.svg": horizontal(CELESTE, GOLD, INK, GOLD),
        "logo-mono.svg": horizontal(INK, INK, INK, INK, ring=True),
        "logo-blanco.svg": horizontal(WHITE, WHITE, WHITE, WHITE, ring=True),
        "logo-invertido.svg": horizontal(CELESTE_SOFT, GOLD_SOFT, WHITE, GOLD_SOFT),
        "simbolo.svg": svg(32, 32, symbol(0, 0, CELESTE, GOLD)),
        "simbolo-mono.svg": svg(32, 32, symbol(0, 0, INK, INK, ring=True)),
        "favicon.svg": svg(16, 16, symbol(0, 0, CELESTE, GOLD, grid=16)),
        # Ícono con fondo para pantalla de inicio y manifest: símbolo con margen de 4 (80 %).
        "icon.svg": svg(40, 40, f'<rect width="40" height="40" rx="8" fill="{WHITE}"/>' + symbol(4, 4, CELESTE, GOLD)),
    }
    # Wordmark solo: caja ajustada del ascendente a la base.
    files["wordmark.svg"] = svg(ww, base - asc, wordmark(data, 0, -asc, INK, GOLD), label="enrailar")
    # Apilado: símbolo centrado sobre el wordmark, 8 px de aire.
    W = ww + (ww % 2)              # ancho par para centrar el símbolo en entero
    sx = (W - 32) // 2
    wx = (W - ww) // 2
    wy = 32 + 8 - asc
    files["logo-apilado.svg"] = svg(W, wy + base, symbol(sx, 0, CELESTE, GOLD) + wordmark(data, wx, wy, INK, GOLD))

    for name, content in files.items():
        (out / name).write_text(content + "\n")
    print("ok", sorted(files))


if __name__ == "__main__":
    args = sys.argv[1:]
    main(args[0] if args else "scripts/brand/wordmark.json", args[1] if len(args) > 1 else "apps/web/public/brand")
