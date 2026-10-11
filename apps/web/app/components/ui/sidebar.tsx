import type { ReactNode } from "react";

export function Sidebar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside data-slot="sidebar" className="app-side">
      <nav aria-label={label}>{children}</nav>
    </aside>
  );
}

export function SidebarLink({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return (
    <a href={href} aria-current={current ? "page" : undefined} data-slot="sidebar-link">
      {children}
    </a>
  );
}
