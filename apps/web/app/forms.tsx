"use client";

import { CONSENT_COPY, type ContactIntent } from "@enrailar/shared";
import { useEffect, useState, type FormEvent } from "react";
import type { FormKind } from "../src/submit.ts";
import { apiOrigin, formPath, parseSubmission } from "../src/submit.ts";

interface Labels {
  email: string;
  linkedin: string;
  message: string;
  intent: string;
  intents: Record<ContactIntent, string>;
  send: string;
  accepted: string;
  rejected: string;
  fields: string;
  turnstileMissing: string;
}

export function PublicForm({
  kind,
  title,
  locale,
  labels,
  siteKey,
}: {
  kind: FormKind;
  title: string;
  locale: "es" | "en";
  labels: Labels;
  siteKey: string;
}) {
  const [status, setStatus] = useState("");
  const showMessage = kind !== "newsletter";
  useEffect(() => {
    if (!siteKey || document.querySelector("script[data-turnstile]")) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.dataset.turnstile = "1";
    document.head.appendChild(script);
  }, [siteKey]);

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
      setStatus(`${labels.rejected} ${labels.fields}: ${names}`);
      return;
    }
    const response = await fetch(`${apiOrigin(process.env.NEXT_PUBLIC_API_ORIGIN)}${formPath(kind)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    setStatus(response.ok ? labels.accepted : labels.rejected);
    if (response.ok) form.reset();
  }

  return (
    <form onSubmit={onSubmit}>
      <h3>{title}</h3>
      {kind === "contacto" ? (
        <label>
          {labels.intent}
          <select name="intent" defaultValue="colaborar">
            <option value="colaborar">{labels.intents.colaborar}</option>
            <option value="donar">{labels.intents.donar}</option>
            <option value="sumarme">{labels.intents.sumarme}</option>
          </select>
        </label>
      ) : null}
      <label>
        {labels.email}
        <input name="email" type="email" autoComplete="email" required />
      </label>
      {showMessage ? (
        <label>
          {labels.linkedin}
          <input name="linkedin" type="url" placeholder="https://www.linkedin.com/in/" />
        </label>
      ) : null}
      {showMessage ? (
        <label>
          {labels.message}
          <textarea name="message" required />
        </label>
      ) : null}
      <label className="hp" aria-hidden="true">
        Company
        <input name="company_url" tabIndex={-1} autoComplete="off" />
      </label>
      <label>
        <input name="consent" type="checkbox" /> {CONSENT_COPY}
      </label>
      {siteKey ? <div className="cf-turnstile" data-sitekey={siteKey} /> : <p className="note">{labels.turnstileMissing}</p>}
      <button type="submit">{labels.send}</button>
      {status ? <p role="status">{status}</p> : null}
    </form>
  );
}
