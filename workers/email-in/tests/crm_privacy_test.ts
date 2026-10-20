import { assert, assertEquals } from "@std/assert";
import { contactTaskCopy } from "../src/crm.ts";

Deno.test("hola@ no pone remitente, asunto ni cuerpo en el título ni en la descripción", () => {
  const copy = contactTaskCopy({
    sender: "ada@example.com",
    subject: "Quiero sumarme desde CiudadSecreta",
    body: "Perfil y cómo ayudar.",
    messageId: "mensaje-1",
  });
  assertEquals(copy.title, "Contacto por correo");
  assertEquals(copy.summary, "Mensaje recibido por correo.");
  const published = `${copy.title}\n${copy.summary}`;
  for (
    const secret of [
      "ada@example.com",
      "CiudadSecreta",
      "Perfil y cómo ayudar.",
    ]
  ) {
    assertEquals(published.includes(secret), false);
    assert(copy.note.includes(secret));
  }
});
