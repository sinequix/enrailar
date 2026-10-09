/** Entrypoint temporal. La web vinext lo reemplaza. */
export default {
  fetch(): Response {
    return new Response("enrailar web", { status: 200 });
  },
};
