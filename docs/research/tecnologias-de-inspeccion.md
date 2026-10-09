# Tecnologías de inspección

Qué miden ENSCO, Plasser & Theurer, el LiDAR aéreo de DJI, el ultrasonido de riel y el georradar de balasto, y qué de eso sirve para un prototipo de monitoreo.

Consulta: 2026-10-09.

## La pregunta de la fase 1

Enrailar define la fase 1 como monitoreo: geometría de vía, desgaste de riel, durmientes y fijaciones, drenajes, vegetación, obstáculos, fotos georreferenciadas, modelos tridimensionales y una forma de ver defectos internos y capas bajo el balasto. Hay industria que ya vende cada una de esas mediciones. El prototipo no tiene que inventar el fenómeno físico. Tiene que elegir pocos sensores, responder una pregunta concreta y poder compararse con una inspección profesional.

Esta ficha describe sistemas publicados por sus fabricantes. No es una evaluación de compra ni un ensayo sobre vía argentina.

## Geometría de vía

La geometría es el primer filtro de seguridad: trocha (gauge), curvatura, peralte (crosslevel), alabeo (warp, twist), nivelación longitudinal (profile, surface) y alineación. Desvíos grandes se asocian a descarrilamientos por trocha abierta, remonte de rueda o volcado de riel, y también agravan otros modos de falla.

ENSCO publica el Track Geometry Measurement System (TGMS) con esas magnitudes. Declara dos rasgos útiles para un prototipo lento: montaje de la viga de medición en la caja del vehículo, no en el bogie, y una extensión de «velocidad cero» para canales que en los sistemas inerciales clásicos se cortan a baja velocidad. El TGMS se integra con visión artificial de durmientes y balasto (Track Component Imaging System) y con otros sensores, de modo que un defecto geométrico y una foto queden en el mismo punto.

Plasser & Theurer ofrece la medición como servicio (Measurement as a Service), ofrecida desde 2018. Los vehículos EM100VT y EM120VT miden dentro del horario, hasta 120 km/h, sin tomar posesión de la vía en el sentido de un corte de obra, y declaran geometría conforme a EN 13848 incluso sin una velocidad mínima. El EM100VT suma inspección automática de aparatos de vía. El EM120VT suma video de componentes con evaluación asistida, perfil de riel, video de cabina y geometría de catenaria. La misma oferta permite instalar los sistemas en un vehículo del cliente: un caso descrito en 2024 es una línea de carga pesada en Colombia, con integración hecha por Plasser Italiana y análisis del Global Rail Group. Otro caso citado es el relevamiento de la alta velocidad Hannover–Würzburg (523 km de vía en dos turnos) para un gemelo usable en obra.

Para Enrailar, las dos vías industriales son distintas. ENSCO y Plasser venden el instrumento y, en el caso de Plasser, la campaña hecha por ellos. Un robot propio se justifica si se valida contra uno de esos sistemas, o contra un equipo equivalente, en un tramo corto y autorizado. Medir «algo» sin esa comparación no alcanza para decidir una velocidad.

El texto completo de EN 13848 no se compró en esta revisión. La conformidad se toma de lo que Plasser declara en su sitio.

## Riel: ultrasonido y visión

El ultrasonido busca discontinuidades internas (fisuras de cabeza, alma y patín, defectos de soldadura) que la foto no ve. La norma europea EN 16729-1:2016 fija principios para que distintos sistemas den resultados comparables de ubicación, tipo y tamaño en rieles ya instalados, de perfiles cubiertos por EN 13674-1 (46 kg/m en adelante). Alcanza a vehículos de auscultación y a dispositivos de empuje manual. La propia ficha de la norma aclara que no gestiona qué hacer con el defecto y que no cubre el ensayo en fábrica. La parte 2 de la misma serie trata corrientes inducidas (eddy current), complementarias para defectos superficiales.

ENSCO comercializa el Ultrasonic Rail Flaw System (URFS) integrado con geometría de velocidad cero, perfil de riel y visión (Rail Surface Imaging System y Joint Bar Imaging System). El fabricante presenta esa integración como forma de bajar paradas falsas y de ubicar el defecto con el resto de los datos. Es un argumento de producto. No se encontró un ensayo independiente citado en el sitio.

