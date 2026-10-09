import { HACKATRAIN_WHEN } from "@enrailar/shared";
import { ARTICLE_URL, type Locale } from "./copy.ts";

export interface Post {
  slug: string;
  title: string;
  paragraphs: string[];
}

const es: Post = {
  slug: "fase-1",
  title: "Recuperar los trenes empieza por verlos",
  paragraphs: [
    `La nota pública está en ${ARTICLE_URL}. Esto es la versión de trabajo del proyecto, no una copia de ese texto.`,
    "Enrailar arranca como proyecto abierto de recuperación de los trenes de Argentina. Más adelante puede ser una empresa de tecnología ferroviaria: investigación, gestión, mantenimiento y explotación de infraestructura y material rodante, robots y drones de inspección, trenes autónomos, software de coordinación y renovables en el corredor.",
    `La fase 1 es monitoreo. El lanzamiento público es ${HACKATRAIN_WHEN.es}, con el primer Hackatrain, un hackathon abierto de tecnología ferroviaria. El anuncio no fija un día: el sitio muestra esa referencia y la cuenta regresiva solo cuando haya una fecha. El primer lugar de trabajo es Tandil.`,
    "La forma de organizarse es cooperativa: técnicos, trabajadores ferroviarios, municipios, comercios y usuarios. Presupuestos, propuestas y avances se publican con la transparencia de una DAO. La operación y las decisiones de seguridad quedan en profesionales identificables, que responden por lo que firman.",
    "El primer paso es un mapa vivo. Estaciones, intercambiadores, playones, vías, puentes, túneles, desvíos, pasos a nivel y señalización. Cada elemento con ubicación, fotografías, fecha de inspección, estado y una estimación de qué necesita para volver a funcionar o para mejorar. También quién administra el tramo, qué trocha tiene y qué demanda podría atender. Una estación histórica no es, por sí sola, una conexión que hoy se pueda usar.",
    "Parte de ese relevamiento es ciudadano: gente en cada ciudad y pueblo, protocolos comunes y revisión técnica. La otra parte se automatiza. Prototipos de robots de auditoría sobre la vía y drones para el entorno, con baterías, apoyo solar y enlace satelital donde la cobertura móvil no alcanza. Esas pruebas empiezan en recorridos cortos.",
    "Hay que poder medir geometría de vía, desgaste de rieles, durmientes y fijaciones, drenajes, vegetación y obstáculos. Fotos georreferenciadas, modelos tridimensionales y mapas de calor de defectos. Ultrasonido para fallas internas y georradar para el balasto y las capas de abajo. Decir dos mil sensores nombra la ambición. El prototipo empieza por los sensores que detectan problemas concretos y se pueden contrastar con una inspección profesional.",
    "Para estudiar hay sistemas de inspección como los de ENSCO, medición como servicio al estilo de Plasser & Theurer, y relevamiento aéreo LiDAR como el de DJI Enterprise. La idea es combinar eso con ingeniería, fabricación y mantenimiento hechos en Argentina.",
    "Con esos datos se priorizan reparaciones y se estima qué formación admite cada corredor. La velocidad y la carga también dependen de puentes, carga por eje, frenado, señalización y material rodante. El mapa tiene que servir para decidir con evidencia.",
    "El primer producto comercial es una auditoría ferroviaria y un seguimiento del mantenimiento como servicio, en Argentina y en el resto de América Latina. Cada intervención queda escrita: el defecto, la obra y la capacidad que se recupera.",
    "Mientras el mapa crece, la operación comercial empieza en un corredor concreto. Un operador de última milla apoyado en el ferrocarril: depósitos regionales y estaciones usadas como centros chicos de logística. El primer mercado es la paquetería. Trenes con módulos y casilleros, retiro con un código, y repartidores locales que completan la entrega. Módulos que se cambian para que el tren no tenga que esperar en el andén. Quadient y ScotRail sirven de referencia para casilleros en estaciones; el piloto igual tiene que demostrar que conviene mover esos paquetes por tren.",
    "Los escenarios de corredor, para estudiar y no como promesa, van por tonelaje y velocidad: 10 a 50 toneladas a 30–60 km/h para paquetería y repuestos; 100 a 300 toneladas a 40–70 km/h para pallets y abastecimiento; 500 a 1.500 toneladas a 40–80 km/h para contenedores; 3.000 a 6.000 toneladas a 40–80 km/h para cargas pesadas donde la infraestructura ya aguante. La paquetería es la puerta de entrada.",
    "También hay una pregunta regional: estudiar una conexión trasandina hacia Chile, el trazado histórico y las alternativas, pendientes, túneles, trochas, clima, aduanas, demanda y financiamiento. Eso pide un estudio propio y coordinación de los dos países.",
    "El comienzo es concreto: un mapa que se pueda verificar, un prototipo de inspección y un corredor comercial que funcione. Publicar los resultados, volver a invertirlos en mantenimiento y repetir.",
  ],
};

