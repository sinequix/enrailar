import { assert, assertEquals } from "@std/assert";
import { sumateSchema } from "@enrailar/shared";
import { sumateCrmContact } from "../src/sumate-crm.ts";

Deno.test("Sumate no pone la ficha en el título ni en la descripción", () => {
  const parsed = sumateSchema.parse({
    intents: ["hackatrain"],
    email: "ada@example.com",
    name: "Ada Ejemplo",
    city: "CiudadSecreta",
    region: "",
    profile: "ingenieria",
    howHelp: "Quiero relevar vías.",
    link: "",
    message: "",
    locale: "es",
    consent: true,
    turnstileToken: "token-ok",
    company_url: "",
  });
  const contact = sumateCrmContact({ ...parsed, id: "ficha-secreta" });
  const published = `${contact.title}\n${contact.summary}`;
  for (
    const secret of [
      "ada@example.com",
      "Ada Ejemplo",
      "CiudadSecreta",
      "ingenieria",
      "ficha-secreta",
    ]
  ) {
    assertEquals(published.includes(secret), false);
    assert(contact.note.includes(secret));
  }
  assertEquals(contact.fuente, "sumate");
  assertEquals(contact.tags, ["voluntario"]);
});
