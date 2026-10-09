"use client";

import { JOIN_INTENTS, type JoinIntent } from "@enrailar/shared";
import { useEffect, useState, type FormEvent } from "react";
import {
  apiOrigin,
  intentsFromHash,
  parseSumate,
  SUMATE_PATH,
  sumateIssueFields,
  type SumateField,
} from "../src/submit.ts";

export interface Labels {
  intent: string;
  intents: Record<JoinIntent, string>;
  email: string;
  name: string;
  city: string;
  link: string;
  message: string;
  consent: string;
  send: string;
  sending: string;
  accepted: string;
  acceptedNewsletter: string;
  rejected: string;
  errors: Record<SumateField, string>;
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
 * monta a mano, así no importa si el script llega antes o después del contenedor.
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

function fieldError(id: string, text: string | undefined) {
  if (!text) return null;
  return <p id={id} className="field-error" role="alert">{text}</p>;
}

export function SumateForm({
  hint,
  locale,
  labels,
  siteKey,
  siteKeyPending = false,
}: {
  hint?: string;
  locale: "es" | "en";
  labels: Labels;
  siteKey: string;
  siteKeyPending?: boolean;
}) {
  const [selected, setSelected] = useState<JoinIntent[]>([]);
  const [errors, setErrors] = useState<Partial<Record<SumateField, string>>>({});
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = useTurnstileScript(siteKey);

  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash;
      if (hash === "#sumate" || hash.startsWith("#sumate?")) {
        document.getElementById("sumate")?.scrollIntoView({ block: "start" });
      }
      const fromHash = intentsFromHash(hash);
      if (fromHash.length > 0) setSelected(fromHash);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  function toggle(intent: JoinIntent) {
    setSelected((current) => current.includes(intent) ? current.filter((item) => item !== intent) : [...current, intent]);
    setErrors((current) => ({ ...current, intents: undefined }));
  }

  function clearField(field: SumateField) {
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function showIssues(names: readonly SumateField[]) {
    const next: Partial<Record<SumateField, string>> = {};
    for (const name of names) next[name] = labels.errors[name];
    setErrors(next);
    const first = names[0];
    if (!first) return;
    const target = first === "intents" ? "sumate-intent-hackatrain" : `sumate-${first}`;
    document.getElementById(target)?.focus();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = parseSumate({
      intents: selected,
      email: String(data.get("email") ?? ""),
      name: String(data.get("name") ?? ""),
      city: String(data.get("city") ?? ""),
      link: String(data.get("link") ?? ""),
      message: String(data.get("message") ?? ""),
      locale,
      consent: data.get("consent") === "on",
      turnstileToken: String(data.get("cf-turnstile-response") ?? ""),
      company_url: String(data.get("company_url") ?? ""),
    });
    if (!parsed.success) {
      showIssues(sumateIssueFields(parsed.error.issues));
      setStatus(null);
      return;
    }
    setErrors({});
    setBusy(true);
    const wantsNewsletter = parsed.data.intents.includes("boletin");
    try {
      const response = await fetch(`${apiOrigin(process.env.NEXT_PUBLIC_API_ORIGIN)}${SUMATE_PATH}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const raw = body && typeof body === "object" && "fields" in body && Array.isArray(body.fields)
          ? body.fields.filter((item): item is string => typeof item === "string")
          : [];
        showIssues(sumateIssueFields(raw.map((name) => ({ path: [name] }))));
        setStatus({ text: labels.rejected, ok: false });
        return;
      }
      setStatus({ text: wantsNewsletter ? labels.acceptedNewsletter : labels.accepted, ok: true });
      setSelected([]);
      form.reset();
    } catch {
      setStatus({ text: labels.rejected, ok: false });
    } finally {
      setBusy(false);
    }
  }

  const intentErrorId = errors.intents ? "sumate-intents-error" : undefined;

  return (
    <form className="form" onSubmit={onSubmit} aria-labelledby="sumate-title" noValidate>
      {hint ? <p className="hint">{hint}</p> : null}
      <fieldset
        className="intent-set"
        aria-invalid={errors.intents ? true : undefined}
        aria-describedby={intentErrorId}
      >
        <legend>{labels.intent}</legend>
        <div className="chips">
          {JOIN_INTENTS.map((intent) => (
            <label className="chip" key={intent}>
              <input
                id={intent === "hackatrain" ? "sumate-intent-hackatrain" : undefined}
                type="checkbox"
                name="intents"
                value={intent}
                checked={selected.includes(intent)}
                onChange={() => toggle(intent)}
              />
              <span>{labels.intents[intent]}</span>
            </label>
          ))}
        </div>
        {fieldError("sumate-intents-error", errors.intents)}
      </fieldset>
      <label className="field" htmlFor="sumate-email">
        {labels.email}
        <input
          id="sumate-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "sumate-email-error" : undefined}
          onChange={() => clearField("email")}
        />
        {fieldError("sumate-email-error", errors.email)}
      </label>
      <label className="field" htmlFor="sumate-name">
        {labels.name}
        <input
          id="sumate-name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={120}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "sumate-name-error" : undefined}
          onChange={() => clearField("name")}
        />
        {fieldError("sumate-name-error", errors.name)}
      </label>
      <label className="field" htmlFor="sumate-city">
        {labels.city}
        <input
          id="sumate-city"
          name="city"
          type="text"
          autoComplete="address-level2"
          maxLength={120}
          aria-invalid={errors.city ? true : undefined}
          aria-describedby={errors.city ? "sumate-city-error" : undefined}
          onChange={() => clearField("city")}
        />
        {fieldError("sumate-city-error", errors.city)}
      </label>
      <label className="field" htmlFor="sumate-link">
        {labels.link}
        <input
          id="sumate-link"
          name="link"
          type="url"
          autoComplete="url"
          placeholder="https://"
          aria-invalid={errors.link ? true : undefined}
          aria-describedby={errors.link ? "sumate-link-error" : undefined}
          onChange={() => clearField("link")}
        />
        {fieldError("sumate-link-error", errors.link)}
      </label>
      <label className="field" htmlFor="sumate-message">
        {labels.message}
        <textarea
          id="sumate-message"
          name="message"
          maxLength={4000}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={errors.message ? "sumate-message-error" : undefined}
          onChange={() => clearField("message")}
        />
        {fieldError("sumate-message-error", errors.message)}
      </label>
      <label className="hp" aria-hidden="true">
        Company
        <input name="company_url" tabIndex={-1} autoComplete="off" />
      </label>
      <div className="field">
        <label className="check" htmlFor="sumate-consent">
          <input
            id="sumate-consent"
            name="consent"
            type="checkbox"
            aria-invalid={errors.consent ? true : undefined}
            aria-describedby={errors.consent ? "sumate-consent-error" : undefined}
            onChange={() => clearField("consent")}
          />
          <span>{labels.consent}</span>
        </label>
        {fieldError("sumate-consent-error", errors.consent)}
      </div>
      <div
        aria-invalid={errors.turnstileToken ? true : undefined}
        aria-describedby={errors.turnstileToken ? "sumate-turnstile-error" : undefined}
      >
        <TurnstileSlot siteKey={siteKey} ready={ready} labels={labels} pending={siteKeyPending} />
        {fieldError("sumate-turnstile-error", errors.turnstileToken)}
      </div>
      <div>
        <button className="btn" type="submit" disabled={busy}>{busy ? labels.sending : labels.send}</button>
      </div>
      {status ? (
        <p className={`status ${status.ok ? "status--ok" : "status--error"}`} role="status">{status.text}</p>
      ) : null}
    </form>
  );
}