const en: Post = {
  slug: "fase-1",
  title: "Restoring the railways starts by seeing them",
  paragraphs: [
    `The public note is at ${ARTICLE_URL}. This is the working version of the project, not a copy of that text.`,
    "Enrailar starts as an open project to restore Argentina's railways. Later it can be a railway technology company: research, management, maintenance and operation of infrastructure and rolling stock, inspection robots and drones, autonomous trains, coordination software and renewables on the corridor.",
    `Phase 1 is monitoring. The public launch is ${HACKATRAIN_WHEN.en}, with the first Hackatrain, an open hackathon for railway technology. The announcement does not name a day: the site shows that reference, and the countdown only when a date is set. The first place we look is Tandil.`,
    "The organization is cooperative: technicians, railway workers, municipalities, businesses and users. Budgets, proposals and progress are published with the transparency of a DAO. Operation and safety decisions stay with identifiable professionals who answer for what they sign.",
    "The first step is a living map. Stations, interchanges, yards, track, bridges, tunnels, sidings, level crossings and signaling. Each item with a place, photographs, an inspection date, a condition and an estimate of what it needs in order to work or to improve. Also who runs the section, what gauge it is and what demand it could serve. A historic station is not, by itself, a connection that can be used today.",
    "Part of the survey is civic: people in each city and town, shared protocols and technical review. The other part is automated. Prototype audit robots on the track and drones for the surroundings, with batteries, solar support and a satellite link where mobile coverage does not reach. Those trials start on short runs.",
    "We need to measure track geometry, rail wear, sleepers and fastenings, drainage, vegetation and obstacles. Georeferenced photos, three-dimensional models and heat maps of defects. Ultrasound for internal flaws and ground-penetrating radar for the ballast and the layers under it. Two thousand sensors names the ambition. The prototype starts with the sensors that catch concrete problems and can be checked against a professional inspection.",
    "Worth studying: inspection systems such as ENSCO's, measurement as a service in the manner of Plasser & Theurer, and aerial LiDAR surveying such as DJI Enterprise. The aim is to combine that with engineering, fabrication and maintenance done in Argentina.",
    "Those data rank repairs and estimate what consist a corridor can take. Speed and load also depend on bridges, axle load, braking, signaling and rolling stock. The map has to support decisions that can be checked.",
    "The first commercial product is a railway audit and maintenance tracking as a service, in Argentina and across Latin America. Each intervention is written down: the defect, the work and the capacity that comes back.",
    "While the map grows, commercial operation starts on one corridor. A last-mile operator leaning on the railway: regional depots and stations used as small logistics rooms. The first market is parcels. Trains with modules and lockers, pickup with a code, and local couriers who finish the delivery. Modules that swap so the train does not have to wait on the platform. Quadient and ScotRail are the reference for lockers in stations; the pilot still has to show that moving those parcels by train is worth it.",
    "Corridor scenarios, for study and not as a promise, are stated as tonnage and speed: 10 to 50 tonnes at 30–60 km/h for parcels and parts; 100 to 300 tonnes at 40–70 km/h for pallets and supply; 500 to 1,500 tonnes at 40–80 km/h for containers; 3,000 to 6,000 tonnes at 40–80 km/h for heavy goods where the infrastructure can already carry them. Parcels are the way in.",
    "There is also a regional question: study a trans-Andean connection toward Chile, the historic alignment and the alternatives, grades, tunnels, gauges, weather, customs, demand and financing. That needs its own study and coordination between the two countries.",
    "The start is concrete: a map that can be checked, an inspection prototype and a commercial corridor that works. Publish the results, put them back into maintenance and repeat.",
  ],
};

export const POSTS: Record<Locale, Post> = { es, en };
