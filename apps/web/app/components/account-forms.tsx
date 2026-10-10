"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Locale } from "../../src/copy.ts";
import { authClient } from "../../src/auth-client.ts";
import { Button } from "./ui/button.tsx";
import { Input } from "./ui/input.tsx";
import { Label } from "./ui/label.tsx";

export interface AccountLabels {
  signIn: string;
  signUp: string;
  password: string;
  passwordAgain: string;
  submitSignIn: string;
  submitSignUp: string;
  forgot: string;
  verifyTitle: string;
  verifyBody: string;
  verifyAction: string;
  recoverTitle: string;
  recoverSend: string;
  recoverChoose: string;
  securityTitle: string;
  passkey: string;
  passkeyAdd: string;
  totp: string;
  totpOn: string;
  totpOff: string;
  confirm: string;
  backup: string;
  secretHint: string;
  code: string;
  sessions: string;
  revoke: string;
  signedOut: string;
  mismatch: string;
  failed: string;
}

function statusLine(text: string | null) {
  if (!text) return null;
  return <p className="status" role="status">{text}</p>;
}

export function SignInForm({ locale, labels, emailLabel }: { locale: Locale; labels: AccountLabels; emailLabel: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const live = useLive();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (result.error) setMessage(labels.failed);
  }

  return (
    <form className="form" method="post" data-live={live ? "1" : "0"} onSubmit={onSubmit}>
      <Label className="field" htmlFor="account-email">
        {emailLabel}
        <Input id="account-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </Label>
      <Label className="field" htmlFor="account-password">
        {labels.password}
        <Input id="account-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} />
      </Label>
      <Button type="submit" disabled={busy || !live}>{labels.submitSignIn}</Button>
      <p className="hint"><a href={`/${locale}/cuenta/recuperar`}>{labels.forgot}</a></p>
      {statusLine(message)}
    </form>
  );
}

function useLive() {
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);
  return live;
}

export function SignUpForm({
  locale,
  labels,
  emailLabel,
  consent,
}: {
  locale: Locale;
  labels: AccountLabels;
  emailLabel: string;
  consent: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const live = useLive();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== again) {
      setMessage(labels.mismatch);
      return;
    }
    if (!accepted) {
      setMessage(labels.failed);
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await authClient.signUp.email({
      email,
      password,
      name: "cuenta",
      consentAt: new Date().toISOString(),
      locale,
      fetchOptions: {
        headers: { "x-turnstile-token": turnstileValue() },
      },
    });
    setBusy(false);
    if (result.error) setMessage(labels.failed);
  }

  return (
    <form className="form" method="post" data-live={live ? "1" : "0"} onSubmit={onSubmit}>
      <Label className="field" htmlFor="account-email">
        {emailLabel}
        <Input id="account-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </Label>
      <Label className="field" htmlFor="account-password">
        {labels.password}
        <Input id="account-password" name="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} />
      </Label>
      <Label className="field" htmlFor="account-password-again">
        {labels.passwordAgain}
        <Input id="account-password-again" name="password-again" type="password" autoComplete="new-password" value={again} onChange={(event) => setAgain(event.target.value)} required minLength={12} />
      </Label>
      <Label className="check">
        <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
        <span>{consent}</span>
      </Label>
      <TurnstileBox />
      <Button type="submit" disabled={busy || !live}>{labels.submitSignUp}</Button>
      {statusLine(message)}
    </form>
  );
}

export function VerifyForm({ labels, token }: { labels: AccountLabels; token: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await authClient.verifyEmail({ query: { token } });
    setBusy(false);
    if (result.error) setMessage(labels.failed);
  }

  return (
    <form className="form" method="post" onSubmit={onSubmit}>
      <p className="hint">{labels.verifyBody}</p>
      <Button type="submit" disabled={busy || token.length === 0}>{labels.verifyAction}</Button>
      {statusLine(message)}
    </form>
  );
}

export function RecoverForm({ locale, labels, emailLabel, token }: { locale: Locale; labels: AccountLabels; emailLabel: string; token: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const choosing = token.length > 0;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = choosing
      ? await authClient.resetPassword({ newPassword: password, token })
      : await authClient.requestPasswordReset({
        email,
        redirectTo: `/${locale}/cuenta/recuperar`,
        fetchOptions: { headers: { "x-turnstile-token": turnstileValue() } },
      });
    setBusy(false);
    if (result.error) setMessage(labels.failed);
  }

  return (
    <form className="form" method="post" onSubmit={onSubmit}>
      {choosing
        ? (
          <Label className="field" htmlFor="account-password">
            {labels.password}
            <Input id="account-password" name="password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={12} />
          </Label>
        )
        : (
          <Label className="field" htmlFor="account-email">
            {emailLabel}
            <Input id="account-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Label>
        )}
      {choosing ? null : <TurnstileBox />}
      <Button type="submit" disabled={busy}>{choosing ? labels.recoverChoose : labels.recoverSend}</Button>
      {statusLine(message)}
    </form>
  );
}

