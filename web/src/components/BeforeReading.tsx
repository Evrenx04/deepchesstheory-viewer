import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { RichText } from "./RichText";
import { t, type Lang } from "../lib/i18n";

/** The language note under the switch, in both languages (the reader may not read the default one). */
const NOTE = {
  tr: "(Dili ⚙ Ayarlar'dan istediğin zaman değiştirebilirsin.)",
  en: "(You can change it any time in ⚙ Settings.)",
};

export interface ReadingPage {
  title: string;
  text: string;
}

/**
 * "Başlamadan önce oku": the course's note to the reader, a few short pages in a box in the middle of the screen.
 * The reader steps through them with İleri / Geri (or the arrow keys); however it is closed, it does not open by itself
 * again (⚙ Ayarlar reopens it). The first page also offers the language (the default may be one the reader does not
 * read); `onLang` stores the choice and reloads the page.
 */
export function BeforeReading({
  pages,
  onClose,
  lang,
  onLang,
}: {
  pages: ReadingPage[];
  onClose: () => void;
  lang: Lang;
  onLang: (lang: Lang) => void;
}) {
  const [index, setIndex] = useState(0);
  const next = useRef<HTMLButtonElement>(null);
  const last = index === pages.length - 1;
  const page = pages[index];
  useEffect(() => next.current?.focus(), [index]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, pages.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, pages.length]);
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="before-reading-title">
        <div className="modal-head">
          <div>
            <span className="modal-kicker">{t("Başlamadan önce oku")}</span>
            <h2 id="before-reading-title">{page.title}</h2>
          </div>
          <div className="modal-head-end">
            {index === 0 && <LangChoice lang={lang} onLang={onLang} />}
            <button className="modal-close" aria-label={t("Kapat")} onClick={() => onClose()}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="modal-body" key={index}>
          <RichText text={page.text} />
        </div>
        <div className="modal-foot">
          <div className="modal-dots" aria-label={t("Sayfa {n} / {total}", { n: index + 1, total: pages.length })}>
            {pages.map((p, i) => (
              <button
                key={i}
                className={i === index ? "active" : ""}
                aria-label={t("{n}. sayfa: {title}", { n: i + 1, title: p.title })}
                aria-current={i === index || undefined}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
          <div className="modal-nav">
            {index > 0 && (
              <button className="modal-back" onClick={() => setIndex(index - 1)}>
                {t("Geri")}
              </button>
            )}
            <button ref={next} className="modal-start" onClick={() => (last ? onClose() : setIndex(index + 1))}>
              {last ? t("Anladım, başla") : t("İleri")}

            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Türkçe / English, with the note in both languages: on the first screen a reader sees. */
export function LangChoice({ lang, onLang }: { lang: Lang; onLang: (lang: Lang) => void }) {
  return (
    <div className="modal-lang">
      <div className="segmented" role="group" aria-label="Dil / Language">
        {(
          [
            ["tr", "Türkçe"],
            ["en", "English"],
          ] as [Lang, string][]
        ).map(([v, text]) => (
          <button key={v} className={v === lang ? "active" : ""} aria-pressed={v === lang} onClick={() => onLang(v)}>
            {text}
          </button>
        ))}
      </div>
      <span className="modal-lang-note">
        {(lang === "tr" ? [NOTE.tr, NOTE.en] : [NOTE.en, NOTE.tr]).map((line) => (
          <span key={line}>{line}</span>
        ))}
      </span>
    </div>
  );
}
