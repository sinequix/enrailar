"use client";

import { useEffect } from "react";

/** Carga el script público de Turnstile y deja la sitekey en el documento. */
export function TurnstileLoader({ siteKey }: { siteKey: string }) {
  useEffect(() => {
    if (siteKey.length === 0) return;
    document.documentElement.dataset.turnstile = siteKey;
    if (document.querySelector("script[data-turnstile]")) return;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.turnstile = "1";
    document.head.appendChild(script);
  }, [siteKey]);
  return null;
}
