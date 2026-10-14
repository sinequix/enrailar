import { notFound } from "next/navigation";
import { AccountShell } from "../../../components/account-shell.tsx";
import { SignInForm } from "../../../components/account-forms.tsx";
import { COPY, isLocale } from "../../../../src/copy.ts";
import { turnstileSiteKeyFromProcess } from "../../../../src/turnstile.ts";

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  return (
    <AccountShell locale={locale} path="/cuenta/ingresar" title={copy.account.signIn} skip={copy.skip} siteKey={turnstileSiteKeyFromProcess()}>
      <SignInForm locale={locale} labels={copy.account} emailLabel={copy.email} />
    </AccountShell>
  );
}
