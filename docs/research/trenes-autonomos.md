# Trenes autónomos

Qué está en servicio en el mundo, qué grado de automatización nombra cada sigla y qué de eso queda fuera de la fase 1 de Enrailar.

Consulta: 2026-10-09.

## Tres sistemas que se confunden

La protección, la conducción automática y el frenado de emergencia no son la misma capa.

El **ATP** (automatic train protection) supervisa velocidad y distancia. Si el tren va a pasar un límite, frena. En Europa esa función, en la familia ERTMS, la cumple el ETCS. La Comisión Europea describe el ERTMS como la suma de ETCS, del sistema de radio (RMR) y del ATO. El ETCS no conduce: impide que se exceda el perfil seguro.

El **ATO** (automatic train operation) aplica tracción y freno dentro de ese perfil. Puede arrancar, regular la marcha y parar en un punto. Solo conduce donde el ATP ya garantiza el movimiento seguro. El documento de principios operativos ERTMS/ATO de la Agencia Ferroviaria de la Unión Europea lo dice así: el ATO no opera aislado.

El **ATS** que el Estado argentino informa como puesto en funciones en 2025 en las siete líneas metropolitanas (Roca, Mitre, San Martín, Sarmiento, Belgrano Norte, Belgrano Sur y Urquiza) es un frenado automático de trenes ante una señal restrictiva. Es protección. No es un tren sin conductor. El plan oficial de la emergencia ferroviaria lo lista entre las medidas de seguridad operacional de 2025.

## Grados de automatización

La escala que usa la industria (UITP, retomada por la prensa técnica y por los principios europeos de ATO) reparte responsabilidades entre personas y sistemas:

| Grado | Qué hace el sistema | Quién sigue a bordo |
| --- | --- | --- |
| GoA0 | Conducción manual sin ATP | Conductor |
| GoA1 | Conducción manual con ATP | Conductor |
| GoA2 | El ATO arranca y frena; el conductor cierra puertas, vigila la vía y asume la degradación | Conductor |
| GoA3 | Sin conductor; hay personal a bordo para lo que no es conducir | Agente |
| GoA4 | Sin personal a bordo | Nadie en el tren; supervisión remota |

El mismo documento europeo anota que, si alguien empieza a conducir un tren GoA3 o GoA4, el grado baja a GoA2 si el automático sigue disponible, o a GoA1 si solo queda la marcha manual. La IEC 62290 define conceptos parecidos para el transporte urbano guiado de pasajeros. Su alcance declarado no es el ferrocarril pesado de vía libre, salvo que la autoridad competente lo extienda.

En la vía principal europea, el objetivo interoperable publicado por la Comisión es ATO sobre ETCS en GoA2: el tren arranca y se detiene solo, el ETCS aporta la protección. Europe's Rail (y antes Shift2Rail) trabajó especificaciones GoA2 entre 2016 y 2021, y trata GoA3 y GoA4 de larga distancia como un escalón posterior, todavía dependiente de normas que cubran todo tipo de línea.

## Lo que ya corre

**Thameslink (Londres).** ATO sobre ETCS nivel 2 en el núcleo de la línea, GoA2. El conductor observa la vía, cierra puertas y recupera la marcha si el automático no está. Es el caso de alta frecuencia en red abierta que la literatura técnica cita como primero de su tipo en vía principal, anterior a la especificación Subset-125. Sirve para entender energía, regularidad y capacidad. Sigue habiendo una persona habilitada en cabina.

**AutoHaul (Pilbara, Australia).** Río Tinto opera trenes de mineral de hierro sin conductor a bordo, descritos por Hitachi y por la prensa técnica como GoA4, con ATO sobre una base equivalente a ETCS nivel 2. La acreditación del regulador australiano de seguridad ferroviaria es de mayo de 2018. El primer tren cargado sin conductor, de unas tres locomotoras y del orden de 280 km entre la mina de Tom Price y el puerto de Cape Lambert, circuló el 10 de julio de 2018. El despliegue completo se anunció a fines de 2018 y principios de 2019. Hitachi lo describe como la primera operación pesada de larga distancia sin conductor.

Un parte posterior de *International Railway Journal* habla de hasta 53 trenes simultáneos, formaciones muy largas, una red de unos 2000 km y intervalos cortos, con radio propia, respaldo por fibra y por satélite, y un centro de control remoto. Las cifras de flota varían según el año del artículo. Lo estable es el tipo de red: cerrada, de un solo producto, de un solo operador, sin el mix de pasajeros, pasos a nivel urbanos y trochas de una red nacional.

