import { notFound } from "next/navigation";
import { AccountShell } from "../../../components/account-shell.tsx";
import { SignUpForm } from "../../../components/account-forms.tsx";
import { COPY, isLocale } from "../../../../src/copy.ts";
import { turnstileSiteKeyFromProcess } from "../../../../src/turnstile.ts";

export default async function SignUpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  return (
    <AccountShell locale={locale} path="/cuenta/crear" title={copy.account.signUp} skip={copy.skip} siteKey={turnstileSiteKeyFromProcess()}>
      <SignUpForm locale={locale} labels={copy.account} emailLabel={copy.email} consent={copy.consent} />
    </AccountShell>
  );
}
