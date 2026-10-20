import type { CrmContact, SumateInput } from "@enrailar/shared";

/**
 * La ficha de Sumate, lista para el cliente compartido de ClickUp.
 * Título y descripción no llevan perfil, lugar, intenciones ni id: esos
 * campos van solo en el comentario. La sync no publica las listas del CRM.
 */
export function sumateCrmContact(
  input: SumateInput & { id: string; taskId?: string },
): CrmContact {
  const place = [input.city, input.region].filter((part): part is string =>
    Boolean(part)
  ).join(", ");
  const where = place.length > 0 ? place : "sin lugar";
  const link = input.link ? `\nEnlace: ${input.link}` : "";
  return {
    email: input.email,
    name: input.name,
    title: "Voluntario",
    summary: "Ficha de voluntario. El detalle está en un comentario.",
    note: [
      `Nombre: ${input.name}`,
      `Correo: ${input.email}`,
      `Lugar: ${where}`,
      `Perfil: ${input.profile}`,
      `Intenciones: ${input.intents.join(", ")}`,
      `Idioma: ${input.locale}`,
      `Ficha: ${input.id}`,
      "",
      `Cómo quiere ayudar:\n${input.howHelp}${link}`,
    ].join("\n"),
    fuente: "sumate",
    tags: ["voluntario"],
    taskId: input.taskId,
  };
}
