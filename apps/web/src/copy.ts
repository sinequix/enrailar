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

export const ARTICLE_URL = "https://x.com/tebayoso/status/2107894676426559739";

export const POST_SLUG = "fase-1";

interface Copy {
  title: string;
  description: string;
  phase: string;
  countdownLabel: string;
  countdownNote: string;
  visionTitle: string;
  vision: string[];
  phaseTitle: string;
  phaseBody: string[];
  hackatrainTitle: string;
  hackatrain: string[];
  blogTitle: string;
  postTitle: string;
  postDeck: string;
  participate: string;
  preinscription: string;
  contact: string;
  newsletter: string;
  email: string;
  linkedin: string;
  message: string;
  intent: string;
  intents: { colaborar: string; donar: string; sumarme: string };
  send: string;
  accepted: string;
  rejected: string;
  fields: string;
  turnstileMissing: string;
  language: string;
}

export const COPY: Record<Locale, Copy> = {
  es: {
    title: "Enrailar",
    description: `Recuperar los trenes de Argentina. Fase 1: monitoreo. Hackatrain en ${HACKATRAIN_WHEN.es}.`,
    phase: "Fase 1 · monitoreo",
    countdownLabel: "Hackatrain",
    countdownNote: `El anuncio no fija un día. La referencia es ${HACKATRAIN_WHEN.es}. La cuenta regresiva aparece cuando haya una fecha.`,
    visionTitle: "Una red que se pueda volver a usar",
    vision: [
      "Enrailar es un proyecto abierto para recuperar los trenes de Argentina y, más adelante, una empresa de tecnología ferroviaria: investigación, gestión, mantenimiento y explotación de infraestructura y material rodante.",
      "En el horizonte hay robots y drones de inspección, trenes autónomos, software para coordinar la operación y energía renovable en el corredor. El primer lugar donde miramos es Tandil.",
      "La organización que imaginamos reúne técnicos, trabajadores ferroviarios, municipios, comercios y usuarios. Los presupuestos, las propuestas y el avance se publican. Quienes operan y quienes firman una decisión de seguridad siguen siendo personas identificables.",
    ],
    phaseTitle: "Primero, saber qué hay",
    phaseBody: [
      "La fase 1 es monitoreo. Un mapa vivo de estaciones, playones, vías, puentes, túneles, desvíos, pasos a nivel y señalización, con lugar, fotos, fecha, estado y qué haría falta para que vuelva a servir.",
      "Parte de ese mapa lo arma la gente de cada pueblo, con un protocolo común y revisión técnica. La otra parte la recorren prototipos: robots sobre la vía y drones en el aire, con energía solar y enlace donde el corredor no llega de otra forma.",
    ],
    hackatrainTitle: `Hackatrain, ${HACKATRAIN_WHEN.es}`,
    hackatrain: [
      "El lanzamiento público es el primer Hackatrain, un hackathon abierto de tecnología ferroviaria. Hasta entonces el trabajo visible es el mapa, un prototipo de inspección y un corredor comercial que se pueda medir.",
    ],
    blogTitle: "Bitácora",
    postTitle: "Recuperar los trenes empieza por verlos",
    postDeck: "Mapa, inspección y un corredor que funcione. El texto de origen está en X.",
    participate: "Sumate",
    preinscription: "Preinscripción",
    contact: "Contacto",
    newsletter: "Boletín",
    email: "Correo",
    linkedin: "LinkedIn",
    message: "Mensaje",
    intent: "Quiero",
    intents: {
      colaborar: "quiero colaborar",
      donar: "quiero donar",
      sumarme: "quiero sumarme",
    },
    send: "Enviar",
    accepted: "Recibimos la solicitud.",
    rejected: "No se pudo enviar. Revisá los campos.",
    fields: "Campos",
    turnstileMissing: "Falta la clave pública de Turnstile en este entorno.",
    language: "Idioma",
  },
  en: {
    title: "Enrailar",
    description: `Restoring Argentina's railways. Phase 1 is monitoring. Hackatrain is in ${HACKATRAIN_WHEN.en}.`,
    phase: "Phase 1 · monitoring",
    countdownLabel: "Hackatrain",
    countdownNote: `The announcement does not name a day. The reference is ${HACKATRAIN_WHEN.en}. The countdown appears when a date is set.`,
    visionTitle: "A network that can be used again",
    vision: [
      "Enrailar is an open project to restore Argentina's railways and, later, a railway technology company: research, management, maintenance and operation of infrastructure and rolling stock.",
      "Further out are inspection robots and drones, autonomous trains, software that coordinates the operation, and renewable power on the corridor. The first place we look is Tandil.",
      "The organization we have in mind brings together technicians, railway workers, municipalities, businesses and users. Budgets, proposals and progress are published. The people who operate, and the people who sign a safety decision, stay identifiable.",
    ],
    phaseTitle: "First, see what is there",
    phaseBody: [
      "Phase 1 is monitoring. A living map of stations, yards, track, bridges, tunnels, sidings, level crossings and signaling, with place, photos, date, condition and what it would take to be useful again.",
      "People in each town build part of that map, under a shared protocol and a technical review. Prototypes cover the rest: robots on the track and drones overhead, with solar power and a link where the corridor has no other one.",
    ],
    hackatrainTitle: `Hackatrain, ${HACKATRAIN_WHEN.en}`,
    hackatrain: [
      "The public launch is the first Hackatrain, an open hackathon for railway technology. Until then the visible work is the map, an inspection prototype and a commercial corridor we can measure.",
    ],
    blogTitle: "Log",
    postTitle: "Restoring the railways starts by seeing them",
    postDeck: "A map, an inspection, and a corridor that works. The source note is on X.",
    participate: "Join",
    preinscription: "Pre-registration",
    contact: "Contact",
    newsletter: "Newsletter",
    email: "Email",
    linkedin: "LinkedIn",
    message: "Message",
    intent: "I want to",
    intents: {
      colaborar: "collaborate",
      donar: "donate",
      sumarme: "join in",
    },
    send: "Send",
    accepted: "We received the request.",
    rejected: "Could not send. Check the fields.",
    fields: "Fields",
    turnstileMissing: "This environment has no Turnstile site key.",
    language: "Language",
  },
};
