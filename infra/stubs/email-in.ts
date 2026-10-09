interface InboundEnv {
  readonly FORWARD_TO: string;
}

interface InboundMail {
  forward(destination: string): Promise<void>;
  setReject(reason: string): void;
}

/**
 * Recibe el correo de las casillas de rol y lo reenvía a FORWARD_TO.
 * El valor llega por binding. Este stub no lo persiste: el worker de
 * entrada definitivo además lo guarda en el inbox.
 */
export default {
  fetch(): Response {
    return new Response("enrailar email-in", { status: 200 });
  },
  async email(message: InboundMail, env: InboundEnv): Promise<void> {
    const destination = env.FORWARD_TO.trim();
    if (destination.length === 0) {
      message.setReject("FORWARD_TO is empty");
      return;
    }
    await message.forward(destination);
  },
};
