import type { ReactNode } from "react";
import type { Locale } from "../../src/copy.ts";
import { HtmlLang } from "./html-lang.tsx";
import { SiteFooter } from "./site-footer.tsx";
import { SiteHeader } from "./site-header.tsx";
import { Sidebar, SidebarLink } from "./ui/sidebar.tsx";

export function AppShell({
  locale,
  path,
  title,
  skip,
  navLabel,
  home,
  profile,
  security,
  admin,
  showAdmin,
  children,
}: {
  locale: Locale;
  path: string;
  title: string;
  skip: string;
  navLabel: string;
  home: string;
  profile: string;
  security: string;
  admin: string;
  showAdmin: boolean;
  children: ReactNode;
}) {
  const base = `/${locale}/app`;
  return (
    <>
      <HtmlLang locale={locale} />
      <a className="skip" href="#contenido">{skip}</a>
      <SiteHeader locale={locale} path={path} />
      <div className="wrap app-frame">
        <Sidebar label={navLabel}>
          <SidebarLink href={base} current={path === "/app"}>{home}</SidebarLink>
          <SidebarLink href={`${base}/perfil`} current={path === "/app/perfil"}>{profile}</SidebarLink>
          <SidebarLink href={`${base}/seguridad`} current={path === "/app/seguridad"}>{security}</SidebarLink>
          {showAdmin ? <SidebarLink href={`${base}/admin`} current={path === "/app/admin"}>{admin}</SidebarLink> : null}
        </Sidebar>
        <main id="contenido" className="app-main" lang={locale}>
          <h1>{title}</h1>
          {children}
        </main>
      </div>
      <SiteFooter locale={locale} />
    </>
  );
}
