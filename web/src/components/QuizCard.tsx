import { RichInline } from "./RichText";
import { t } from "../lib/i18n";

interface Props {
  question: string;
  feedback?: { kind: "right" | "wrong" | "other"; text: string };
  onReveal: () => void;
}

export function QuizCard({ question, feedback, onReveal }: Props) {
  return (
    <div className="quiz-card" role="region" aria-label={t("Soru")}>
      <div className="quiz-label">{t("Sıra sende")}</div>
      <p className="quiz-question">
        <RichInline text={question} />
      </p>
      <p className="quiz-hint">{t("Hamleni tahtada yap: taşı sürükle ya da tıkla.")}</p>
      {feedback && <p className={`quiz-feedback ${feedback.kind}`}>{feedback.text}</p>}
      <button className="quiz-reveal" onClick={onReveal}>
        {t("Cevabı göster")}

      </button>
    </div>
  );
}
