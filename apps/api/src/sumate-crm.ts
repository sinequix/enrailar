import type { CrmContact, SumateInput } from "@enrailar/shared";

/** La ficha de Sumate, lista para el cliente compartido de ClickUp. */
export function sumateCrmContact(input: SumateInput & { id: string; taskId?: string }): CrmContact {
  const place = [input.city, input.region].filter((part): part is string => Boolean(part)).join(", ");
  const where = place.length > 0 ? place : "sin lugar";
  const link = input.link ? `\nEnlace: ${input.link}` : "";
  return {
    email: input.email,
    name: input.name,
    title: `Voluntario · ${where}`,
    summary: [
      `Perfil: ${input.profile}`,
      `Lugar: ${where}`,
      `Intenciones: ${input.intents.join(", ")}`,
      `Idioma: ${input.locale}`,
      `Ficha: ${input.id}`,
      "",
      "El nombre, el correo y cómo quiere ayudar están en un comentario de esta tarea.",
    ].join("\n"),
    note: `Nombre: ${input.name}\nCorreo: ${input.email}\nCómo quiere ayudar:\n${input.howHelp}${link}`,
    fuente: "sumate",
    tags: ["voluntario"],
    taskId: input.taskId,
  };
}