AutoHaul demuestra que el GoA4 de carga existe. También muestra el tamaño del sistema alrededor del tren: comunicaciones redundantes, mapa de vía mantenido, algoritmo de esfuerzo de tracción y enganche para trenes muy pesados, y un regulador que acreditó el conjunto. Copiar el folleto sin ese entorno no produce un tren autónomo.

Los metros GoA4 (varias redes urbanas en el mundo) viven en vía segregada, con puertas de andén y sin pasos a nivel. Son el caso maduro de la automatización, y el más lejano a un ramal de carga argentino.

## Qué haría falta en una red como la argentina

Un corredor de trocha ancha con carga concesionada, pasos a nivel, geometría irregular y más de un actor institucional no está en las condiciones de Pilbara ni en las del núcleo de Thameslink. Los obstáculos que esta revisión puede nombrar, sin recorrer todavía el terreno, son:

- **Pasos a nivel y obstáculos.** En GoA2 los ve el conductor. En GoA4 los tiene que ver el sistema, o la traza tiene que estar cerrada.
- **Geometría y obras de arte.** El ATO sigue un perfil de velocidad. Si la vía no tiene una velocidad autorizada confiable, el automático no tiene perfil que cumplir. Por eso el monitoreo es anterior a la conducción automática.
- **Varias trochas y varios administradores.** El equipo de a bordo y la autorización de acceso cambian con la línea. Ver la ficha del estado de la red.
- **Comunicaciones.** AutoHaul no depende de una sola radio. En un ramal hay que medir cobertura antes de prometer supervisión remota.
- **Responsable.** Alguien con matrícula y con poder de detener el tren firma la seguridad. El grado de automatización no disuelve esa firma. El reglamento argentino de operadores ya separa la inscripción de la autorización para entrar a la vía.

La fase 1 de Enrailar es monitoreo. Un vehículo de inspección que se mueve solo en un tramo corto, cerrado al tráfico, con permiso del administrador y con una persona responsable al costado, es un problema de robot sobre rieles. Un tren comercial sin conductor es otro problema, de señalamiento, de freno, de pasos a nivel y de acreditación. Conviene no usar la misma palabra para los dos.

El lanzamiento anunciado para febrero de 2027 es el primer Hackatrain. Esta ficha no le asigna un grado GoA.

## Límites

No se consultó el expediente de acreditación australiano ni el manual de Thameslink. Las cifras de flota de AutoHaul se dejan en el orden que da cada artículo, porque no coinciden entre 2019 y los partes posteriores. No se buscó un inventario de pasos a nivel del ramal a Tandil. No hay, en las fuentes de esta pasada, un proyecto argentino de ATO sobre ETCS en vía principal.

## Fuentes

Consultadas el 2026-10-09.

- Comisión Europea, preguntas sobre ERTMS: <https://transport.ec.europa.eu/transport-modes/rail/ertms/faq-ertms_en>
- ERA, principios operativos ERTMS/ATO (PDF): <https://www.era.europa.eu/sites/default/files/2024-12/index64_12e108_2_ato_operational_principles.pdf>
- Europe's Rail, capacidad y automatización: <https://rail-research.europa.eu/latest-news/increasing-railway-line-capacity-starts-with-increased-automation/>
- Vista previa IEC 62290-1 (alcance urbano): <https://assets.vde-verlag.de/iec-normen/preview-pdf/info_iec62290-1%7Bed3.0.RLV%7Den.pdf>
- *International Railway Journal*, ATO en vía principal y escala GoA: <https://www.railjournal.com/in_depth/automatic-train-control-takes-to-the-main-line/>
- Hitachi, AutoHaul (PDF): <https://www.hitachihyoron.com/rev/archive/2020/r2020_06/pdf/06a05.pdf>
- *International Railway Journal*, despliegue AutoHaul: <https://www.railjournal.com/in_depth/rise-machines-rio-tinto-autohaul/> y <https://www.railjournal.com/in_depth/autohaul-drives-efficiencies-at-rio-tinto/>
- Plan de acción de la emergencia ferroviaria (ATS metropolitano): <https://www.argentina.gob.ar/transporte/plan-de-accion-de-la-emergencia-ferroviaria>
