"use client";

import { useEffect, useState } from "react";
import { type Labels, PublicForm } from "../forms.tsx";

interface JoinCopy {
  preinscription: string;
  contact: string;
  newsletter: string;
  formHints: { preinscripcion: string; contacto: string; newsletter: string };
}

/**
 * Los tres formularios comparten una sola clave de Turnstile. Si el servidor
 * no la tuvo al renderizar (por ejemplo, una página prerenderizada), se pide
 * una vez a `/api/turnstile`, que la lee del binding del Worker en cada request.
 */
export function JoinForms({
  locale,
  labels,
  copy,
  initialSiteKey,
}: {
  locale: "es" | "en";
  labels: Labels;
  copy: JoinCopy;
  initialSiteKey: string;
}) {
  const [siteKey, setSiteKey] = useState(initialSiteKey);
  const [pending, setPending] = useState(initialSiteKey === "");
  useEffect(() => {
    if (initialSiteKey !== "") return;
    let cancelled = false;
    fetch("/api/turnstile", { headers: { accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : { siteKey: "" }))
      .then((body: { siteKey?: unknown }) => {
        if (!cancelled && typeof body.siteKey === "string") setSiteKey(body.siteKey);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialSiteKey]);
  const shared = { locale, labels, siteKey, siteKeyPending: pending };
  return (
    <div className="forms">
      <PublicForm kind="preinscripcion" title={copy.preinscription} hint={copy.formHints.preinscripcion} {...shared} />
      <PublicForm kind="contacto" title={copy.contact} hint={copy.formHints.contacto} {...shared} />
      <PublicForm kind="newsletter" title={copy.newsletter} hint={copy.formHints.newsletter} {...shared} />
    </div>
  );
}
