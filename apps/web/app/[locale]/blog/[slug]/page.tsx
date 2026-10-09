import { notFound } from "next/navigation";
import { HtmlLang } from "../../../components/html-lang.tsx";
import { SiteFooter } from "../../../components/site-footer.tsx";
import { SiteHeader } from "../../../components/site-header.tsx";
import { ARTICLE_URL, COPY, isLocale, OG_IMAGE, SITE_URL } from "../../../../src/copy.ts";
import { POSTS } from "../../../../src/posts.ts";

export function generateStaticParams() {
  return [
    { locale: "es", slug: "fase-1" },
    { locale: "en", slug: "fase-1" },
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || POSTS[locale].slug !== slug) return {};
  const copy = COPY[locale];
  return {
    title: `${copy.postTitle} · Enrailar`,
    description: copy.postDeck,
    alternates: {
      canonical: `${SITE_URL}/${locale}/blog/${slug}`,
      languages: { es: `${SITE_URL}/es/blog/${slug}`, en: `${SITE_URL}/en/blog/${slug}` },
    },
    openGraph: {
      type: "article",
      siteName: "Enrailar",
      title: copy.postTitle,
      description: copy.postDeck,
      url: `${SITE_URL}/${locale}/blog/${slug}`,
      images: [OG_IMAGE],
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const post = POSTS[locale];
  if (post.slug !== slug) notFound();
  const copy = COPY[locale];
  return (
    <>
      <HtmlLang locale={locale} />
      <a className="skip" href="#contenido">{copy.skip}</a>
      <SiteHeader locale={locale} path={`/blog/${post.slug}`} />
      <main id="contenido" className="wrap" lang={locale}>
        <article className="article">
          <p className="eyebrow eyebrow--sol">{copy.phase}</p>
          <h1>{post.title}</h1>
          <p className="source">
            {copy.postSource}: <a href={ARTICLE_URL}>{ARTICLE_URL}</a>
          </p>
          {post.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </article>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
