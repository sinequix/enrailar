import { ROLE_MAILBOXES } from "@enrailar/shared";
import { COPY, type Locale, REPO_URL } from "../../src/copy.ts";

export function SiteFooter({ locale }: { locale: Locale }) {
  const copy = COPY[locale];
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div>
          <img src="/brand/logo-horizontal.svg" width={148} height={32} alt="Enrailar" loading="lazy" />
          <p className="tagline">{copy.tagline}</p>
          <p>{copy.footer.about}</p>
        </div>
        <div>
          <h4>{copy.footer.mailboxes}</h4>
          <ul>
            {ROLE_MAILBOXES.map((mailbox) => (
              <li key={mailbox}>
                <a href={`mailto:${mailbox}`}>{mailbox}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>{copy.footer.project}</h4>
          <ul>
            <li><a href={REPO_URL}>{copy.footer.code}</a></li>
            <li><a href={`${REPO_URL}/blob/main/LICENSE`}>{copy.footer.license}</a></li>
            <li><a href={`/${locale}/blog`}>{copy.blogTitle}</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
