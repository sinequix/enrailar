import { notFound } from "next/navigation";
import { AccountShell } from "../../../components/account-shell.tsx";
import { RecoverForm } from "../../../components/account-forms.tsx";
import { COPY, isLocale } from "../../../../src/copy.ts";
import { turnstileSiteKeyFromProcess } from "../../../../src/turnstile.ts";

export default async function RecoverPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  const token = typeof query.token === "string" ? query.token : "";
  return (
    <AccountShell locale={locale} path="/cuenta/recuperar" title={copy.account.recoverTitle} skip={copy.skip} siteKey={turnstileSiteKeyFromProcess()}>
      <RecoverForm locale={locale} labels={copy.account} emailLabel={copy.email} token={token} />
    </AccountShell>
  );
}
