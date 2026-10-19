import type { APIRoute } from "astro";

export const prerender = false;

/** `/_emdash` exacto no es una nota. El admin vive en `/_emdash/admin`. */
export const ALL: APIRoute = () => {
  return new Response(null, {
    status: 302,
    headers: {
      location: "/_emdash/admin",
      "cache-control": "no-store",
    },
  });
};
