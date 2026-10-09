import { HACKATRAIN_WHEN } from "@enrailar/shared";

export const LOCALES = ["es", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  switch (value) {
    case "es":
    case "en":
      return true;
    default:
      return false;
  }
}

export const SITE_URL = "https://enrailar.com";

export const REPO_URL = "https://github.com/sinequix/enrailar";

export const ARTICLE_URL = "https://x.com/tebayoso/status/2107894676426559739";

export const POST_SLUG = "fase-1";

/** Imagen OG compartida. Cada página la repite porque `openGraph` no se fusiona con el del layout. */
export const OG_IMAGE = { url: `${SITE_URL}/brand/og.png`, width: 1200, height: 630, alt: "Enrailar" } as const;

export const SYNTHETIC_IMAGE = {
  es: "Imagen sintética ilustrativa",
  en: "Illustrative synthetic image",
} as const;

export interface Station {
  title: string;
  when: string;
  body: string;
}

export interface Card {
  title: string;
  body: string;
}

interface Copy {
  title: string;
  description: string;
  tagline: string;
  skip: string;
  nav: { vision: string; phase: string; next: string; hackatrain: string; join: string; blog: string };
  phase: string;
  heroEyebrow: string;
  heroLede: string;
  ctaJoin: string;
  ctaBlog: string;
  heroFacts: Array<{ label: string; value: string }>;
  captionHero: string;
  captionRobot: string;
  captionStation: string;
  countdownLabel: string;
  countdownNote: string;
  visionEyebrow: string;
  visionHeading: string;
  visionTitle: string;
  vision: string[];
  principles: Card[];
  phaseEyebrow: string;
  phaseTitle: string;
  phaseBody: string[];
  phaseCards: Card[];
  nextEyebrow: string;
  nextTitle: string;
  nextLede: string;
  stations: Station[];
  hackatrainEyebrow: string;
  hackatrainTitle: string;
  hackatrain: string[];
  hackatrainPoints: string[];
  hackatrainCta: string;
  blogTitle: string;
  blogDeck: string;
  postTitle: string;
  postDeck: string;
  postSource: string;
  participate: string;
  joinLede: string;
  preinscription: string;
  contact: string;
  newsletter: string;
  formHints: { preinscripcion: string; contacto: string; newsletter: string };
  email: string;
  linkedin: string;
  message: string;
  intent: string;
  intents: { colaborar: string; donar: string; sumarme: string };
  send: string;
  sending: string;
  accepted: string;
  rejected: string;
  fields: string;
  turnstileMissing: string;
  turnstileLoading: string;
  language: string;
  footer: { about: string; mailboxes: string; project: string; code: string; license: string };
}

