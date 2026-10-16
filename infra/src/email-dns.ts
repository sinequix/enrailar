import { PUBLIC_CONTACT } from "@enrailar/shared";

/**
 * MX de Email Routing ya publicados en enrailar.com.
 * La prioridad tiene que coincidir con la zona: si no, Alchemy no adopta
 * el registro que ya existe y crea un hermano.
 */
export const ROUTING_MX = [
  { id: "MxRoute1", host: "route1.mx.cloudflare.net", priority: 97 },
  { id: "MxRoute2", host: "route2.mx.cloudflare.net", priority: 98 },
  { id: "MxRoute3", host: "route3.mx.cloudflare.net", priority: 77 },
] as const;

/** Un solo SPF en el ápice. Email Sending no suma otro: el suyo va en cf-bounce. */
export const APEX_SPF = "v=spf1 include:_spf.mx.cloudflare.net ~all";

export const DMARC = `v=DMARC1; p=none; rua=mailto:${PUBLIC_CONTACT}`;

/**
 * DKIM no se declara. La clave la escribe el onboarding y el registro queda
 * bloqueado. El selector de Routing ya está en la zona; el de Sending aparece
 * al onboarded Email Sending.
 */
export const DKIM_PLACEHOLDER = {
  routingName: "cf2024-1._domainkey",
  sendingName: "cf-bounce._domainkey",
  content: "",
} as const;

/**
 * Registros de Email Sending. No se crean acá: los agrega el onboarding
 * y quedan bloqueados en el subdominio cf-bounce.
 */
export const SENDING_PLACEHOLDER = {
  host: "cf-bounce",
  mx: [
    "route1.mx.cloudflare.net",
    "route2.mx.cloudflare.net",
    "route3.mx.cloudflare.net",
  ],
  spf: "v=spf1 include:_spf.mx.cloudflare.net ~all",
  dkimName: "cf-bounce._domainkey",
} as const;
