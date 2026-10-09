#!/usr/bin/env python3
"""Compone los SVG del logo de Enrailar a partir de wordmark.json.

Uso: python3 scripts/brand/logo.py <wordmark.json> <salida/>
Genera: simbolo, wordmark, logo-horizontal, logo-apilado, logo-mono,
logo-invertido, favicon. Los PNG/ICO se generan después con ImageMagick.
"""
import json
import re
import sys
from pathlib import Path

INK = "#0E2A42"        # azul-riel
CELESTE = "#1C5A88"    # celeste-700
CELESTE_SOFT = "#8DBEE2"  # celeste-300
GOLD = "#D9A520"       # oro-500
GOLD_SOFT = "#F2CC6B"  # oro-300
WHITE = "#FFFFFF"


def rnd(d):
    return re.sub(r"(\d+\.\d{1})\d+", r"\1", d)


def symbol(rails, disc, halo, size=64, bare=False):
    """Nodo: dos rieles y un disco. El disco interrumpe la vía como una estación en un diagrama de línea."""
    body = (
        f'<path d="M6 23H58" stroke="{rails}" stroke-width="5" stroke-linecap="round"/><path d="M6 41H58" stroke="{rails}" stroke-width="5" stroke-linecap="round"/>'
        f'<circle cx="32" cy="32" r="16.5" fill="{halo}"/>'
        f'<circle cx="32" cy="32" r="12" fill="{disc}"/>'
    )
    if bare:
        return body
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="{size}" height="{size}" '
        f'role="img" aria-label="Enrailar">{body}</svg>'
    )


def symbol_mono(color, halo, bare=False):
    body = (
        f'<path d="M6 23H58" stroke="{color}" stroke-width="5" stroke-linecap="round"/><path d="M6 41H58" stroke="{color}" stroke-width="5" stroke-linecap="round"/>'
        f'<circle cx="32" cy="32" r="16.5" fill="{halo}"/>'
        f'<circle cx="32" cy="32" r="10" fill="none" stroke="{color}" stroke-width="4"/>'
    )
    if bare:
        return body
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="Enrailar">{body}</svg>'


def wordmark_group(data, text, dot, scale, x, baseline):
    """Letras en `text` y el punto de la i como disco en `dot`."""
    paths = "".join(f'<path d="{rnd(p)}"/>' for p in data["paths"])
    x0, y0, x1, y1 = data["dotBox"]
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = (x1 - x0) / 2 * 1.12
    return (
        f'<g transform="translate({x} {baseline}) scale({scale})">'
        f'<g fill="{text}">{paths}</g>'
        f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{dot}"/>'
        f"</g>"
    )


def main(src, out):
    data = json.loads(Path(src).read_text())
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    adv = data["advance"]
    cap = data["capHeight"]

    # Wordmark solo. Altura de caja: 820 unidades (ascendente + margen), ancho = avance.
    wm_scale = 1.0
    wm = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -780 {adv:.0f} 840" width="{adv/8:.0f}" height="105" role="img" aria-label="enrailar">'
        + wordmark_group(data, INK, GOLD, wm_scale, 0, 0) + "</svg>"
    )
    (out / "wordmark.svg").write_text(wm)

    # Horizontal: símbolo 64 + separación 16 + wordmark con capHeight 38.
    s = 38 / cap
    w = 64 + 16 + adv * s
    h = 64
    baseline = 32 + 38 / 2 + 2  # centrado óptico sobre el símbolo
    def horizontal(rails, disc, halo, text, dot, bg=None, mono=False):
        parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h}" width="{w:.0f}" height="{h}" role="img" aria-label="Enrailar">']
        if bg:
            parts.append(f'<rect width="{w:.0f}" height="{h}" fill="{bg}"/>')
        parts.append("<g>" + (symbol_mono(text, halo, bare=True) if mono else symbol(rails, disc, halo, bare=True)) + "</g>")
        parts.append(wordmark_group(data, text, dot, s, 80, baseline))
        parts.append("</svg>")
        return "".join(parts)

    (out / "logo-horizontal.svg").write_text(horizontal(CELESTE, GOLD, WHITE, INK, GOLD))
    (out / "logo-mono.svg").write_text(horizontal(INK, INK, WHITE, INK, INK, mono=True))
    (out / "logo-invertido.svg").write_text(horizontal(CELESTE_SOFT, GOLD_SOFT, INK, WHITE, GOLD_SOFT, bg=INK))

    # Apilado: símbolo arriba centrado, wordmark abajo con capHeight 30.
    s2 = 30 / cap
    ww = adv * s2
    W = max(ww, 64) + 24
    H = 64 + 14 + 44
    sym_x = (W - 64) / 2
    stacked = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H}" width="{W:.0f}" height="{H}" role="img" aria-label="Enrailar">'
        f'<g transform="translate({sym_x:.1f} 0)">{symbol(CELESTE, GOLD, WHITE, bare=True)}</g>'
        + wordmark_group(data, INK, GOLD, s2, (W - ww) / 2, 64 + 14 + 30) + "</svg>"
    )
    (out / "logo-apilado.svg").write_text(stacked)

    (out / "simbolo.svg").write_text(symbol(CELESTE, GOLD, WHITE))
    (out / "simbolo-mono.svg").write_text(symbol_mono(INK, WHITE))
    (out / "favicon.svg").write_text(symbol(CELESTE, GOLD, WHITE, size=64))
    # Ícono con fondo (maskable / apple-touch): disco sobre blanco con margen.
    icon = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">'
        f'<rect width="64" height="64" rx="14" fill="{WHITE}"/>'
        f'<g transform="translate(8 8) scale(0.75)">{symbol(CELESTE, GOLD, WHITE, bare=True)}</g></svg>'
    )
    (out / "icon.svg").write_text(icon)
    print("ok", sorted(p.name for p in out.iterdir()))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
