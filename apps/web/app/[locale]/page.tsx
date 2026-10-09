import { CONSENT_COPY } from "@enrailar/shared";
import { notFound } from "next/navigation";
import { Countdown } from "../countdown.tsx";
import { PublicForm } from "../forms.tsx";
import { COPY, isLocale, POST_SLUG } from "../../src/copy.ts";

export function generateStaticParams() {
  return [{ locale: "es" }, { locale: "en" }];
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  const other = locale === "es" ? "en" : "es";
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const labels = {
    email: copy.email,
    linkedin: copy.linkedin,
    message: copy.message,
    intent: copy.intent,
    intents: copy.intents,
    send: copy.send,
    accepted: copy.accepted,
    rejected: copy.rejected,
    fields: copy.fields,
    turnstileMissing: copy.turnstileMissing,
  };
  return (
    <main className="wrap" lang={locale}>
      <header className="site">
        <a className="mark" href={`/${locale}`}>ENRAILAR</a>
        <nav className="langs" aria-label={copy.language}>
          <a href={`/${other}`}>{other.toUpperCase()}</a>
          <a href={`/${locale}/blog`}>{copy.blogTitle}</a>
        </nav>
      </header>
      <div className="hero">
        <div>
          <p className="kicker">{copy.phase}</p>
          <h1>{copy.visionTitle}</h1>
          {copy.vision.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <aside className="clock">
          <p className="kicker">{copy.countdownLabel}</p>
          <Countdown labels={locale === "es" ? ["días", "horas", "min", "seg"] : ["days", "hours", "min", "sec"]} />
          <p className="note">{copy.countdownNote}</p>
        </aside>
      </div>
      <section>
        <h2>{copy.phaseTitle}</h2>
        {copy.phaseBody.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>
      <section>
        <h2>{copy.hackatrainTitle}</h2>
        {copy.hackatrain.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <p><a href={`/${locale}/blog/${POST_SLUG}`}>{copy.postTitle}</a></p>
      </section>
      <section id="participar">
        <h2>{copy.participate}</h2>
        <p className="note">{CONSENT_COPY}</p>
        <PublicForm kind="preinscripcion" title={copy.preinscription} locale={locale} labels={labels} siteKey={siteKey} />
        <PublicForm kind="contacto" title={copy.contact} locale={locale} labels={labels} siteKey={siteKey} />
        <PublicForm kind="newsletter" title={copy.newsletter} locale={locale} labels={labels} siteKey={siteKey} />
      </section>
    </main>
  );
}