Límites físicos que cualquier prototipo hereda, estén o no en el folleto:

- hace falta acoplante (en la práctica, agua) entre palpador y riel;
- el estado de la superficie —descascarado, corrosión, grasa— degrada la señal;
- el ensayo se calibra con defectos conocidos;
- una indicación no es, todavía, una decisión de sacar el riel de servicio.

Un robot de fase 1 puede llevar ultrasonido el día en que su salida se compare, metro a metro, con un equipo de auscultación aceptado por quien administra la vía. Hasta ese día, la foto y la geometría responden otras preguntas.

## Balasto y plataforma: georradar

El georradar (GPR) emite ondas electromagnéticas y lee reflejos en los cambios de material. En vía sirve para espesor de balasto, contaminación (fouling), humedad, bombeo de finos y problemas de drenaje. No mira adentro del riel. El metal de los rieles y la humedad complican la lectura. La interpretación sigue siendo un oficio; el radar no reemplaza un sondeo geotécnico puntual.

Plasser GroundScan es un GPR de tres canales, específico de plataforma ferroviaria, montable en un vehículo ferroviario en menos de 90 minutos según el fabricante, con adquisición hasta 250 km/h y análisis experto opcional. IDS GeoRadar publica el SRS Safe Rail System, arreglo de antenas centrado en 400 MHz, pensado para espesor y estado del balasto, con velocidades de adquisición que el folleto lleva por encima de 300 km/h a un paso de 12 cm, más video y posicionamiento. Son dos productos distintos. Las velocidades son las que cada fabricante declara para su sistema, no una medida hecha en Argentina.

Un prototipo lento en un ramal de carga no necesita 250 km/h. Necesita poder decir, en un tramo embarrado o con durmientes bailando, si el problema está en la superficie o en la capa de abajo. Esa es la pregunta que el GPR contesta mejor que la cámara. Conviene arrancar por unos cientos de metros ya mirados por un ojo entrenado, no por un mapa nacional automático.

## LiDAR aéreo

DJI Zenmuse L2, el sistema que esta línea de trabajo tomó como referencia de catálogo, integra LiDAR de marco, IMU y una cámara RGB de 20 MP (sensor 4/3). El sitio de especificaciones de DJI, consultado el 2026-10-09, publica entre otros:

- alcance de detección típico: 450 m al 50 % de reflectividad y 0 klx; 250 m al 10 % y 100 klx;
- exactitud de distancia: 2 cm a 150 m (RMS 1σ), en las condiciones de laboratorio que la ficha detalla;
- exactitud del sistema, declarada para un vuelo concreto: 5 cm horizontal y 4 cm vertical a 150 m, con Matrice 350 RTK, RTK fijo, escaneo repetitivo, 15 m/s, gimbal a −90° y postproceso en DJI Terra con optimización de nube;
- hasta 5 retornos; 240.000 puntos/s en retorno simple y hasta 1.200.000 en retornos múltiples;
- láser de 905 nm, clase 1 (IEC 60825-1:2014); huella del orden de 4 cm por 12 cm a 100 m;
- modos repetitivo (70° × 3°, más uniforme) y no repetitivo (70° × 75°, más penetración en vegetación);
- peso 905 ± 5 g; IP54; aeronaves declaradas en el manual de 2024: Matrice 350 RTK y Matrice 300 RTK.

Esas cifras son de mapeo topográfico en las condiciones del fabricante. La cabeza de un riel es un blanco chico, oscuro y a veces bajo vegetación. La huella a 100 m ya es más ancha que el desgaste que interesa para autorizar una velocidad. El L2 sirve para el entorno: desmonte, drenaje, vegetación, obstáculos, galibo grueso, edificios de estación, pasos a nivel. No reemplaza un perfilómetro de riel ni el TGMS.

El 4 de noviembre de 2025 DJI presentó el Zenmuse L3 (láser de 1535 nm, cámaras de 100 MP, plataforma Matrice 400, alcances mayores según el comunicado). El L2 sigue documentado y disponible en el sitio enterprise, y ya no es el tope de gama. Un prototipo de 2026 debería partir del manual vigente del sensor que efectivamente se compre, no de la ficha L2 como si fuera la única.