export const COPY: Record<Locale, Copy> = {
  es: {
    title: "Enrailar · Recuperar los trenes de Argentina",
    description: `Recuperar los trenes de Argentina. Fase 1: monitoreo. Hackatrain en ${HACKATRAIN_WHEN.es}.`,
    tagline: "Primero ver, después mover.",
    skip: "Ir al contenido",
    nav: { vision: "Visión", phase: "Fase 1", next: "Qué viene", hackatrain: "Hackatrain", join: "Sumate", blog: "Bitácora" },
    phase: "Fase 1 · monitoreo",
    heroEyebrow: "Proyecto abierto · Fase 1: monitoreo",
    heroLede:
      "Enrailar es un proyecto abierto para recuperar los trenes de Argentina. Empieza por saber qué hay: un mapa vivo de la red, gente en el terreno y prototipos de inspección. El primer lugar donde miramos es Tandil.",
    ctaJoin: "Sumate al proyecto",
    ctaBlog: "Leer la bitácora",
    heroFacts: [
      { label: "Fase actual", value: "Monitoreo" },
      { label: "Primer corredor", value: "Tandil" },
      { label: "Lanzamiento", value: `Hackatrain, ${HACKATRAIN_WHEN.es}` },
      { label: "Código", value: "Apache-2.0" },
    ],
    captionHero: "Vía en la pampa",
    captionRobot: "Prototipo de inspección",
    captionStation: "Estación con casilleros",
    countdownLabel: "Hackatrain",
    countdownNote: `El anuncio no fija un día. La referencia es ${HACKATRAIN_WHEN.es}. La cuenta regresiva aparece cuando haya una fecha.`,
    visionEyebrow: "Visión",
    visionHeading: "Trenes que vuelvan a servir",
    visionTitle: "Una red que se pueda volver a usar",
    vision: [
      "Enrailar es un proyecto abierto para recuperar los trenes de Argentina y, más adelante, una empresa de tecnología ferroviaria: investigación, gestión, mantenimiento y explotación de infraestructura y material rodante.",
      "En el horizonte hay robots y drones de inspección, trenes autónomos, software para coordinar la operación y energía renovable en el corredor. El primer lugar donde miramos es Tandil.",
      "La organización que imaginamos reúne técnicos, trabajadores ferroviarios, municipios, comercios y usuarios. Los presupuestos, las propuestas y el avance se publican. Quienes operan y quienes firman una decisión de seguridad siguen siendo personas identificables.",
    ],
    principles: [
      { title: "Abierto", body: "Código, datos y protocolos públicos, con licencia Apache-2.0." },
      { title: "Cooperativo", body: "Técnicos, ferroviarios, municipios, comercios y usuarios en la misma mesa." },
      { title: "Transparente", body: "Presupuestos, propuestas y avances se publican a medida que existen." },
      { title: "Responsable", body: "Quien opera y quien firma una decisión de seguridad es una persona identificable." },
    ],
    phaseEyebrow: "Fase 1 · monitoreo",
    phaseTitle: "Primero, saber qué hay",
    phaseBody: [
      "La fase 1 es monitoreo. Un mapa vivo de estaciones, playones, vías, puentes, túneles, desvíos, pasos a nivel y señalización, con lugar, fotos, fecha, estado y qué haría falta para que vuelva a servir.",
      "Parte de ese mapa lo arma la gente de cada pueblo, con un protocolo común y revisión técnica. La otra parte la recorren prototipos: robots sobre la vía y drones en el aire, con energía solar y enlace donde el corredor no llega de otra forma.",
    ],
    phaseCards: [
      {
        title: "Mapa vivo",
        body:
          "Cada elemento de la red con ubicación, fotos, fecha de inspección, estado y una estimación de qué necesita para volver a funcionar. También quién administra el tramo y qué trocha tiene.",
      },
      {
        title: "Gente en el terreno",
        body:
          "Vecinos de cada ciudad y pueblo relevan con un protocolo común. Cada registro pasa por revisión técnica antes de entrar al mapa.",
      },
      {
        title: "Robots y drones",
        body:
          "Prototipos sobre la vía y en el aire, con baterías, apoyo solar y enlace satelital donde no llega la cobertura. Empiezan en recorridos cortos y se contrastan con una inspección profesional.",
      },
    ],
    nextEyebrow: "Después del mapa",
    nextTitle: "Qué viene",
    nextLede: "Una línea, no una promesa. Cada estación se abre cuando la anterior se puede medir.",
    stations: [
      {
        title: "Inspección como servicio",
        when: "Primer producto",
        body: "Auditoría de vía y seguimiento del mantenimiento, en Argentina y América Latina. Cada intervención queda escrita: el defecto, la obra y la capacidad que se recupera.",
      },
      {
        title: "Última milla por estaciones",
        when: "Primer corredor",
        body: "Depósitos regionales y estaciones usadas como centros chicos de logística. El primer mercado es la paquetería, con repartidores locales que completan la entrega.",
      },
      {
        title: "Trenes taquilla",
        when: "Piloto",
        body: "Formaciones con módulos y casilleros. Retiro con un código y módulos que se cambian en el andén para que el tren no tenga que esperar.",
      },
      {
        title: "Escenarios de carga",
        when: "Estudio",
        body: "Por tonelaje y velocidad: de paquetería y repuestos a contenedores y carga pesada, donde la infraestructura ya aguante. Para estudiar, no para prometer.",
      },
      {
        title: "Conexión con Chile",
        when: "Estudio regional",
        body: "Una conexión trasandina pide estudio propio: trazado histórico y alternativas, pendientes, túneles, trochas, clima, aduanas, demanda y financiamiento.",
      },
    ],
    hackatrainEyebrow: "Lanzamiento público",
    hackatrainTitle: `Hackatrain, ${HACKATRAIN_WHEN.es}`,
    hackatrain: [
      "El lanzamiento público es el primer Hackatrain, un hackathon abierto de tecnología ferroviaria. Hasta entonces el trabajo visible es el mapa, un prototipo de inspección y un corredor comercial que se pueda medir.",
    ],
    hackatrainPoints: [
      "Abierto: software, hardware, operación y relevamiento.",
      "Equipos mixtos, con gente del ferrocarril en la mesa.",
      "Lo que se construye se publica con el resto del proyecto.",
    ],
    hackatrainCta: "Preinscribirme",
    blogTitle: "Bitácora",
    blogDeck: "Notas de trabajo del proyecto. Lo que se decide, lo que se mide y lo que todavía no se sabe.",
    postTitle: "Recuperar los trenes empieza por verlos",
    postDeck: "Mapa, inspección y un corredor que funcione. El texto de origen está en X.",
    postSource: "Texto de origen",
    participate: "Sumate",
    joinLede: "Tres formas de entrar. Todas las lee una persona del proyecto.",
    preinscription: "Preinscripción",
    contact: "Contacto",
    newsletter: "Boletín",
    formHints: {
      preinscripcion: "Para el Hackatrain y para el relevamiento en tu ciudad.",
      contacto: "Para colaborar, donar o sumarte al equipo.",
      newsletter: "Novedades del proyecto, sin frecuencia fija.",
    },
    email: "Correo",
    linkedin: "LinkedIn (opcional)",
    message: "Mensaje",
    intent: "Quiero",
    intents: {
      colaborar: "colaborar",
      donar: "donar",
      sumarme: "sumarme al equipo",
    },
    send: "Enviar",
    sending: "Enviando…",
    accepted: "Recibimos la solicitud.",
    rejected: "No se pudo enviar. Revisá los campos.",
    fields: "Campos",
    turnstileMissing: "Falta la clave pública de Turnstile en este entorno.",
    turnstileLoading: "Cargando la verificación…",
    language: "Idioma",
    footer: {
      about: "Enrailar es una iniciativa de Sinequix para recuperar los trenes de Argentina. Proyecto abierto, con código Apache-2.0.",
      mailboxes: "Casillas",
      project: "Proyecto",
      code: "Código en GitHub",
      license: "Licencia Apache-2.0",
    },
  },
  en: {
    title: "Enrailar · Restoring Argentina's railways",
    description: `Restoring Argentina's railways. Phase 1 is monitoring. Hackatrain is in ${HACKATRAIN_WHEN.en}.`,
    tagline: "See first, then move.",
    skip: "Skip to content",
    nav: { vision: "Vision", phase: "Phase 1", next: "What's next", hackatrain: "Hackatrain", join: "Join", blog: "Log" },
    phase: "Phase 1 · monitoring",
    heroEyebrow: "Open project · Phase 1: monitoring",
    heroLede:
      "Enrailar is an open project to restore Argentina's railways. It starts by knowing what is there: a living map of the network, people on the ground and inspection prototypes. The first place we look is Tandil.",
    ctaJoin: "Join the project",
    ctaBlog: "Read the log",
    heroFacts: [
      { label: "Current phase", value: "Monitoring" },
      { label: "First corridor", value: "Tandil" },
      { label: "Launch", value: `Hackatrain, ${HACKATRAIN_WHEN.en}` },
      { label: "Code", value: "Apache-2.0" },
    ],
    captionHero: "Track across the pampa",
    captionRobot: "Inspection prototype",
    captionStation: "Station with lockers",
    countdownLabel: "Hackatrain",
    countdownNote: `The announcement does not name a day. The reference is ${HACKATRAIN_WHEN.en}. The countdown appears when a date is set.`,
    visionEyebrow: "Vision",
    visionHeading: "Trains that serve again",
    visionTitle: "A network that can be used again",
    vision: [
      "Enrailar is an open project to restore Argentina's railways and, later, a railway technology company: research, management, maintenance and operation of infrastructure and rolling stock.",
      "Further out are inspection robots and drones, autonomous trains, software that coordinates the operation, and renewable power on the corridor. The first place we look is Tandil.",
      "The organization we have in mind brings together technicians, railway workers, municipalities, businesses and users. Budgets, proposals and progress are published. The people who operate, and the people who sign a safety decision, stay identifiable.",
    ],
    principles: [
      { title: "Open", body: "Public code, data and protocols, under the Apache-2.0 license." },
      { title: "Cooperative", body: "Technicians, railway workers, municipalities, businesses and users at the same table." },
      { title: "Transparent", body: "Budgets, proposals and progress are published as they exist." },
      { title: "Accountable", body: "Whoever operates, and whoever signs a safety decision, is an identifiable person." },
    ],
    phaseEyebrow: "Phase 1 · monitoring",
    phaseTitle: "First, see what is there",
    phaseBody: [
      "Phase 1 is monitoring. A living map of stations, yards, track, bridges, tunnels, sidings, level crossings and signaling, with place, photos, date, condition and what it would take to be useful again.",
      "People in each town build part of that map, under a shared protocol and a technical review. Prototypes cover the rest: robots on the track and drones overhead, with solar power and a link where the corridor has no other one.",
    ],
    phaseCards: [
      {
        title: "Living map",
        body:
          "Every element of the network with a place, photos, inspection date, condition and an estimate of what it needs to work again. Also who runs the section and what gauge it is.",
      },
      {
        title: "People on the ground",
        body:
          "Residents of each city and town survey under a shared protocol. Every record goes through technical review before it enters the map.",
      },
      {
        title: "Robots and drones",
        body:
          "Prototypes on the track and in the air, with batteries, solar support and a satellite link where there is no coverage. They start on short runs and are checked against a professional inspection.",
      },
    ],
    nextEyebrow: "After the map",
    nextTitle: "What's next",
    nextLede: "A line, not a promise. Each station opens when the previous one can be measured.",
    stations: [
      {
        title: "Inspection as a service",
        when: "First product",
        body: "Track audits and maintenance tracking, in Argentina and across Latin America. Each intervention is written down: the defect, the work and the capacity that comes back.",
      },
      {
        title: "Last mile through stations",
        when: "First corridor",
        body: "Regional depots and stations used as small logistics rooms. The first market is parcels, with local couriers finishing the delivery.",
      },
      {
        title: "Locker trains",
        when: "Pilot",
        body: "Consists with modules and lockers. Pickup with a code, and modules that swap on the platform so the train does not have to wait.",
      },
      {
        title: "Freight scenarios",
        when: "Study",
        body: "By tonnage and speed: from parcels and parts to containers and heavy goods, where the infrastructure can already carry them. For study, not as a promise.",
      },
      {
        title: "Connection with Chile",
        when: "Regional study",
        body: "A trans-Andean connection needs its own study: the historic alignment and alternatives, grades, tunnels, gauges, weather, customs, demand and financing.",
      },
    ],
    hackatrainEyebrow: "Public launch",
    hackatrainTitle: `Hackatrain, ${HACKATRAIN_WHEN.en}`,
    hackatrain: [
      "The public launch is the first Hackatrain, an open hackathon for railway technology. Until then the visible work is the map, an inspection prototype and a commercial corridor we can measure.",
    ],
    hackatrainPoints: [
      "Open: software, hardware, operations and field survey.",
      "Mixed teams, with railway people at the table.",
      "What gets built is published with the rest of the project.",
    ],
    hackatrainCta: "Pre-register",
    blogTitle: "Log",
    blogDeck: "Working notes from the project. What gets decided, what gets measured, and what is still unknown.",
    postTitle: "Restoring the railways starts by seeing them",
    postDeck: "A map, an inspection, and a corridor that works. The source note is on X.",
    postSource: "Source note",
    participate: "Join",
    joinLede: "Three ways in. A person from the project reads all of them.",
    preinscription: "Pre-registration",
    contact: "Contact",
    newsletter: "Newsletter",
    formHints: {
      preinscripcion: "For the Hackatrain and for the survey in your city.",
      contacto: "To collaborate, donate or join the team.",
      newsletter: "Project news, no fixed schedule.",
    },
    email: "Email",
    linkedin: "LinkedIn (optional)",
    message: "Message",
    intent: "I want to",
    intents: {
      colaborar: "collaborate",
      donar: "donate",
      sumarme: "join the team",
    },
    send: "Send",
    sending: "Sending…",
    accepted: "We received the request.",
    rejected: "Could not send. Check the fields.",
    fields: "Fields",
    turnstileMissing: "This environment has no Turnstile site key.",
    turnstileLoading: "Loading verification…",
    language: "Language",
    footer: {
      about: "Enrailar is a Sinequix initiative to restore Argentina's railways. An open project, with Apache-2.0 code.",
      mailboxes: "Mailboxes",
      project: "Project",
      code: "Code on GitHub",
      license: "Apache-2.0 license",
    },
  },
};
