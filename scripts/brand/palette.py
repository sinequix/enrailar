#!/usr/bin/env python3
"""Paleta de Enrailar: hex -> RGB -> OKLCH y contraste WCAG 2.x.

Uso: python3 scripts/brand/palette.py [--md]
Imprime la tabla de tokens y la matriz de contraste de los pares que usa la web.
La salida con --md se pega tal cual en docs/brand/manual.md.
"""
import math
import sys

TOKENS = {
    # nombre: (hex, rol)
    "blanco":        ("#FFFFFF", "Fondo principal, superficies."),
    "niebla":        ("#F3F7FA", "Fondo alterno de secciones, tarjetas sobre blanco."),
    "celeste-100":   ("#D9EAF5", "Tinte de superficie, bandas, estados hover suaves."),
    "celeste-300":   ("#8DBEE2", "Celeste de identidad. Decorativo: líneas, iconos grandes, fondos."),
    "celeste-500":   ("#3E86BD", "Elementos de interfaz grandes (3:1): bordes activos, iconos, vía del diagrama."),
    "celeste-700":   ("#1C5A88", "Enlaces, botones primarios, foco. Texto sobre blanco."),
    "azul-riel":     ("#0E2A42", "Tinta principal: titulares y texto. Fondo del modo oscuro."),
    "oro-300":       ("#F2CC6B", "Tinte de oro: fondos de etiqueta, halo del sol."),
    "oro-500":       ("#D9A520", "Oro del sol de mayo. Decorativo: puntos, nodos, subrayados."),
    "oro-700":       ("#7E5E0B", "Texto o etiqueta en oro sobre blanco (AA)."),
    "balasto":       ("#4A5A68", "Texto secundario, notas."),
    "gris-100":      ("#E3EAF0", "Líneas, bordes, separadores."),
    "gris-300":      ("#B9C6D1", "Bordes de campos, placeholders decorativos."),
    "exito":         ("#1E6B3A", "Estado enviado."),
    "error":         ("#A3331F", "Estado rechazado."),
}

PAIRS = [
    # (frente, fondo, uso, mínimo requerido)
    ("azul-riel", "blanco", "Titulares y texto sobre blanco", 4.5),
    ("azul-riel", "niebla", "Texto sobre fondo alterno", 4.5),
    ("azul-riel", "celeste-100", "Texto sobre banda celeste", 4.5),
    ("balasto", "blanco", "Texto secundario", 4.5),
    ("balasto", "niebla", "Notas sobre fondo alterno", 4.5),
    ("celeste-700", "blanco", "Enlaces y texto en celeste", 4.5),
    ("celeste-700", "niebla", "Enlaces sobre fondo alterno", 4.5),
    ("blanco", "celeste-700", "Texto de botón primario", 4.5),
    ("blanco", "azul-riel", "Texto en pie de página / modo oscuro", 4.5),
    ("oro-700", "blanco", "Etiqueta en oro sobre blanco", 4.5),
    ("oro-300", "azul-riel", "Oro sobre tinta (pie, slide)", 4.5),
    ("celeste-300", "azul-riel", "Celeste claro sobre tinta (pie, slide)", 4.5),
    ("celeste-500", "blanco", "Componentes de interfaz (bordes, iconos)", 3.0),
    ("celeste-700", "celeste-100", "Anillo de foco sobre banda celeste", 3.0),
    ("exito", "blanco", "Mensaje de éxito", 4.5),
    ("error", "blanco", "Mensaje de error", 4.5),
    ("azul-riel", "oro-300", "Credencial: texto sobre oro claro", 4.5),
]


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def srgb_to_linear(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = (srgb_to_linear(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a, b):
    la, lb = luminance(hex_to_rgb(a)), luminance(hex_to_rgb(b))
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def oklch(h):
    r, g, b = (srgb_to_linear(c) for c in hex_to_rgb(h))
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (x ** (1 / 3) for x in (l, m, s))
    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    C = math.hypot(a, bb)
    H = (math.degrees(math.atan2(bb, a)) + 360) % 360 if C > 1e-4 else 0
    return L, C, H


def main():
    md = "--md" in sys.argv
    sep = " | " if md else "  "
    print("| Token | Hex | RGB | OKLCH | Uso |" if md else "TOKENS")
    if md:
        print("| --- | --- | --- | --- | --- |")
    for name, (hx, role) in TOKENS.items():
        r, g, b = hex_to_rgb(hx)
        L, C, H = oklch(hx)
        row = [f"`--{name}`" if md else name, hx, f"{r} {g} {b}", f"oklch({L:.3f} {C:.3f} {H:.1f})", role]
        print(("| " + " | ".join(row) + " |") if md else sep.join(row))
    print()
    print("| Frente | Fondo | Uso | Ratio | Mínimo | Resultado |" if md else "CONTRASTE")
    if md:
        print("| --- | --- | --- | --- | --- | --- |")
    failed = 0
    for fg, bg, use, minimum in PAIRS:
        ratio = contrast(TOKENS[fg][0], TOKENS[bg][0])
        ok = ratio >= minimum
        failed += not ok
        row = [f"`--{fg}`" if md else fg, f"`--{bg}`" if md else bg, use, f"{ratio:.2f}:1", f"{minimum}:1", "AA ✓" if ok else "FALLA"]
        print(("| " + " | ".join(row) + " |") if md else sep.join(row))
    if failed:
        print(f"\n{failed} pares fallan", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
