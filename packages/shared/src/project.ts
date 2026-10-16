/** Casillas de rol del proyecto. No son correos de personas. */
export const ROLE_MAILBOXES = [
  "hola@enrailar.com",
  "hackatrain@enrailar.com",
  "prensa@enrailar.com",
] as const;

export type RoleMailbox = (typeof ROLE_MAILBOXES)[number];

/** Casilla pública. Es la primera de las de rol. */
export const PUBLIC_CONTACT: RoleMailbox = "hola@enrailar.com";

/**
 * Remitente de los correos de cuenta. No es una casilla de entrada:
 * el catch-all de Routing descarta lo que llega ahí.
 */
export const TRANSACTIONAL_FROM = "no-responder@enrailar.com";

/** Vida de los enlaces de verificación y de recuperación, en segundos. */
export const AUTH_LINK_TTL_SECONDS = 60 * 60;

/**
 * Referencia del Hackatrain mientras no haya un día.
 * Cambiar este objeto es el único lugar donde vive el mes.
 */
export const HACKATRAIN_WHEN = {
  es: "Febrero 2027",
  en: "February 2027",
} as const;

/**
 * Día de inicio, ISO 8601 con offset, o null si todavía no hay día.
 * La cuenta regresiva se renderiza solo cuando este valor es un string.
 */
export const HACKATRAIN_START: string | null = null;
