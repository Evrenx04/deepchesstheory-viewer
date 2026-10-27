import { useEffect, useRef } from "react";
import { LangChoice } from "./BeforeReading";
import { t, type Lang } from "../lib/i18n";

/**
 * The first screen of a course on the reader's first visit: what the course is and how to work through it, in three
 * short paragraphs, and one button. It has no close button: "Başla" leads into the tour (Tour.tsx), which the first
 * visit does not skip (docs/arayuz-yenileme.md). "Başlamadan önce oku" stays whole in ⚙ Ayarlar.
 */
export function Welcome({ title, lang, onLang, onStart }: { title: string; lang: Lang; onLang: (lang: Lang) => void; onStart: () => void }) {
  const start = useRef<HTMLButtonElement>(null);
  useEffect(() => start.current?.focus(), []);
  return (
    <div className="modal-backdrop welcome-backdrop">
      <div className="modal welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div className="modal-head">
          <div>
            <h2 id="welcome-title">{t("Hoş geldin")}</h2>
            <span className="welcome-course">{title}</span>
          </div>
          <div className="modal-head-end">
            <LangChoice lang={lang} onLang={onLang} />
          </div>
        </div>
        <div className="modal-body welcome-body">
          <p>{t("Bu kurs açılışı ezber değil fikir olarak öğretir. Her bölümde ana hattı hamle hamle okursun; not, hamlenin nedenini anlatır.")}</p>
          <p>{t("Önemli anlarda site durur ve hamleyi sana sorar. Öğrendiğini Simüle et ve Rakibe karşı oyna ile tahtada sınarsın.")}</p>
          <p className="welcome-note">{t("Başla'ya bas: kısa bir tur (yaklaşık bir dakika) siteyi gösterir. Turu sonra ⚙ Ayarlar'dan yeniden açabilirsin.")}</p>
        </div>
        <div className="modal-foot welcome-foot">
          <button ref={start} className="modal-start welcome-start" onClick={onStart}>
            {t("Başla")}
          </button>
        </div>
      </div>
    </div>
  );
}
