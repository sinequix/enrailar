import { notFound } from "next/navigation";
import { readAccess } from "../../../access.ts";
import { AdminPanel } from "../../../components/admin-panel.tsx";
import { AppShell } from "../../../components/app-shell.tsx";
import { loadAdmin } from "../../../../src/app-data.ts";
import { COPY, isLocale } from "../../../../src/copy.ts";

export const dynamic = "force-dynamic";

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  const { access, db } = await readAccess();
  const allowed = access.decision === "ok" && access.user && db;
  const data = allowed ? await loadAdmin(db) : null;
  return (
    <AppShell
      locale={locale}
      path="/app/admin"
      title={copy.app.admin}
      skip={copy.skip}
      navLabel={copy.app.nav}
      home={copy.app.home}
      profile={copy.app.profile}
      security={copy.app.security}
      admin={copy.app.admin}
      showAdmin={access.decision === "ok"}
    >
      {data && access.user
        ? <AdminPanel data={data} selfId={access.user.id} labels={{ ...copy.app, failed: copy.account.failed }} />
        : <p className="hint">{copy.app.forbidden}</p>}
    </AppShell>
  );
}
