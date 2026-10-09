#!/usr/bin/env python3
"""Genera los contornos del wordmark "enrailar" desde Archivo (OFL) con fontTools.

Uso: python3 scripts/brand/wordmark.py <Archivo[wdth,wght].ttf>
Imprime JSON con: paths (lista de <path d>), dot (contorno del punto de la i),
width y height en unidades de 1000/em. El SVG final se arma en logo.py.
"""
import json
import sys

from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

WORD = "enrailar"
WGHT, WDTH = 640, 100
TRACKING = -8  # unidades/em, leve ajuste óptico


def contours(glyph, glyphset):
    """Devuelve cada contorno del glifo como lista de operaciones."""
    rec = RecordingPen()
    glyph.draw(rec)
    out, cur = [], []
    for op, args in rec.value:
        cur.append((op, args))
        if op in ("closePath", "endPath"):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def contour_to_svg(ops, dx, scale):
    pen = SVGPathPen(None)
    tpen = TransformPen(pen, (scale, 0, 0, -scale, dx * scale, 0))
    for op, args in ops:
        getattr(tpen, op)(*args)
    return pen.getCommands()


def contour_bbox(ops):
    ys = [p[1] for _, args in ops for p in args if isinstance(p, tuple)]
    return min(ys), max(ys)


def main(path):
    font = TTFont(path)
    inst = instantiateVariableFont(font, {"wght": WGHT, "wdth": WDTH})
    upem = inst["head"].unitsPerEm
    scale = 1000 / upem
    glyphset = inst.getGlyphSet()
    cmap = inst.getBestCmap()
    hmtx = inst["hmtx"]
    x = 0
    paths, dot, dot_box = [], None, None
    for ch in WORD:
        name = cmap[ord(ch)]
        glyph = glyphset[name]
        parts = contours(glyph, glyphset)
        if ch == "i" and len(parts) > 1:
            top = max(parts, key=lambda c: contour_bbox(c)[0])
            dot = contour_to_svg(top, x, scale)
            pts = [p for _, args in top for p in args if isinstance(p, tuple)]
            dot_box = [
                (min(p[0] for p in pts) + x) * scale, -max(p[1] for p in pts) * scale,
                (max(p[0] for p in pts) + x) * scale, -min(p[1] for p in pts) * scale,
            ]
            parts = [c for c in parts if c is not top]
        for c in parts:
            paths.append(contour_to_svg(c, x, scale))
        x += hmtx[name][0] + TRACKING
    ascender = inst["OS/2"].sTypoAscender * scale
    descender = inst["OS/2"].sTypoDescender * scale
    print(json.dumps({
        "paths": paths, "dot": dot, "dotBox": dot_box, "advance": x * scale,
        "ascender": ascender, "descender": descender,
        "xHeight": inst["OS/2"].sxHeight * scale, "capHeight": inst["OS/2"].sCapHeight * scale,
    }))


if __name__ == "__main__":
    main(sys.argv[1])
