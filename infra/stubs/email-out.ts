/** Entrypoint temporal. El worker de salida lo reemplaza. */
export default {
  fetch(): Response {
    return new Response("enrailar email-out", { status: 200 });
  },
  queue(): void {
    // El consumidor real manda el correo y no escribe direcciones en los logs.
  },
};
