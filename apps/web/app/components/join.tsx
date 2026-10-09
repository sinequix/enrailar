"use client";

import { useEffect, useState } from "react";
import { type Labels, SumateForm } from "../forms.tsx";

/**
 * Una sola ficha y una sola clave de Turnstile. Si el servidor no la tuvo al
 * renderizar, se pide una vez a `/api/turnstile`, que la lee del binding del Worker.
 */
export function JoinForms({
  locale,
  labels,
  hint,
  initialSiteKey,
}: {
  locale: "es" | "en";
  labels: Labels;
  hint: string;
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
  return (
    <div className="forms">
      <SumateForm locale={locale} labels={labels} hint={hint} siteKey={siteKey} siteKeyPending={pending} />
    </div>
  );
}
