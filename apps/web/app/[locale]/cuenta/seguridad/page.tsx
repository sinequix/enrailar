import { notFound } from "next/navigation";
import { AccountShell } from "../../../components/account-shell.tsx";
import { SecurityPanel } from "../../../components/account-forms.tsx";
import { COPY, isLocale } from "../../../../src/copy.ts";

export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  return (
    <AccountShell locale={locale} path="/cuenta/seguridad" title={copy.account.securityTitle} skip={copy.skip}>
      <SecurityPanel locale={locale} labels={copy.account} />
    </AccountShell>
  );
}