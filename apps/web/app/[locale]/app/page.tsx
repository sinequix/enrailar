import { notFound } from "next/navigation";
import { readAccess } from "../../access.ts";
import { AppShell } from "../../components/app-shell.tsx";
import { COPY, isLocale, POST_SLUG } from "../../../src/copy.ts";
import { loadHome } from "../../../src/app-data.ts";

export const dynamic = "force-dynamic";

export default async function AppHomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  const { access, db } = await readAccess();
  const home = access.user && db ? await loadHome(db, access.user.email) : { intents: [] };
  return (
    <AppShell
      locale={locale}
      path="/app"
      title={copy.app.home}
      skip={copy.skip}
      navLabel={copy.app.nav}
      home={copy.app.home}
      profile={copy.app.profile}
      security={copy.app.security}
      admin={copy.app.admin}
      showAdmin={access.decision === "ok"}
    >
      <section className="card">
        <h2>{copy.app.intents}</h2>
        {home.intents.length === 0
          ? <p className="hint">{copy.app.intentsEmpty}</p>
          : (
            <ul className="saved-intents">
              {home.intents.map((intent) => <li key={intent}>{copy.intents[intent]}</li>)}
            </ul>
          )}
      </section>
      <section className="card">
        <h2>{copy.app.news}</h2>
        <a className="post-card" href={`/${locale}/blog/${POST_SLUG}`}>
          <strong>{copy.postTitle}</strong>
          <p>{copy.postDeck}</p>
        </a>
      </section>
    </AppShell>
  );
}
