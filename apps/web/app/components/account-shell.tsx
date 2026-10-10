import type { ReactNode } from "react";
import type { Locale } from "../../src/copy.ts";
import { HtmlLang } from "./html-lang.tsx";
import { SiteFooter } from "./site-footer.tsx";
import { SiteHeader } from "./site-header.tsx";
import { TurnstileLoader } from "./turnstile-loader.tsx";

export function AccountShell({
  locale,
  path,
  title,
  skip,
  siteKey = "",
  children,
}: {
  locale: Locale;
  path: string;
  title: string;
  skip: string;
  siteKey?: string;
  children: ReactNode;
}) {
  return (
    <>
      <HtmlLang locale={locale} />
      <TurnstileLoader siteKey={siteKey} />
      <a className="skip" href="#contenido">{skip}</a>
      <SiteHeader locale={locale} path={path} />
      <main id="contenido" className="wrap section account-page" lang={locale}>
        <h1>{title}</h1>
        {children}
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
