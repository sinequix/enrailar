import { notFound } from "next/navigation";
import { AccountShell } from "../../../components/account-shell.tsx";
import { VerifyForm } from "../../../components/account-forms.tsx";
import { COPY, isLocale } from "../../../../src/copy.ts";

export default async function VerifyPage({
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
    <AccountShell locale={locale} path="/cuenta/verificar" title={copy.account.verifyTitle} skip={copy.skip}>
      <VerifyForm labels={copy.account} token={token} />
    </AccountShell>
  );
}
