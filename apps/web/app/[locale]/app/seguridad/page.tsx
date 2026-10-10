import { notFound } from "next/navigation";
import { readAccess } from "../../../access.ts";
import { SecurityPanel } from "../../../components/account-forms.tsx";
import { AppShell } from "../../../components/app-shell.tsx";
import { COPY, isLocale } from "../../../../src/copy.ts";

export const dynamic = "force-dynamic";

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  const { access } = await readAccess();
  return (
    <AppShell
      locale={locale}
      path="/app/seguridad"
      title={copy.app.security}
      skip={copy.skip}
      navLabel={copy.app.nav}
      home={copy.app.home}
      profile={copy.app.profile}
      security={copy.app.security}
      admin={copy.app.admin}
      showAdmin={access.decision === "ok"}
    >
      <SecurityPanel locale={locale} labels={copy.account} />
    </AppShell>
  );
}