function totpSecret(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export function SecurityPanel({ locale, labels }: { locale: Locale; labels: AccountLabels }) {
  const { data: session, isPending } = authClient.useSession();
  const [sessions, setSessions] = useState<Array<{ token: string }>>([]);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState("");
  const [backup, setBackup] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    void authClient.listSessions().then((result) => {
      const rows = Array.isArray(result.data) ? result.data : [];
      setSessions(rows.map((row) => ({ token: row.token })));
    });
  }, [session]);

  if (isPending) return null;
  if (!session) {
    return (
      <section className="form">
        <p className="hint">{labels.signedOut}</p>
        <Button asChild><a href={`/${locale}/cuenta/ingresar`}>{labels.signIn}</a></Button>
      </section>
    );
  }

  return (
    <div className="forms">
      <section className="form">
        <h2>{labels.passkey}</h2>
        <Button type="button" onClick={() => void authClient.passkey.addPasskey({ name: "enrailar" }).then((result) => {
          if (result.error) setMessage(labels.failed);
        })}>{labels.passkeyAdd}</Button>
      </section>
      <section className="form">
        <h2>{labels.totp}</h2>
        <Label className="field" htmlFor="account-totp-password">
          {labels.password}
          <Input id="account-totp-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Label>
        <Label className="field" htmlFor="account-code">
          {labels.code}
          <Input id="account-code" name="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} />
        </Label>
        {secret.length > 0
          ? (
            <p className="hint">
              {labels.secretHint} <code>{secret}</code>
            </p>
          )
          : null}
        {backup.length > 0
          ? (
            <div>
              <p className="hint">{labels.backup}</p>
              <ul className="saved-intents">
                {backup.map((item) => <li key={item}><code>{item}</code></li>)}
              </ul>
            </div>
          )
          : null}
        <div className="actions">
          <Button type="button" onClick={() => void authClient.twoFactor.enable({ password }).then((result) => {
            if (result.error || !result.data || !("totpURI" in result.data)) {
              setMessage(labels.failed);
              return;
            }
            setMessage(null);
            setSecret(totpSecret(result.data.totpURI));
            setBackup(result.data.backupCodes);
          })}>{labels.totpOn}</Button>
          <Button type="button" onClick={() => void authClient.twoFactor.verifyTotp({ code }).then((result) => {
            if (result.error) setMessage(labels.failed);
            else setMessage(null);
          })}>{labels.confirm}</Button>
          <Button variant="ghost" type="button" onClick={() => void authClient.twoFactor.disable({ password }).then((result) => {
            if (result.error) setMessage(labels.failed);
            else {
              setMessage(null);
              setSecret("");
              setBackup([]);
            }
          })}>{labels.totpOff}</Button>
        </div>
      </section>
      <section className="form">
        <h2>{labels.sessions}</h2>
        <ul className="saved-intents">
          {sessions.map((row) => (
            <li key={row.token.slice(0, 8)} style={{ display: "inline-flex" }}>
              <Button variant="ghost" type="button" onClick={() => void authClient.revokeSession({ token: row.token }).then(() => {
                setSessions((current) => current.filter((item) => item.token !== row.token));
              })}>{labels.revoke}</Button>
            </li>
          ))}
        </ul>
      </section>
      {statusLine(message)}
    </div>
  );
}

function turnstileValue(): string {
  const node = document.querySelector<HTMLTextAreaElement | HTMLInputElement>("[name=cf-turnstile-response]");
  return node?.value ?? "";
}

function TurnstileBox() {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const siteKey = document.documentElement.dataset.turnstile ?? "";
    if (!node || siteKey.length === 0) return;
    const api = (globalThis as { turnstile?: { render: (el: HTMLElement, opts: { sitekey: string }) => void } }).turnstile;
    if (!api || node.childElementCount > 0) return;
    api.render(node, { sitekey: siteKey });
  }, [node]);
  return <div className="turnstile-slot" ref={setNode} />;
}
