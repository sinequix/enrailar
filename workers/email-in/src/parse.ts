import PostalMime from "postal-mime";
import type { InboundContact } from "./contact.ts";

export const BODY_CAP = 8_000;
export const SUBJECT_CAP = 300;
const HTML_CAP = 100_000;

export async function readContact(raw: Uint8Array, envelopeFrom: string): Promise<InboundContact> {
  let sender = envelopeFrom.trim().toLowerCase();
  let subject = "";
  let body = "";
  let messageId = "";
  try {
    const parsed = await new PostalMime().parse(raw);
    const address = parsed.from?.address?.trim().toLowerCase();
    if (address) sender = address;
    subject = (parsed.subject ?? "").replace(/\s+/g, " ").trim().slice(0, SUBJECT_CAP);
    body = bodyFrom(parsed.text, parsed.html);
    messageId = (parsed.messageId ?? "").trim().toLowerCase();
  } catch {
    // El inbox ya guardó el raw. El sobre alcanza para marcar el reintento.
  }
  if (messageId.length === 0 || messageId.length > 500) messageId = await sha256(raw);
  return { sender, subject, body, messageId };
}

function bodyFrom(text: string | undefined, html: string | undefined): string {
  const plain = (text ?? "").trim();
  if (plain.length > 0) return plain.slice(0, BODY_CAP);
  return htmlToText((html ?? "").slice(0, HTML_CAP)).slice(0, BODY_CAP);
}

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&apos;": "'",
  "&#39;": "'",
};

function htmlToText(html: string): string {
  const withoutBlocks = stripElement(stripElement(html, "script"), "style");
  const text = withoutBlocks.replace(/<[^>]*>/g, " ");
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

function stripElement(html: string, tag: string): string {
  const lower = html.toLowerCase();
  const open = `<${tag}`;
  const close = `</${tag}`;
  let out = "";
  let index = 0;
  while (index < html.length) {
    const start = findTag(lower, open, index);
    if (start < 0) {
      out += html.slice(index);
      break;
    }
    const openEnd = html.indexOf(">", start);
    if (openEnd < 0) {
      out += html.slice(index);
      break;
    }
    out += `${html.slice(index, start)} `;
    const end = findTag(lower, close, openEnd + 1);
    if (end < 0) {
      index = openEnd + 1;
      continue;
    }
    const closeEnd = html.indexOf(">", end);
    index = closeEnd < 0 ? html.length : closeEnd + 1;
  }
  return out;
}

function findTag(lower: string, prefix: string, from: number): number {
  let index = from;
  while (index < lower.length) {
    const found = lower.indexOf(prefix, index);
    if (found < 0) return -1;
    const next = lower[found + prefix.length];
    if (next === undefined || next === ">" || /\s/.test(next)) return found;
    index = found + prefix.length;
  }
  return -1;
}

function decodeEntities(value: string): string {
  return value.replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/gi, (entity) => {
    return ENTITIES[entity.toLowerCase()] ?? entity;
  });
}

async function sha256(raw: Uint8Array): Promise<string> {
  const copy = new ArrayBuffer(raw.byteLength);
  new Uint8Array(copy).set(raw);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
