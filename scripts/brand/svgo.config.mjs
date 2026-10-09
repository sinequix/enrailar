// Optimización de los SVG de marca. Anclas enteras y controles con un decimal: precisión 1 es sin pérdida.
export default {
  multipass: true,
  js2svg: { indent: 0, pretty: false },
  plugins: [
    {
      name: "preset-default",
      params: {
        overrides: {
          // svgo 4: removeViewBox y removeTitle no están en el preset; el viewBox y el <title> se conservan.
          cleanupNumericValues: { floatPrecision: 1 },
          // Sin pérdida: no aplanar curvas ni convertirlas en arcos (la tolerancia a precisión 0 sería de 1 px).
          convertPathData: { floatPrecision: 1, straightCurves: false, convertToQ: false, curveSmoothShorthands: false, makeArcs: false },
          convertTransform: { floatPrecision: 1 },
          cleanupIds: false,
        },
      },
    },
    { name: "sortAttrs" },
  ],
};
