import { getEmDashCollection, getEmDashEntry } from "emdash";
import { NOTICIA_COLLECTION, YPF_SLUG } from "../host.ts";

export const NOTICIA = NOTICIA_COLLECTION;

export interface Noticia {
  slug: string;
  title: string;
  summary: string;
  body: unknown;
  sourceName: string;
  sourceUrl: string;
  originalPostUrl?: string;
  via?: string;
  lines: string[];
  category: string;
  locale: string;
  publishedAt?: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function field(data: Record<string, unknown>, key: string): unknown {
  return data[key];
}

export function readNoticia(slug: string, data: Record<string, unknown>): Noticia {
  const original = text(field(data, "original_post_url"));
  const via = text(field(data, "via"));
  const published = field(data, "publishedAt") ?? field(data, "published_at");
  const publishedAt = published instanceof Date
    ? published.toISOString()
    : typeof published === "string"
      ? published
      : undefined;
  const lines = field(data, "lines");
  return {
    slug,
    title: text(field(data, "title")),
    summary: text(field(data, "summary")),
    body: field(data, "body"),
    sourceName: text(field(data, "source_name")),
    sourceUrl: text(field(data, "source_url")),
    ...(original.length > 0 ? { originalPostUrl: original } : {}),
    ...(via.length > 0 ? { via } : {}),
    lines: Array.isArray(lines) ? lines.filter((item): item is string => typeof item === "string") : [],
    category: text(field(data, "category")),
    locale: text(field(data, "locale")) || "es",
    ...(publishedAt !== undefined ? { publishedAt } : {}),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export async function listNoticias(): Promise<{ items: Noticia[]; error: boolean }> {
  const result = await getEmDashCollection(NOTICIA, {
    locale: "es",
    orderBy: { published_at: "desc" },
  });
  if (result.error) return { items: [], error: true };
  return {
    items: result.entries.map((entry) => readNoticia(entry.id, asRecord(entry.data))),
    error: false,
  };
}

export async function loadNoticia(slug: string): Promise<{ item?: Noticia; error: boolean }> {
  const result = await getEmDashEntry(NOTICIA, slug, { locale: "es" });
  if (result.error) return { error: true };
  if (!result.entry) return { error: false };
  return { item: readNoticia(result.entry.id, asRecord(result.entry.data)), error: false };
}

export const FIRST_SLUG = YPF_SLUG;
