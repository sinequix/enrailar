import { notFound } from "next/navigation";
import { HtmlLang } from "../../components/html-lang.tsx";
import { SiteFooter } from "../../components/site-footer.tsx";
import { SiteHeader } from "../../components/site-header.tsx";
import { COPY, isLocale, OG_IMAGE, POST_SLUG, SITE_URL } from "../../../src/copy.ts";

export function generateStaticParams() {
  return [{ locale: "es" }, { locale: "en" }];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = COPY[locale];
  return {
    title: `${copy.blogTitle} · Enrailar`,
    description: copy.blogDeck,
    alternates: {
      canonical: `${SITE_URL}/${locale}/blog`,
      languages: { es: `${SITE_URL}/es/blog`, en: `${SITE_URL}/en/blog` },
    },
    openGraph: {
      type: "website",
      siteName: "Enrailar",
      title: `${copy.blogTitle} · Enrailar`,
      description: copy.blogDeck,
      url: `${SITE_URL}/${locale}/blog`,
      images: [OG_IMAGE],
    },
  };
}

export default async function Blog({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const copy = COPY[locale];
  return (
    <>
      <HtmlLang locale={locale} />
      <a className="skip" href="#contenido">{copy.skip}</a>
      <SiteHeader locale={locale} path="/blog" />
      <main id="contenido" className="wrap section" lang={locale}>
        <div className="section-head">
          <p className="eyebrow">{copy.nav.blog}</p>
          <h1>{copy.blogTitle}</h1>
          <p className="lede">{copy.blogDeck}</p>
        </div>
        <div className="posts">
          <a className="post-card" href={`/${locale}/blog/${POST_SLUG}`}>
            <strong>{copy.postTitle}</strong>
            <p>{copy.postDeck}</p>
          </a>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
