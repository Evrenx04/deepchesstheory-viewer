import { ArrowLeft, BookOpen } from "lucide-react";
import { useEffect } from "react";
import { L, t } from "../lib/i18n";
import { PRIVACY, PRIVACY_EN } from "../lib/privacy";
import { SOURCES_TEXT, SOURCES_TEXT_EN } from "../lib/sources";

/** #/gizlilik: the KVKK notice in Turkish, the GDPR notice in English (texts in lib/privacy.ts). Laid out like #/kaynaklar. */
export function PrivacyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const tx = L(PRIVACY, PRIVACY_EN);
  const nav = L(SOURCES_TEXT, SOURCES_TEXT_EN);
  const back = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = "#/";
  };
  return (
    <div className="home">
      <header className="topbar">
        <a className="brand" href="#/" title={nav.home}>
          <BookOpen size={18} />
          <span>{t("Açılış Çalışması")}</span>
        </a>
      </header>
      <main className="sources">
        <button className="sources-back" onClick={back}>
          <ArrowLeft size={15} /> {nav.back}
        </button>
        <h1>{tx.title}</h1>
        <p className="sources-updated">{tx.updated}</p>
        <p className="home-lead">{tx.lead}</p>
        {tx.sections.map((section) => (
          <section key={section.title} className="sources-section privacy-section">
            <h2>{section.title}</h2>
            {section.paragraphs.slice(0, section.list ? 1 : undefined).map((p) => (
              <p key={p}>{p}</p>
            ))}
            {section.list && (
              <ul>
                {section.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
            {section.list && section.paragraphs.slice(1).map((p) => <p key={p}>{p}</p>)}
          </section>
        ))}
      </main>
    </div>
  );
}
