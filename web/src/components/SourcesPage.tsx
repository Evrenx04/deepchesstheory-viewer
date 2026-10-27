import { ArrowLeft, BookOpen } from "lucide-react";
import { useEffect } from "react";
import { L, t } from "../lib/i18n";
import { PRIVACY, PRIVACY_EN, PRIVACY_ROUTE } from "../lib/privacy";
import { NOTICES_FILE, SOURCES, SOURCES_EN, SOURCES_ROUTE, SOURCES_TEXT, SOURCES_TEXT_EN } from "../lib/sources";

const text = () => L(SOURCES_TEXT, SOURCES_TEXT_EN);

/** #/kaynaklar: the data, tools and code the site is built on, with their licenses (texts in lib/sources.ts, both languages). */
export function SourcesPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const tx = text();
  const back = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = "#/";
  };
  return (
    <div className="home">
      <header className="topbar">
        <a className="brand" href="#/" title={tx.home}>
          <BookOpen size={18} />
          <span>{t("Açılış Çalışması")}</span>
        </a>
      </header>
      <main className="sources">
        <button className="sources-back" onClick={back}>
          <ArrowLeft size={15} /> {tx.back}
        </button>
        <h1>{tx.title}</h1>
        <p className="home-lead">{tx.lead}</p>
        {L(SOURCES, SOURCES_EN).map((section) => (
          <section key={section.title} className="sources-section">
            <h2>{section.title}</h2>
            {section.intro?.map((p) => <p key={p}>{p}</p>)}
            <ul>
              {section.items.map((item) => (
                <li key={item.name}>
                  <div className="sources-name">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.name}
                      </a>
                    ) : (
                      <strong>{item.name}</strong>
                    )}
                    {item.license && <span className="sources-license">{item.license}</span>}
                  </div>
                  <p>{item.text}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="sources-notices">
          {tx.noticesLead}{" "}
          <a href={`${import.meta.env.BASE_URL}${NOTICES_FILE}`} target="_blank" rel="noreferrer">
            {tx.noticesLink}
          </a>
        </p>
      </main>
    </div>
  );
}

/** The small links to this page and the privacy page, at the foot of the front page and the course panel. */
export function SourcesLink() {
  return (
    <footer className="site-foot">
      <a href={`#/${SOURCES_ROUTE}`}>{text().link}</a>
      <span aria-hidden="true"> · </span>
      <a href={`#/${PRIVACY_ROUTE}`}>{L(PRIVACY, PRIVACY_EN).link}</a>
    </footer>
  );
}
