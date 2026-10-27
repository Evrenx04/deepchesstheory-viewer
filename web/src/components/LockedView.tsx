import { useState } from "react";
import { Lock } from "lucide-react";
import { t } from "../lib/i18n";
import { PRIVACY_ROUTE } from "../lib/privacy";
import { subscribe } from "../lib/signup";
import type { ChapterMeta, StudyMeta } from "../lib/study";
import { RichInline } from "./RichText";

interface Props {
  study: StudyMeta;
  meta: ChapterMeta;
  onSelect: (chapterId: string) => void;
}

/**
 * A chapter of the full version (study.json "ucretsiz" lists the free ones): its title and goals, the free
 * chapters to read now, and the waiting list (lib/signup.ts: MailerLite, double opt-in).
 */
export function LockedView({ study, meta, onSelect }: Props) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  // The free chapters to open now (a card's games are reached from its summary).
  const free = study.chapters.filter((c) => !c.locked && c.type !== "game");
  return (
    <div className="locked-view">
      <p className="locked-badge">
        <Lock size={14} /> {t("Tam sürümde")}
      </p>
      {meta.summary && (
        <p className="locked-summary">
          <RichInline text={meta.summary} />
        </p>
      )}
      {meta.goals?.length ? (
        <>
          <h3>{t("Bu bölümde öğreneceklerin")}</h3>
          <ul>
            {meta.goals.map((g, i) => (
              <li key={i}>
                <RichInline text={g} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="locked-box">
        <h3>{t("Kurs açıldığında haber verelim mi?")}</h3>
        <p>{t("Bu bölüm kursun tam sürümünde. Kurs açıldığında ve yeni kurslar çıktığında e-posta gönderiyoruz. Her e-postanın altındaki bağlantıyla istediğin an listeden çıkabilirsin.")}</p>
        {state === "sent" ? (
          <p className="locked-sent" role="status">
            {t("Son bir adım: e-postanı doğrula. Gelen kutuna bir onay e-postası gönderdik; görmezsen spam klasörüne bak.")}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!consent || state === "sending") return;
              setState("sending");
              subscribe(email).then(
                () => setState("sent"),
                () => setState("error"),
              );
            }}
          >
            <input type="email" required placeholder={t("E-posta adresin")} value={email} onChange={(e) => setEmail(e.target.value)} />
            <label className="locked-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                {t("Kurs duyurularını (açılış ve yeni kurslar) e-postayla almayı kabul ediyorum.")}{" "}
                <a href={`#/${PRIVACY_ROUTE}`} target="_blank" rel="noreferrer">
                  {t("Gizlilik metni")}
                </a>
              </span>
            </label>
            <button type="submit" disabled={!consent || !email || state === "sending"}>
              {state === "sending" ? t("Gönderiliyor…") : t("Haber ver")}
            </button>
            {state === "error" && (
              <p className="locked-error" role="alert">
                {t("Gönderilemedi. Biraz sonra yeniden dene.")}
              </p>
            )}
          </form>
        )}
      </div>
      <h3>{t("Şimdi okuyabileceklerin")}</h3>
      <ul className="locked-free">
        {free.map((c) => (
          <li key={c.id}>
            <button className="link-button" onClick={() => onSelect(c.id)}>
              {c.code && <span className="nav-code">{c.code}</span>} <RichInline text={c.title} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
