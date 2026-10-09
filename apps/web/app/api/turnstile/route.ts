import { turnstileSiteKeyFromProcess } from "../../../src/turnstile.ts";

/** Siempre dinámico: la clave sale del binding del Worker en cada request, no del build. */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { siteKey: turnstileSiteKeyFromProcess() },
    { headers: { "cache-control": "no-store" } },
  );
}
