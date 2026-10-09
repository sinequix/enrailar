import { CONSENT_COPY, HACKATRAIN_START, HACKATRAIN_WHEN } from "@enrailar/shared";
import { notFound } from "next/navigation";
import { Countdown } from "../countdown.tsx";
import { HtmlLang } from "../components/html-lang.tsx";
import { DroneIcon, MapIcon, PeopleIcon } from "../components/icons.tsx";
import { JoinForms } from "../components/join.tsx";
import { SyntheticFigure } from "../components/picture.tsx";
import { SiteFooter } from "../components/site-footer.tsx";
import { SiteHeader } from "../components/site-header.tsx";
import { COPY, isLocale, type Locale, OG_IMAGE, POST_SLUG, SITE_URL } from "../../src/copy.ts";
import { turnstileSiteKeyFromProcess } from "../../src/turnstile.ts";

export function generateStaticParams() {
  return [{ locale: "es" }, { locale: "en" }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = COPY[locale];
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: `${SITE_URL}/${locale}`,
      languages: { es: `${SITE_URL}/es`, en: `${SITE_URL}/en` },
    },
    openGraph: {
      type: "website",
      siteName: "Enrailar",
      title: copy.title,
      description: copy.description,
      url: `${SITE_URL}/${locale}`,
      locale: locale === "es" ? "es_AR" : "en_US",
      images: [OG_IMAGE],
    },
  };
}

const CARD_ICONS = [MapIcon, PeopleIcon, DroneIcon];

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <HomePage locale={locale} />;
}

function HomePage({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  // Binding del Worker en runtime (TURNSTILE_SITE_KEY) o .env local. Vacío en prerender.
  const siteKey = turnstileSiteKeyFromProcess();
  const labels = {
    email: copy.email,
    linkedin: copy.linkedin,
    message: copy.message,
    intent: copy.intent,
    intents: copy.intents,
    send: copy.send,
    sending: copy.sending,
    accepted: copy.accepted,
    rejected: copy.rejected,
    fields: copy.fields,
    turnstileMissing: copy.turnstileMissing,
    turnstileLoading: copy.turnstileLoading,
  };
  const digitLabels: [string, string, string, string] = locale === "es"
    ? ["días", "horas", "min", "seg"]
    : ["days", "hours", "min", "sec"];

  return (
    <>
      <HtmlLang locale={locale} />
      <a className="skip" href="#contenido">{copy.skip}</a>
      <SiteHeader locale={locale} />
      <main id="contenido" lang={locale}>
        <section className="hero">
          <div className="wrap">
            <div className="hero-grid">
              <div>
                <p className="eyebrow eyebrow--sol reveal">{copy.heroEyebrow}</p>
                <h1 className="reveal">{copy.visionTitle}</h1>
                <p className="lede reveal reveal--2">{copy.heroLede}</p>
                <div className="actions reveal reveal--2">
                  <a className="btn" href="#sumate">{copy.ctaJoin}</a>
                  <a className="btn btn--ghost" href={`/${locale}/blog/${POST_SLUG}`}>{copy.ctaBlog}</a>
                </div>
              </div>
              <aside className="hero-aside reveal reveal--3">
                <dl>
                  {copy.heroFacts.map((fact) => (
                    <div key={fact.label}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              </aside>
            </div>
            <SyntheticFigure
              name="hero-pampa"
              variant="hero"
              priority
              locale={locale}
              alt={locale === "es"
                ? "Vía férrea recta hacia el horizonte en la pampa, con sierras al fondo y cielo celeste."
                : "Straight railway track toward the horizon across the pampa, hills in the distance under a pale blue sky."}
              caption={copy.captionHero}
              sizes="(max-width: 72rem) 100vw, 1152px"
            />
          </div>
        </section>

        <section className="section" id="vision">
          <div className="wrap split">
            <div>
              <p className="eyebrow">{copy.visionEyebrow}</p>
              <h2>{copy.visionHeading}</h2>
              {copy.vision.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <ul className="principles">
              {copy.principles.map((principle) => (
                <li key={principle.title}>
                  <strong>{principle.title}</strong>
                  <span>{principle.body}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section section--alt" id="fase-1">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow eyebrow--sol">{copy.phaseEyebrow}</p>
              <h2>{copy.phaseTitle}</h2>
              <p className="lede">{copy.phaseBody[0]}</p>
            </div>
            <div className="split" style={{ marginBottom: "var(--s-6)" }}>
              <SyntheticFigure
                name="robot-inspeccion"
                locale={locale}
                alt={locale === "es"
                  ? "Robot de inspección blanco y celeste sobre la vía, con panel solar y sensor LiDAR, y un dron sobrevolando."
                  : "White and pale-blue inspection robot on the track with a solar panel and LiDAR sensor, a drone flying above."}
                caption={copy.captionRobot}
                sizes="(max-width: 960px) 100vw, 560px"
              />
              <p>{copy.phaseBody[1]}</p>
            </div>
            <div className="cards">
              {copy.phaseCards.map((card, index) => {
                const Icon = CARD_ICONS[index];
                return (
                  <article className="card" key={card.title}>
                    <Icon className="icon" />
                    <h3>{card.title}</h3>
                    <p>{card.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section" id="que-viene">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">{copy.nextEyebrow}</p>
              <h2>{copy.nextTitle}</h2>
              <p className="lede">{copy.nextLede}</p>
            </div>
            <ol className="line-diagram">
              {copy.stations.map((station, index) => (
                <li key={station.title} className={index === 0 ? "is-now" : undefined}>
                  <span className="when">{station.when}</span>
                  <span className="station">{station.title}</span>
                  <p>{station.body}</p>
                </li>
              ))}
            </ol>
            <div className="split" style={{ marginTop: "var(--s-7)" }}>
              <SyntheticFigure
                name="estacion-renovada"
                locale={locale}
                alt={locale === "es"
                  ? "Estación de ladrillo renovada con galería blanca, casilleros celestes en el andén y vías al atardecer."
                  : "Renovated brick station with a white gallery, pale-blue lockers on the platform and tracks at dusk."}
                caption={copy.captionStation}
                sizes="(max-width: 960px) 100vw, 560px"
              />
              <div>
                <h3>{copy.stations[1].title}</h3>
                <p>{copy.stations[1].body}</p>
                <p>{copy.stations[2].body}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section section--dark" id="hackatrain">
          <div className="wrap event">
            <div>
              <p className="eyebrow">{copy.hackatrainEyebrow}</p>
              <p className="when-big">{copy.hackatrainTitle}</p>
              {copy.hackatrain.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <ul>
                {copy.hackatrainPoints.map((point) => <li key={point}>{point}</li>)}
              </ul>
              <a className="btn btn--sol" href="#sumate">{copy.hackatrainCta}</a>
            </div>
            <aside className="clock" aria-labelledby="clock-title">
              <p className="eyebrow" id="clock-title">{copy.countdownLabel}</p>
              {HACKATRAIN_START
                ? <Countdown target={HACKATRAIN_START} labels={digitLabels} />
                : <p className="when">{HACKATRAIN_WHEN[locale]}</p>}
              <p className="note">{copy.countdownNote}</p>
            </aside>
          </div>
        </section>

        <section className="section section--band join" id="sumate">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow eyebrow--sol">{copy.nav.join}</p>
              <h2>{copy.participate}</h2>
              <p className="lede">{copy.joinLede}</p>
              <p className="consent-note">{CONSENT_COPY}</p>
            </div>
            <JoinForms locale={locale} labels={labels} copy={copy} initialSiteKey={siteKey} />
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
