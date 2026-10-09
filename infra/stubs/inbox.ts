/** Entrypoint temporal. El inbox lo reemplaza. */
export default {
  fetch(): Response {
    return new Response("enrailar inbox", { status: 404 });
  },
};
