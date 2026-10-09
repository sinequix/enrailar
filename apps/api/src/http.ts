import {
  contactSchema,
  mailJobSchema,
  newsletterSchema,
  preinscriptionSchema,
  sumateSchema,
  type ContactInput,
  type NewsletterInput,
  type PreinscriptionInput,
  type SumateInput,
} from "@enrailar/shared";
import type { NextFunction, Request, Response, Router } from "express";
import type { ApiDeps } from "./deps.ts";
import { clientIp } from "./deps.ts";
import type { AuditEvent } from "./store.ts";
import { randomToken, sha256 } from "./tokens.ts";

function fieldsOf(error: { issues: ReadonlyArray<{ path: PropertyKey[] }> }): string[] {
  return error.issues.map((issue) => issue.path.map(String).join("."));
}

async function reject(deps: ApiDeps, res: Response, route: string, recordId: string, status: number, body: unknown) {
  const event: AuditEvent = { recordId, kind: "form.rejected", createdAt: deps.now() };
  await deps.store.appendAudit(event);
  deps.log({ route, status, recordId });
  res.status(status).json(body);
}

async function guard(deps: ApiDeps, req: Request, res: Response, route: string): Promise<boolean> {
  const body = req.body;
  if (body && typeof body === "object" && "company_url" in body && String(body.company_url ?? "").length > 0) {
    await deps.store.appendAudit({ recordId: "honeypot", kind: "form.rejected", createdAt: deps.now() });
    deps.log({ route, status: 200, recordId: "honeypot" });
    res.status(200).json({ ok: true });
    return false;
  }
  const ip = clientIp(req.header("cf-connecting-ip"));
  const bucket = await sha256(`${route}:${ip}`);
  const allowed = await deps.store.allow(bucket, deps.now(), deps.rateLimit.windowMs, deps.rateLimit.limit);
  if (!allowed) {
    await reject(deps, res, route, "rate", 429, { ok: false, error: "rate" });
    return false;
  }
  return true;
}

async function readForm<T>(
  deps: ApiDeps,
  req: Request,
  res: Response,
  route: string,
  schema: { safeParse: (input: unknown) => { success: true; data: T } | { success: false; error: { issues: ReadonlyArray<{ path: PropertyKey[] }> } } },
): Promise<T | undefined> {
  if (!await guard(deps, req, res, route)) return undefined;
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    await reject(deps, res, route, "validation", 400, { ok: false, error: "validation", fields: fieldsOf(parsed.error) });
    return undefined;
  }
  const ip = clientIp(req.header("cf-connecting-ip"));
  const token = (req.body as { turnstileToken?: string }).turnstileToken ?? "";
  const turnstileOk = await deps.verifyTurnstile(token, ip === "unknown" ? undefined : ip);
  if (!turnstileOk) {
    await reject(deps, res, route, "turnstile", 400, { ok: false, error: "turnstile" });
    return undefined;
  }
  return parsed.data;
}

