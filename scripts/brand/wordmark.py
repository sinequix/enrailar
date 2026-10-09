#!/usr/bin/env python3
"""Contornos del wordmark "enrailar" a partir de Archivo (OFL), ya en píxeles enteros.

Uso: python3 scripts/brand/wordmark.py <Archivo[wdth,wght].ttf> > scripts/brand/wordmark.json

El wordmark se dibuja una sola vez en su tamaño de uso: altura de x = 16 px, fuste = 4 px
(el mismo grosor que los rieles del símbolo), línea base en y = 24 dentro de una caja de 32.
El peso se elige para que el fuste de la "l" mida exactamente 4 px a esa escala. Después:

- las zonas azules se aplanan (los rebases de -12 y +12 unidades caen en la base y en la x),
- el kerning viene de la tabla GPOS vía HarfBuzz,
- los puntos que definen bordes (extremos con tangente horizontal o vertical, y las rectas)
  se redondean al píxel entero; el resto de la curva queda con un decimal (curvas suaves),
- el punto de la i se reemplaza por un disco de oro de radio 2.

El JSON resultante es la fuente de verdad del wordmark (sin dependencia de la fuente) y lo
consume logo.py. Salida: {"xHeight", "baseline", "ascender", "width", "glyphs": [{"ch", "contours": [[op, [x, y]...]]}], "dot": {"cx", "cy", "r"}}.
"""
import json
import math
import sys

import uharfbuzz as hb
from fontTools.pens.basePen import decomposeQuadraticSegment
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

WORD = "enrailar"
X_HEIGHT = 16          # px
STEM = 4               # px, igual que el riel
BASELINE = 24          # px, dentro de la caja de 32
WIDTH_AXIS = 100
TRACKING = 0           # px entre letras, además del kerning
KERN = {"ra": 1}       # px: ajustes ópticos sobre el kerning de la fuente (el brazo de la r roza la a)
DOT_R = 2              # radio del punto de la i (disco de oro)
LEFT_BEARING = 0       # px: el primer fuste arranca en x = 0


def rnd(v):
    """Redondeo mitad arriba, estable (round() de Python es a par)."""
    return int(math.floor(v + 0.5))


def stem_width(font, wght):
    inst = instantiateVariableFont(TTFont(font), {"wght": wght, "wdth": WIDTH_AXIS})
    gs = inst.getGlyphSet()
    rec = RecordingPen()
    gs[inst.getBestCmap()[ord("l")]].draw(rec)
    xs = [p[0] for _, args in rec.value for p in args if isinstance(p, tuple)]
    return max(xs) - min(xs), inst


def pick_weight(font, x_height_units):
    """Peso donde fuste/altura-de-x == STEM/X_HEIGHT, por bisección en el eje wght."""
    target = STEM / X_HEIGHT * x_height_units
    lo, hi = 500.0, 800.0
    for _ in range(24):
        mid = (lo + hi) / 2
        w, _ = stem_width(font, mid)
        if w < target:
            lo = mid
        else:
            hi = mid
    return round((lo + hi) / 2)


def contours_of(glyph):
    """Contornos como ops; las curvas TrueType se descomponen en cuadráticas de un solo
    punto de control antes de redondear, así los puntos implícitos también quedan enteros."""
    rec = RecordingPen()
    glyph.draw(rec)
    out, cur = [], []
    for op, args in rec.value:
        if op == "qCurveTo":
            assert args[-1] is not None, "contorno sin puntos de ancla: no esperado en Archivo"
            for ctrl, end in decomposeQuadraticSegment(args):
                cur.append(("qCurveTo", (ctrl, end)))
            continue
        cur.append((op, args))
        if op in ("closePath", "endPath"):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def snap_blue(y, xh):
    """Zonas azules: rebases a la base y a la altura de x se aplanan."""
    if -14 <= y <= 0:
        return 0
    if xh <= y <= xh + 14:
        return xh
    return y


