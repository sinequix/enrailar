import { COPY, type Locale } from "../../src/copy.ts";

export function SiteHeader({ locale, path = "" }: { locale: Locale; path?: string }) {
  const copy = COPY[locale];
  const other: Locale = locale === "es" ? "en" : "es";
  const home = `/${locale}`;
  return (
    <header className="site-header">
      <div className="wrap">
        <a className="brand" href={home}>
          <img src="/brand/logo-horizontal.svg" width={273} height={64} alt="Enrailar" />
        </a>
        <nav className="nav" aria-label={locale === "es" ? "Principal" : "Main"}>
          <a className="nav-section" href={`${home}#vision`}>{copy.nav.vision}</a>
          <a className="nav-section" href={`${home}#fase-1`}>{copy.nav.phase}</a>
          <a className="nav-section" href={`${home}#que-viene`}>{copy.nav.next}</a>
          <a className="nav-section" href={`${home}#hackatrain`}>{copy.nav.hackatrain}</a>
          <a href={`${home}/blog`}>{copy.nav.blog}</a>
          <a className="nav-section" href={`${home}#sumate`}>{copy.nav.join}</a>
          <a className="lang" href={`/${other}${path}`} lang={other} hrefLang={other} aria-label={`${copy.language}: ${other.toUpperCase()}`}>
            {other.toUpperCase()}
          </a>
        </nav>
      </div>
    </header>
  );
}
