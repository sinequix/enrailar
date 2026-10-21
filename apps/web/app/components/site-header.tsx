"use client";

import { NEWS_ORIGIN } from "@enrailar/shared";
import { useEffect, useId, useRef, useState } from "react";
import { COPY, type Locale } from "../../src/copy.ts";
import { Button } from "./ui/button.tsx";

export function SiteHeader(
  { locale, path = "" }: { locale: Locale; path?: string },
) {
  const copy = COPY[locale];
  const other: Locale = locale === "es" ? "en" : "es";
  const home = `/${locale}`;
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="site-header">
      <div className="wrap">
        <a className="brand" href={home}>
          <img
            src="/brand/logo-horizontal.svg"
            width={148}
            height={32}
            alt="Enrailar"
          />
        </a>
        <nav
          className="nav"
          aria-label={locale === "es" ? "Principal" : "Main"}
        >
          <div
            ref={panelRef}
            id={menuId}
            className={open ? "nav-links is-open" : "nav-links"}
            onClick={() => setOpen(false)}
          >
            <a className="nav-section" href={`${home}#vision`}>
              {copy.nav.vision}
            </a>
            <a className="nav-section" href={`${home}#fase-1`}>
              {copy.nav.phase}
            </a>
            <a className="nav-section" href={`${home}#que-viene`}>
              {copy.nav.next}
            </a>
            <a className="nav-section" href={`${home}#hackatrain`}>
              {copy.nav.hackatrain}
            </a>
            <a href={`${home}/blog`}>{copy.nav.blog}</a>
            <a href={NEWS_ORIGIN}>{copy.nav.news}</a>
            <a className="nav-section" href={`${home}#sumate`}>
              {copy.nav.join}
            </a>
            <Button variant="ghost" asChild>
              <a href={`/${locale}/cuenta/ingresar`}>{copy.account.signIn}</a>
            </Button>
            <Button asChild>
              <a href={`/${locale}/cuenta/crear`}>{copy.account.signUp}</a>
            </Button>
          </div>
          <a
            className="lang"
            href={`/${other}${path}`}
            lang={other}
            hrefLang={other}
            aria-label={`${copy.language}: ${other.toUpperCase()}`}
          >
            {other.toUpperCase()}
          </a>
          <button
            ref={toggleRef}
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? copy.nav.menuClose : copy.nav.menuOpen}
            onClick={() => setOpen((value) => !value)}
          >
            <MenuGlyph open={open} />
          </button>
        </nav>
      </div>
    </header>
  );
}

function MenuGlyph({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {open
        ? <path d="M6 6l12 12M18 6 6 18" />
        : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}