def to_pixels(contour, x0, scale, xh):
    """Contorno en unidades de fuente -> ops en píxeles (y hacia abajo), con "hinting":

    - los extremos de curva con tangente horizontal se llevan a una y entera (y sus dos puntos
      de control a esa misma y, para que la tangente siga horizontal); los de tangente vertical,
      igual en x. Son los puntos que fijan fustes, panzas, base y altura de x;
    - los extremos de los segmentos rectos se redondean al entero en x e y;
    - el resto de la curva se guarda con un decimal (error máximo 0,05 px: invisible), así las
      curvas no se quiebran como pasaría redondeando también los controles."""
    pts = []  # [x, y, on, es_recta]
    for op, args in contour:
        if op == "moveTo":
            pts.append([args[0][0], args[0][1], True, False])
        elif op == "lineTo":
            pts[-1][3] = True
            pts.append([args[0][0], args[0][1], True, True])
        elif op == "qCurveTo":
            pts.append([args[0][0], args[0][1], False, False])
            pts.append([args[1][0], args[1][1], True, False])
    closed = contour[-1][0] == "closePath"
    if closed and len(pts) > 1 and pts[0][:2] == pts[-1][:2]:
        pts[0][3] = pts[0][3] or pts[-1][3]
        pts.pop()
    n = len(pts)
    # Clasificación en unidades de fuente (antes de escalar), con tolerancia de 2 unidades.
    snap_x = [False] * n
    snap_y = [False] * n
    for i, (x, y, on, straight) in enumerate(pts):
        if not on:
            continue
        if straight:
            snap_x[i] = snap_y[i] = True
            continue
        px_, nx_ = pts[(i - 1) % n], pts[(i + 1) % n]
        if abs(px_[1] - y) <= 2 and abs(nx_[1] - y) <= 2:
            snap_y[i] = True
        if abs(px_[0] - x) <= 2 and abs(nx_[0] - x) <= 2:
            snap_x[i] = True
    # A píxeles.
    out = []
    for x, y, on, straight in pts:
        out.append([x0 + x * scale, BASELINE - snap_blue(y, xh) * scale])
    for i in range(n):
        if snap_y[i]:
            yy = rnd(out[i][1]); out[i][1] = yy
            if not pts[i][3]:
                out[(i - 1) % n][1] = yy; out[(i + 1) % n][1] = yy
        if snap_x[i]:
            xx = rnd(out[i][0]); out[i][0] = xx
            if not pts[i][3]:
                out[(i - 1) % n][0] = xx; out[(i + 1) % n][0] = xx
    for i in range(n):
        out[i] = [num(out[i][0]), num(out[i][1])]
    # Volver a ops.
    ops = [["moveTo", [out[0]]]]
    i = 1
    while i < n:
        if pts[i][2]:
            ops.append(["lineTo", [out[i]]]); i += 1
        else:
            end = out[(i + 1) % n]
            ops.append(["qCurveTo", [out[i], end]]); i += 2
    if closed:
        ops.append(["closePath", []])
    return clean(ops)


def num(v):
    r = round(v, 1)
    return int(r) if r == int(r) else r


def clean(ops):
    """Elimina segmentos de largo cero y curvas degeneradas tras el redondeo."""
    out = []
    last = None
    for op, pts in ops:
        if op == "moveTo":
            out.append([op, pts])
            last = pts[-1]
            continue
        if op in ("closePath", "endPath"):
            out.append([op, []])
            continue
        if op == "qCurveTo":
            ctrl, end = pts
            if end == last and ctrl == last:
                continue
            if ctrl == end or ctrl == last:
                op, pts = "lineTo", [end]
        if op == "lineTo" and pts[-1] == last:
            continue
        out.append([op, pts])
        last = pts[-1]
    return out


def main(path):
    font = TTFont(path)
    x_height_units = font["OS/2"].sxHeight
    wght = pick_weight(path, x_height_units)
    stem_units, inst = stem_width(path, wght)
    scale = X_HEIGHT / x_height_units
    glyphset = inst.getGlyphSet()
    cmap = inst.getBestCmap()

    # Kerning real (GPOS) con HarfBuzz sobre la instancia estática.
    blob = hb.Blob(open(path, "rb").read())
    face = hb.Face(blob)
    hbfont = hb.Font(face)
    hbfont.set_variations({"wght": wght, "wdth": WIDTH_AXIS})
    buf = hb.Buffer()
    buf.add_str(WORD)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": False})
    infos, positions = buf.glyph_infos, buf.glyph_positions
    names = inst.getGlyphOrder()

    # Origen de la primera letra: su fuste izquierdo cae en x = LEFT_BEARING.
    first = contours_of(glyphset[cmap[ord(WORD[0])]])
    first_min_x = min(p[0] for c in first for _, args in c for p in args if isinstance(p, tuple))
    pen_x = LEFT_BEARING - first_min_x * scale

    glyphs, dot = [], None
    for ch, info, pos in zip(WORD, infos, positions):
        name = names[info.codepoint]
        assert name == cmap[ord(ch)], (name, ch)
        x0 = rnd(pen_x + pos.x_offset * scale)
        parts = contours_of(glyphset[name])
        if ch == "i":
            # El punto de la i: el contorno más alto, reemplazado por un disco.
            top = max(parts, key=lambda c: min(p[1] for _, a in c for p in a if isinstance(p, tuple)))
            pts = [p for _, a in top for p in a if isinstance(p, tuple)]
            cx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
            cy = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
            dot = {"cx": rnd(x0 + cx * scale), "cy": rnd(BASELINE - cy * scale), "r": DOT_R}
            parts = [c for c in parts if c is not top]
        glyphs.append({"ch": ch, "contours": [to_pixels(c, x0, scale, x_height_units) for c in parts]})
        pen_x += pos.x_advance * scale + TRACKING
        nxt = WORD[len(glyphs):len(glyphs) + 1]
        pen_x += KERN.get(ch + nxt, 0)

    last = glyphs[-1]["contours"]
    width = max(p[0] for c in last for _, pts in c for p in pts)
    ascender = min(p[1] for g in glyphs for c in g["contours"] for _, pts in c for p in pts)
    json.dump({
        "font": "Archivo", "wght": wght, "wdth": WIDTH_AXIS, "scale": round(scale, 6),
        "stemUnits": round(stem_units, 1), "xHeight": X_HEIGHT, "stem": STEM,
        "baseline": BASELINE, "ascender": ascender, "width": width,
        "glyphs": glyphs, "dot": dot,
    }, sys.stdout, separators=(",", ":"))
    print(f"wght {wght} stem {stem_units:.1f}u = {stem_units * scale:.2f}px, width {width}px, ascender y={ascender}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
