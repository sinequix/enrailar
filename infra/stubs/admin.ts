/** Entrypoint temporal del admin, detrás de Access. */
export default {
  fetch(): Response {
    return new Response("enrailar admin", { status: 404 });
  },
};
