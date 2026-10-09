/** Casillas de rol del proyecto. No son correos de personas. */
export const ROLE_MAILBOXES = [
  "hola@enrailar.com",
  "hackatrain@enrailar.com",
  "prensa@enrailar.com",
] as const;

export type RoleMailbox = (typeof ROLE_MAILBOXES)[number];

/**
 * El anuncio del Hackatrain no fija un día dentro de febrero 2027.
 * La cuenta regresiva usa el primer día de ese mes, hora de Argentina.
 */
export const HACKATRAIN_START = "2027-02-01T00:00:00-03:00";

export const HACKATRAIN_START_DATE = new Date(HACKATRAIN_START);