function page(title: string, text: string): string {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>${title}</title><p>${text}</p></html>`;
}

export function mountRoutes(router: Router, deps: ApiDeps): void {
  router.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  router.post("/v1/preinscripcion", (req, res, next) => {
    handlePreinscription(deps, req, res).catch(next);
  });
  router.post("/v1/contacto", (req, res, next) => {
    handleContact(deps, req, res).catch(next);
  });
  router.post("/v1/newsletter", (req, res, next) => {
    handleNewsletter(deps, req, res).catch(next);
  });
  router.post("/v1/sumate", (req, res, next) => {
    handleSumate(deps, req, res).catch(next);
  });
  router.get("/v1/newsletter/confirm", (req, res, next) => {
    handleConfirm(deps, req, res).catch(next);
  });
  router.get("/v1/newsletter/unsubscribe", (req, res, next) => {
    handleUnsubscribe(deps, req, res, "html").catch(next);
  });
  router.post("/v1/newsletter/unsubscribe", (req, res, next) => {
    handleUnsubscribe(deps, req, res, "json").catch(next);
  });
}

async function handlePreinscription(deps: ApiDeps, req: Request, res: Response): Promise<void> {
  const route = "POST /v1/preinscripcion";
  const data = await readForm<PreinscriptionInput>(deps, req, res, route, preinscriptionSchema);
  if (!data) return;
  const id = crypto.randomUUID();
  const now = deps.now();
  await deps.store.insertPreinscription({
    id,
    email: data.email,
    linkedin: data.linkedin,
    message: data.message,
    locale: data.locale,
    consentAt: now,
    createdAt: now,
  });
  await deps.store.appendAudit({ recordId: id, kind: "preinscription.accepted", createdAt: now });
  deps.log({ route, status: 202, recordId: id });
  res.status(202).json({ ok: true });
}

async function handleContact(deps: ApiDeps, req: Request, res: Response): Promise<void> {
  const route = "POST /v1/contacto";
  const data = await readForm<ContactInput>(deps, req, res, route, contactSchema);
  if (!data) return;
  const id = crypto.randomUUID();
  const now = deps.now();
  await deps.store.insertContact({
    id,
    intent: data.intent,
    email: data.email,
    linkedin: data.linkedin,
    message: data.message,
    locale: data.locale,
    consentAt: now,
    createdAt: now,
  });
  await deps.store.appendAudit({ recordId: id, kind: "contact.accepted", createdAt: now });
  deps.log({ route, status: 202, recordId: id });
  res.status(202).json({ ok: true });
}

async function startNewsletter(
  deps: ApiDeps,
  input: { email: string; locale: "es" | "en" },
  now: string,
): Promise<string> {
  const confirmToken = randomToken();
  const unsubscribeToken = randomToken();
  const id = await deps.store.saveNewsletterPending({
    id: crypto.randomUUID(),
    email: input.email,
    locale: input.locale,
    confirmTokenHash: await sha256(confirmToken),
    unsubscribeTokenHash: await sha256(unsubscribeToken),
    consentAt: now,
    createdAt: now,
  });
  const job = mailJobSchema.parse({
    kind: "newsletter.confirm",
    to: input.email,
    locale: input.locale,
    confirmPath: `/v1/newsletter/confirm?token=${confirmToken}`,
    unsubscribePath: `/v1/newsletter/unsubscribe?token=${unsubscribeToken}`,
  });
  await deps.enqueue(job);
  await deps.store.appendAudit({ recordId: id, kind: "newsletter.pending", createdAt: now });
  return id;
}

async function handleNewsletter(deps: ApiDeps, req: Request, res: Response): Promise<void> {
  const route = "POST /v1/newsletter";
  const data = await readForm<NewsletterInput>(deps, req, res, route, newsletterSchema);
  if (!data) return;
  const id = await startNewsletter(deps, data, deps.now());
  deps.log({ route, status: 202, recordId: id });
  res.status(202).json({ ok: true });
}

async function handleSumate(deps: ApiDeps, req: Request, res: Response): Promise<void> {
  const route = "POST /v1/sumate";
  const data = await readForm<SumateInput>(deps, req, res, route, sumateSchema);
  if (!data) return;
  const id = crypto.randomUUID();
  const now = deps.now();
  await deps.store.insertSubmission({
    id,
    email: data.email,
    name: data.name,
    city: data.city,
    link: data.link,
    message: data.message,
    locale: data.locale,
    intents: data.intents,
    consentAt: now,
    createdAt: now,
  });
  await deps.store.appendAudit({ recordId: id, kind: "sumate.accepted", createdAt: now });
  if (data.intents.includes("boletin")) {
    await startNewsletter(deps, data, now);
  }
  deps.log({ route, status: 202, recordId: id });
  res.status(202).json({ ok: true });
}

async function handleConfirm(deps: ApiDeps, req: Request, res: Response): Promise<void> {
  const route = "GET /v1/newsletter/confirm";
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const recordId = token.length > 0 ? await deps.store.confirmNewsletter(await sha256(token), deps.now()) : undefined;
  if (!recordId) {
    deps.log({ route, status: 404, recordId: "missing" });
    res.status(404).type("html").send(page("Enrailar", "El enlace no es válido."));
    return;
  }
  await deps.store.appendAudit({ recordId, kind: "newsletter.confirmed", createdAt: deps.now() });
  deps.log({ route, status: 200, recordId });
  res.status(200).type("html").send(page("Enrailar", "Suscripción confirmada."));
}

async function handleUnsubscribe(
  deps: ApiDeps,
  req: Request,
  res: Response,
  format: "html" | "json",
): Promise<void> {
  const route = `${format === "html" ? "GET" : "POST"} /v1/newsletter/unsubscribe`;
  const fromQuery = typeof req.query.token === "string" ? req.query.token : "";
  const fromBody = req.body && typeof req.body === "object" && "token" in req.body && typeof req.body.token === "string"
    ? req.body.token
    : "";
  const token = fromQuery || fromBody;
  const recordId = token.length > 0 ? await deps.store.unsubscribeNewsletter(await sha256(token), deps.now()) : undefined;
  if (!recordId) {
    deps.log({ route, status: 404, recordId: "missing" });
    if (format === "json") res.status(404).json({ ok: false });
    else res.status(404).type("html").send(page("Enrailar", "El enlace no es válido."));
    return;
  }
  await deps.store.appendAudit({ recordId, kind: "newsletter.unsubscribed", createdAt: deps.now() });
  deps.log({ route, status: 200, recordId });
  if (format === "json") res.status(200).json({ ok: true });
  else res.status(200).type("html").send(page("Enrailar", "Baja confirmada."));
}

export function errorHandler(deps: ApiDeps) {
  return (_error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    deps.log({ route: "error", status: 500, recordId: "error" });
    if (!res.headersSent) res.status(500).json({ ok: false, error: "error" });
  };
}