Volar sobre una traza ferroviaria agrega dos permisos distintos del sensor: el del administrador de la infraestructura, si el vuelo afecta la operación o el predio, y el de la autoridad aeronáutica. Esta revisión no leyó la normativa ANAC aplicable. Queda como tarea regulatoria, no como un detalle de la cámara.

## Cómo se combinan

El valor industrial que ENSCO y Plasser repiten es la correlación: misma posición, varios fenómenos. Una nube LiDAR sin kilometraje ferroviario, un ultrasonido sin foto y una geometría sin fecha no forman un mapa de decisiones. El identificador mínimo de una observación de fase 1 es línea, ramal, progresiva o coordenada, sensor, fecha y persona o equipo responsable.

Orden razonable para un prototipo corto, autorizado y comparado con un equipo profesional:

1. Foto georreferenciada y nube del entorno (drone), para vegetación, drenaje y obstáculos.
2. Geometría básica y estado visible de durmiente y fijación, a baja velocidad, en el mismo eje.
3. Ultrasonido y georradar cuando exista con qué contrastarlos.

«Dos mil sensores» es una ambición de cobertura. El primer equipo se define por los defectos que sabe nombrar.

## Fabricación local

El encuadre de Enrailar busca combinar estas capacidades con ingeniería, fabricación y mantenimiento en Argentina. Esta ficha no identificó un integrador local equivalente a los sistemas citados, ni lo descarta. Es un hueco de relevamiento industrial, no una conclusión.

## Fuentes

Consultadas el 2026-10-09.

- ENSCO, tecnologías de inspección: <https://www.ensco.com/rail/inspection-technologies>
- ENSCO, TGMS: <https://www.ensco.com/rail/track-geometry-measurement-system-tgms>
- ENSCO, URFS: <https://www.ensco.com/rail/ultrasonic-rail-flaw-system-urfs>
- Folleto ENSCO Rail (PDF, 2024): <https://www.ensco.com/sites/default/files/2024-09/ENSCO-Track-Inspection-Products-Services-Booklet-9057-2024_0.pdf>
- Plasser & Theurer, Measurement as a Service: <https://www.plassertheurer.com/en/infrastructure/measuring-and-inspection/measurement-as-a-service>
- Plasser & Theurer, flota EM-VT: <https://www.plassertheurer.com/en/infrastructure/measuring-and-inspection/em-vt-fleet>
- Plasser & Theurer, nota de servicio: <https://aktuell.plassertheurer.com/en/aktuell142/measurement-as-a-service>
- Artículo ETR sobre MaaS (PDF en el sitio de Plasser): <https://www.plassertheurer.com/fileadmin/user_upload/Mediathek/Publikationen/ETR_International_2024.pdf>
- Plasser GroundScan: <https://www.plasserdiagnostics.com/en/infrastructure/track/plasser-groundscan>
- IDS GeoRadar, folleto SRS: <https://idsgeoradar.com/-/media/files/ids%20georadar/brochures/idsgeoradar%20srs%20safe%20rail%20system-0224-web.ashx>
- BSI, ficha EN 16729-1:2016: <https://knowledge.bsigroup.com/products/railway-applications-infrastructure-non-destructive-testing-on-rails-in-track-requirements-for-ultrasonic-inspection-and-evaluation-principles>
- Vista previa EN 16729-1: <https://webstore.ansi.org/preview-pages/BSI/preview_30269478.pdf>
- DJI Zenmuse L2: <https://enterprise.dji.com/zenmuse-l2>
- Especificaciones L2: <https://enterprise.dji.com/zenmuse-l2/specs>
- Preguntas frecuentes L2: <https://enterprise.dji.com/zenmuse-l2/faq>
- DJI, lanzamiento Zenmuse L3, 4 de noviembre de 2025: <https://enterprise-insights.dji.com/blog/dji-zenmuse-l3-officially-released> y <https://www.prnewswire.com/news-releases/zenmuse-l3-launches-as-djis-first-long-range-high-accuracy-aerial-lidar-system-302603959.html>
