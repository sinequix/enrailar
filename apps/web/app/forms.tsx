"use client";

import { CONSENT_COPY, type ContactIntent } from "@enrailar/shared";
import { useEffect, useState, type FormEvent } from "react";
import type { FormKind } from "../src/submit.ts";
import { apiOrigin, formPath, parseSubmission } from "../src/submit.ts";

export interface Labels {
  email: string;
  linkedin: string;
  message: string;
  intent: string;
  intents: Record<ContactIntent, string>;
  send: string;
  sending: string;
  accepted: string;
  rejected: string;
  fields: string;
  turnstileMissing: string;
  turnstileLoading: string;
}

interface TurnstileApi {
  render: (el: HTMLElement, opts: { sitekey: string }) => string;
}

function turnstileApi(): TurnstileApi | undefined {
  return (globalThis as { turnstile?: TurnstileApi }).turnstile;
}

/**
 * Carga el script de Turnstile una sola vez. Con `render=explicit` el widget se
 * monta a mano en cada formulario, así no importa si el script llega antes o
 * después de que el DOM tenga los contenedores.
 */
function useTurnstileScript(siteKey: string) {
  const [ready, setReady] = useState(() => Boolean(turnstileApi()));
  useEffect(() => {
    if (!siteKey || ready) return;
    const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
    const onLoad = () => setReady(true);
    if (existing) {
      existing.addEventListener("load", onLoad);
      return () => existing.removeEventListener("load", onLoad);
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.turnstile = "1";
    script.addEventListener("load", onLoad);
    document.head.appendChild(script);
    return () => script.removeEventListener("load", onLoad);
  }, [siteKey, ready]);
  return ready;
}

function TurnstileSlot({ siteKey, ready, labels, pending }: { siteKey: string; ready: boolean; labels: Labels; pending: boolean }) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!node || !siteKey || !ready || node.childElementCount > 0) return;
    turnstileApi()?.render(node, { sitekey: siteKey });
  }, [node, siteKey, ready]);
  if (!siteKey) {
    return <p className="note">{pending ? labels.turnstileLoading : labels.turnstileMissing}</p>;
  }
  return <div className="turnstile-slot" ref={setNode} />;
}

export function PublicForm({
  kind,
  title,
  hint,
  locale,
  labels,
  siteKey,
  siteKeyPending = false,
}: {
  kind: FormKind;
  title: string;
  hint?: string;
  locale: "es" | "en";
  labels: Labels;
  siteKey: string;
  siteKeyPending?: boolean;
}) {
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = useTurnstileScript(siteKey);
  const showMessage = kind !== "newsletter";
  const id = (field: string) => `${kind}-${field}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const intent = String(data.get("intent") ?? "");
    const parsed = parseSubmission(kind, {
      email: String(data.get("email") ?? ""),
      linkedin: String(data.get("linkedin") ?? ""),
      message: String(data.get("message") ?? ""),
      locale,
      consent: data.get("consent") === "on",
      turnstileToken: String(data.get("cf-turnstile-response") ?? ""),
      company_url: String(data.get("company_url") ?? ""),
      intent: intent === "colaborar" || intent === "donar" || intent === "sumarme" ? intent : undefined,
    });
    if (!parsed.success) {
      const names = parsed.error.issues.map((issue) => issue.path.map(String).join(".")).join(", ");
      setStatus({ text: `${labels.rejected} ${labels.fields}: ${names}`, ok: false });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${apiOrigin(process.env.NEXT_PUBLIC_API_ORIGIN)}${formPath(kind)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      setStatus({ text: response.ok ? labels.accepted : labels.rejected, ok: response.ok });
      if (response.ok) form.reset();
    } catch {
      setStatus({ text: labels.rejected, ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} aria-labelledby={id("title")}>
      <h3 id={id("title")}>{title}</h3>
      {hint ? <p className="hint">{hint}</p> : null}
      {kind === "contacto" ? (
        <label className="field" htmlFor={id("intent")}>
          {labels.intent}
          <select id={id("intent")} name="intent" defaultValue="colaborar">
            <option value="colaborar">{labels.intents.colaborar}</option>
            <option value="donar">{labels.intents.donar}</option>
            <option value="sumarme">{labels.intents.sumarme}</option>
          </select>
        </label>
      ) : null}
      <label className="field" htmlFor={id("email")}>
        {labels.email}
        <input id={id("email")} name="email" type="email" autoComplete="email" required />
      </label>
      {showMessage ? (
        <label className="field" htmlFor={id("linkedin")}>
          {labels.linkedin}
          <input id={id("linkedin")} name="linkedin" type="url" placeholder="https://www.linkedin.com/in/" />
        </label>
      ) : null}
      {showMessage ? (
        <label className="field" htmlFor={id("message")}>
          {labels.message}
          <textarea id={id("message")} name="message" required />
        </label>
      ) : null}
      <label className="hp" aria-hidden="true">
        Company
        <input name="company_url" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="check" htmlFor={id("consent")}>
        <input id={id("consent")} name="consent" type="checkbox" />
        <span>{CONSENT_COPY}</span>
      </label>
      <TurnstileSlot siteKey={siteKey} ready={ready} labels={labels} pending={siteKeyPending} />
      <div>
        <button className="btn" type="submit" disabled={busy}>{busy ? labels.sending : labels.send}</button>
      </div>
      {status ? (
        <p className={`status ${status.ok ? "status--ok" : "status--error"}`} role="status">{status.text}</p>
      ) : null}
    </form>
  );
}
