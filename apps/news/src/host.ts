/** Camino público. Vacío es el ápice de `noticias.enrailar.com`. */
export const NEWS_BASE_PATH = "";

export const YPF_SLUG = "ypf-arena-fractura-vaca-muerta";

export const NOTICIA_COLLECTION = "noticia";

export const LINE_OPTIONS = ["Urquiza", "Mitre", "San Martín", "Roca", "Sarmiento", "Belgrano"] as const;

export const CATEGORY_OPTIONS = ["carga", "pasajeros", "infraestructura", "política"] as const;

export type LineOption = (typeof LINE_OPTIONS)[number];

export type CategoryOption = (typeof CATEGORY_OPTIONS)[number];
