import { notFound } from "next/navigation";
import { COPY, isLocale, POST_SLUG } from "../../../src/copy.ts";

export function generateStaticParams() {
  return [{ locale: "es" }, { locale: "en" }];
}

export default async function Blog({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  const other = locale === "es" ? "en" : "es";
  return (
    <main className="wrap" lang={locale}>
      <header className="site">
        <a className="mark" href={`/${locale}`}>ENRAILAR</a>
        <nav className="langs">
          <a href={`/${other}/blog`}>{other.toUpperCase()}</a>
        </nav>
      </header>
      <h1>{copy.blogTitle}</h1>
      <div className="posts">
        <a href={`/${locale}/blog/${POST_SLUG}`}>
          <strong>{copy.postTitle}</strong>
          <p>{copy.postDeck}</p>
        </a>
      </div>
    </main>
  );
}
