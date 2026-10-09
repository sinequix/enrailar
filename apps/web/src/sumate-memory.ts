import { isJoinIntent, JOIN_INTENTS, type JoinIntent } from "@enrailar/shared";

/** Estado local de la ficha. Cambiar la forma implica otra clave. */
export const SUMATE_MEMORY_KEY = "enrailar:sumate:v1";

const MASK = /^[^\s@*][*]{3}@[^\s@]+\.[^\s@]+$/;

export interface SumateMemory {
  at: string;
  intents: JoinIntent[];
  newsletter: boolean;
  emailMask?: string;
}

/** `j***@pox.me`. No conserva el local-part completo. */
export function maskEmail(email: string): string | undefined {
  const at = email.indexOf("@");
  if (at < 1) return undefined;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const first = local[0];
  if (!first || /\s/.test(email) || !domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return undefined;
  }
  return `${first}***@${domain}`;
}

export function parseSumateMemory(raw: string): SumateMemory | undefined {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  if (typeof record.at !== "string" || !Number.isFinite(Date.parse(record.at))) return undefined;
  if (!Array.isArray(record.intents)) return undefined;
  const intents: JoinIntent[] = [];
  for (const item of record.intents) {
    if (typeof item !== "string" || !isJoinIntent(item) || intents.includes(item)) continue;
    intents.push(item);
  }
  if (intents.length === 0) return undefined;
  const newsletter = record.newsletter === true || intents.includes("boletin");
  const emailMask = typeof record.emailMask === "string" && MASK.test(record.emailMask) ? record.emailMask : undefined;
  return emailMask ? { at: record.at, intents, newsletter, emailMask } : { at: record.at, intents, newsletter };
}

export function createSumateMemory(input: {
  at: string;
  intents: readonly JoinIntent[];
  email: string;
}): SumateMemory | undefined {
  return parseSumateMemory(JSON.stringify({
    at: input.at,
    intents: input.intents,
    newsletter: input.intents.includes("boletin"),
    emailMask: maskEmail(input.email),
  }));
}

export function readSumateMemory(): SumateMemory | null {
  try {
    const raw = localStorage.getItem(SUMATE_MEMORY_KEY);
    if (!raw) return null;
    return parseSumateMemory(raw) ?? null;
  } catch {
    return null;
  }
}

let snapshot: SumateMemory | null | undefined;
const listeners = new Set<() => void>();

export function getSumateMemory(): SumateMemory | null {
  if (snapshot === undefined) snapshot = readSumateMemory();
  return snapshot;
}

export function getServerSumateMemory(): null {
  return null;
}

export function subscribeSumateMemory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function saveSumateMemory(memory: SumateMemory): void {
  const payload = {
    at: memory.at,
    intents: memory.intents,
    newsletter: memory.newsletter,
    ...(memory.emailMask ? { emailMask: memory.emailMask } : {}),
  };
  localStorage.setItem(SUMATE_MEMORY_KEY, JSON.stringify(payload));
  snapshot = parseSumateMemory(JSON.stringify(payload)) ?? memory;
  for (const listener of listeners) listener();
}

export type SumateView = "saved" | "editing" | "clear";

interface SumateDom {
  documentElement: {
    setAttribute(name: string, value: string): void;
    removeAttribute(name: string): void;
  };
  getElementById(id: string): { remove(): void } | null;
  createElement(tag: string): { id: string; textContent: string };
  head: { appendChild(node: { id: string; textContent: string }): void };
}

function sumateDom(): SumateDom {
  return (globalThis as unknown as { document: SumateDom }).document;
}

/** Marca `<html>` antes de pintar, para no mostrar la ficha si ya hay un envío. */
export function applySumateFlags(memory: SumateMemory | null, mode: SumateView): void {
  const dom = sumateDom();
  const root = dom.documentElement;
  for (const id of JOIN_INTENTS) root.removeAttribute(`data-sumate-${id}`);
  dom.getElementById("sumate-mask-style")?.remove();
  switch (mode) {
    case "editing":
      root.setAttribute("data-sumate", "editing");
      return;
    case "clear":
      root.removeAttribute("data-sumate");
      return;
    case "saved":
      break;
    default: {
      const unreachable: never = mode;
      throw new Error(unreachable);
    }
  }
  if (!memory) {
    root.removeAttribute("data-sumate");
    return;
  }
  root.setAttribute("data-sumate", "saved");
  for (const id of memory.intents) root.setAttribute(`data-sumate-${id}`, "1");
  if (memory.newsletter) root.setAttribute("data-sumate-boletin", "1");
  if (!memory.emailMask) return;
  const style = dom.createElement("style");
  style.id = "sumate-mask-style";
  style.textContent = `.sumate-mask:empty::before{content:${JSON.stringify(memory.emailMask)}}`;
  dom.head.appendChild(style);
}

/**
 * Corre en el HTML inicial, antes de la ficha. No lee ni escribe el correo en claro.
 * La máscara solo entra si ya tiene la forma `j***@pox.me`.
 */
export function sumateBootScript(): string {
  const allowed = JSON.stringify(Object.fromEntries(JOIN_INTENTS.map((id) => [id, 1])));
  return `(function(){try{
var raw=localStorage.getItem(${JSON.stringify(SUMATE_MEMORY_KEY)});
if(!raw)return;
var data=JSON.parse(raw);
if(!data||!Array.isArray(data.intents))return;
var allowed=${allowed};
var chosen=[];
for(var i=0;i<data.intents.length;i++){
  var id=data.intents[i];
  if(allowed[id]&&chosen.indexOf(id)<0)chosen.push(id);
}
if(!chosen.length)return;
var root=document.documentElement;
root.setAttribute("data-sumate","saved");
for(var j=0;j<chosen.length;j++)root.setAttribute("data-sumate-"+chosen[j],"1");
if(data.newsletter===true||chosen.indexOf("boletin")>=0)root.setAttribute("data-sumate-boletin","1");
var mask=data.emailMask;
if(typeof mask==="string"&&/^[^\\s@*][*]{3}@[^\\s@]+\\.[^\\s@]+$/.test(mask)){
  var style=document.createElement("style");
  style.id="sumate-mask-style";
  style.textContent=".sumate-mask:empty::before{content:"+JSON.stringify(mask)+"}";
  document.head.appendChild(style);
}
}catch(e){}})();`;
}
