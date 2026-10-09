/** Entrypoint temporal. La API Express lo reemplaza. */
export default {
  fetch(): Response {
    return new Response("enrailar api", { status: 200 });
  },
};
