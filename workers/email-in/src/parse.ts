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

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

async function sha256(raw: Uint8Array): Promise<string> {
  const copy = new ArrayBuffer(raw.byteLength);
  new Uint8Array(copy).set(raw);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
