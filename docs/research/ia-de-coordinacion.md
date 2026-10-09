# Inteligencia artificial de coordinación

Dónde la industria ferroviaria usa modelos para planificar y reordenar el tráfico, y qué dato tiene que existir antes para que eso sirva en Enrailar.

Consulta: 2026-10-09.

## Coordinar no es conducir

La ficha de trenes autónomos trata del vehículo: protección, tracción, freno, personas a bordo. Esta trata de la red: qué tren sale, por qué vía, detrás de qué obra, y qué se hace cuando algo se rompe. Un optimizador puede proponer un nuevo gráfico. La autorización de la marcha sigue en el sistema de señalamiento y en el responsable de la circulación.

Enrailar incluye, en su encuadre, inteligencia artificial para la coordinación. La fase 1 es el monitoreo. Sin un inventario fechado de vía, de administrador y de defectos, un modelo de coordinación no tiene red que coordinar.

## Qué dice el relevamiento de la UIC

En febrero de 2024 la Unión Internacional de Ferrocarriles (UIC) publicó, con McKinsey, *The journey toward AI-enabled railway companies*. El estudio mira aprendizaje automático y aprendizaje profundo. Dejó la robótica fuera. Se apoya en información pública, en una encuesta a 11 empresas de Europa y Asia entre junio y noviembre de 2023, y en entrevistas a empresas y fabricantes. El foco pedido por el comité de la UIC era la alta velocidad y el pasajero. El propio informe dice que varios usos valen también para la carga.

El resultado que más importa acá: la mayoría de las empresas encuestadas no tenía casos desplegados a escala. Los que sí llegaron a escala se concentraron en pocos objetivos, con equipos dedicados.

En las operadoras, los usos más maduros que el informe destaca son la planificación de turnos y el mantenimiento predictivo del material rodante. Después aparecen eficiencia energética, programación del servicio, trenes autónomos y gestión de perturbaciones en tiempo real.

En los administradores de infraestructura, el uso a escala que el informe subraya es el mantenimiento predictivo de la vía. El resto —planificación de capacidad, gestión de tráfico en tiempo real, inventario, copilotos de mantenimiento, gemelos de la red— está nombrado como campo, no como práctica ya común.

Las trabas que las propias empresas ponen por delante coinciden con el estado argentino descrito en la otra ficha: datos siloados y de mala calidad, dudas de titularidad (quién es dueño del dato de la vía concesionada), poca estandarización y falta de oficio digital. El informe agrega ciberseguridad y gobernanza del dato como condiciones de arranque, no como un anexo.

Un modelo generativo ayuda a pasar documentos viejos —partes de vía, planos, normas internas— a un formato consultable. Eso no los vuelve verdaderos. Alguien tiene que contrastarlos con el riel.

## Sistemas en desarrollo, no productos de estantería

**Gestión de perturbaciones (Europe's Rail).** El catálogo de la empresa común europea describe un apoyo a la decisión que, ante una falla de un activo, propone acciones y las contrasta con un gemelo antes de ejecutarlas, y otro módulo que arma alternativas (por ejemplo, reemplazar trenes por ómnibus) y las puntúa. El texto lo presenta en entorno de demostración, con datos reales de operadores, no como el despacho diario de una red.

**Capacity & Traffic Management System (Alemania).** Digitale Schiene Deutschland desarrolla un planificador que, ante una perturbación, rearma el gráfico en segundos combinando investigación operativa y aprendizaje por refuerzo profundo. Está descrito como pieza del ferrocarril digital futuro, atada a otros componentes (incluido ETCS). No es un paquete que se instale sobre el señalamiento actual de un ramal argentino.

Los dos ejemplos sirven para ver la arquitectura: medición en tiempo real, un modelo de la red, una lista corta de acciones, una persona que decide. Sirven mal como promesa de un despacho automático en Tandil.

## Qué puede hacer la fase 1 sin fingir un centro de control

El objeto de coordinación más chico, y el que el monitoreo sí puede alimentar, es la cola de defectos:

- una observación con lugar, fecha, sensor y responsable;
- una clasificación humana del defecto (riel, durmiente, drenaje, obstáculo, paso a nivel, obra de arte);
- el administrador del tramo, porque el aviso va a esa mesa;
- el vínculo con la intervención posterior: qué se hizo y qué capacidad se recuperó, cuando esa información exista.

Sobre esa cola, un modelo puede ordenar por severidad aparente, agrupar avisos repetidos y marcar incoherencias (la misma progresiva con dos trochas, una foto sin fecha, un defecto cerrado sin evidencia). Eso es higiene de datos y apoyo a la priorización. No es una velocidad autorizada.

La velocidad y la carga dependen de puentes, carga por eje, freno, señalamiento y material rodante. Un ranking de fotos no los reemplaza. La persona habilitada que responde por la seguridad sigue siendo quien cierra el parte.

Cuando haya un corredor con circulación real y con datos de puntualidad, recién aparece la pregunta de la UIC sobre perturbaciones: dado un corte, qué gráfico alternativo molesta menos. Antes de eso, el modelo no tiene trenes que reordenar.

## Titularidad y publicación

Parte de la traza está concesionada. El dato de geometría que produzca un tercero, incluso con permiso, puede estar sujeto al acuerdo con el administrador. El encuadre de Enrailar es open source: conviene separar el software y el esquema de datos, que pueden publicarse, del relevamiento de un tramo, que puede tener restricciones de seguridad operacional (detalle de puentes, de señalamiento, de custodia). Esa separación se diseña antes de abrir un repositorio de mediciones, no después del primer vuelo.

La ciberseguridad del aviso importa porque un defecto falso puede parar un tren y un defecto escondido puede dejarlo circular. El informe de la UIC lo pone entre los riesgos de entrada. Aplica igual a una base chica.

## Límites

No se leyó el PDF de la UIC entero para extraer la matriz de los más de cien casos: se usaron el resumen oficial, la noticia de la UIC del 28 de febrero de 2024 y las secciones metodológicas del PDF. No se auditó el estado 2026 del CTMS alemán ni del demostrador de Europe's Rail. No hay evidencia, en esta pasada, de un sistema argentino equivalente en producción para la red de cargas.

## Fuentes

Consultadas el 2026-10-09.

- UIC, noticia del informe, 28 de febrero de 2024: <https://uic.org/com/enews/article/uic-has-a-new-report-on-the-adoption-of-ai-across-railway-companies>
- UIC, PDF del informe (febrero de 2024): <https://uic.org/com/IMG/pdf/uic_layout_web_05032024.pdf>
- Ficha de la tienda UIC (edición 1 de febrero de 2024): <https://shop.uic.org/en/other-reports/14797-the-journey-toward-ai-enabled-railway-companies.html>
- Europe's Rail, gestión de perturbaciones: <https://rail-research.europa.eu/solutions-catalogue/enhancing-railway-disruption-management-through-a-decision-support-system-and-real-time-optimisation/>
- Digitale Schiene Deutschland, CTMS: <https://digitale-schiene-deutschland.de/en/projects/CTMS>
