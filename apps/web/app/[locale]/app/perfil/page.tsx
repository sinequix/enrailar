import { notFound } from "next/navigation";
import { readAccess } from "../../../access.ts";
import { AppShell } from "../../../components/app-shell.tsx";
import { COPY, isLocale } from "../../../../src/copy.ts";
import { loadProfile } from "../../../../src/app-data.ts";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  const { access, db } = await readAccess();
  const profile = access.user && db ? await loadProfile(db, access.user.id) : null;
  return (
    <AppShell
      locale={locale}
      path="/app/perfil"
      title={copy.app.profile}
      skip={copy.skip}
      navLabel={copy.app.nav}
      home={copy.app.home}
      profile={copy.app.profile}
      security={copy.app.security}
      admin={copy.app.admin}
      showAdmin={access.decision === "ok"}
    >
      <section className="card">
        <p>{profile?.name ?? "cuenta"}</p>
        <p className="hint">{profile?.emailMask ?? "—"}</p>
        <p className="hint">{profile?.role ?? "user"}</p>
      </section>
    </AppShell>
  );
}
