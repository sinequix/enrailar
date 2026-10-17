/** Junta el `base` de Astro con un slug. `base` puede ser `/` o `/noticias/`. */
export function withBase(base: string, slug?: string): string {
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  if (slug === undefined || slug.length === 0) return prefix.length === 0 ? "/" : prefix;
  return `${prefix}/${slug}`;
}

/** Solo https. http, javascript y cualquier otro esquema no se vuelven un enlace. */
export function publicHttpUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return url.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

export function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.length > 0) items.push(item);
  }
  return items;
}

/** Texto plano de un cuerpo Portable Text. Astro escapa el string al renderizar. */
export function portableTextParagraphs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const paragraphs: string[] = [];
  for (const block of value) {
    if (block === null || typeof block !== "object") continue;
    const children = "children" in block ? block.children : undefined;
    if (!Array.isArray(children)) continue;
    let text = "";
    for (const child of children) {
      if (child === null || typeof child !== "object" || !("text" in child)) continue;
      if (typeof child.text === "string") text += child.text;
    }
    const trimmed = text.trim();
    if (trimmed.length > 0) paragraphs.push(trimmed);
  }
  return paragraphs;
}

export function formatPublished(value: unknown): string {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : undefined;
  if (date === undefined || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}
