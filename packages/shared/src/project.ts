/** Casillas de rol del proyecto. No son correos de personas. */
export const ROLE_MAILBOXES = [
  "hola@enrailar.com",
  "hackatrain@enrailar.com",
  "prensa@enrailar.com",
] as const;

export type RoleMailbox = (typeof ROLE_MAILBOXES)[number];

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
