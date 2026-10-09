import { notFound } from "next/navigation";
import { ARTICLE_URL, COPY, isLocale } from "../../../../src/copy.ts";
import { POSTS } from "../../../../src/posts.ts";

export function generateStaticParams() {
  return [
    { locale: "es", slug: "fase-1" },
    { locale: "en", slug: "fase-1" },
  ];
}

export default async function PostPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const post = POSTS[locale];
  if (post.slug !== slug) notFound();
  const copy = COPY[locale];
  const other = locale === "es" ? "en" : "es";
  return (
    <main className="wrap" lang={locale}>
      <header className="site">
        <a className="mark" href={`/${locale}`}>ENRAILAR</a>
        <nav className="langs">
          <a href={`/${locale}/blog`}>{copy.blogTitle}</a>
          <a href={`/${other}/blog/${post.slug}`}>{other.toUpperCase()}</a>
        </nav>
      </header>
      <article>
        <p className="kicker">{copy.phase}</p>
        <h1>{post.title}</h1>
        {post.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <p><a href={ARTICLE_URL}>{ARTICLE_URL}</a></p>
      </article>
    </main>
  );
}
