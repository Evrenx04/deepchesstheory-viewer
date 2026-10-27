import { t } from "../lib/i18n";
import { ArrowRight } from "lucide-react";
import type { MoveNode } from "../lib/pgnTree";
import type { ChapterMeta } from "../lib/study";
import { moveLabel } from "./CommentPanel";
import { RichText } from "./RichText";
import { useNotation } from "../lib/notationContext";

export interface ReviewItem {
  id: string;
  kind: "move" | "quiz";
  meta: ChapterMeta;
  /** The move the reader has to find. */
  node: MoveNode;
  /** The position before it. */
  parent: MoveNode;
}

interface Props {
  item?: ItemState;
  index: number;
  total: number;
  /** Answers so far in this session. */
  right: number;
  wrong: number;
  /** Cards due tomorrow, for the summary. */
  tomorrow: number;
  onReveal: () => void;
  onNext: () => void;
  onOpen: (chapter: string, node: string) => void;
  onExit: () => void;
}

export interface ItemState extends ReviewItem {
  /** Wrong tries on this card. */
  tries: number;
  /** Found (right) or shown (revealed): the card is answered. */
  result?: "right" | "revealed";
  feedback?: string;
}

// The first paragraph of a comment: enough to recall why the move is played.
const firstParagraph = (text: string) => text.split(/\n\s*\n/)[0];

/** The side panel of a review session: one position at a time, the reader plays the move. */
export function ReviewCard({ item, index, total, right, wrong, tomorrow, onReveal, onNext, onOpen, onExit }: Props) {
  const notation = useNotation();
  if (!item)
    return (
      <div className="review-card review-done" role="region" aria-label={t("Tekrar bitti")}>
        <div className="quiz-label">{t("Tekrar bitti")}</div>
        <p className="review-big">
          {total ? t("{total} konumun {right} tanesini ilk denemede buldun.", { total, right }) : t("Bugün tekrar edilecek konum yok.")}
        </p>
        {wrong > 0 && <p className="sim-goal">{t("Bulamadıkların yakında yeniden gelecek; doğru bildiklerin daha seyrek.")}</p>}
        <p className="sim-goal">{t("Yarın {n} konum.", { n: tomorrow })}</p>
        <div className="sim-actions">
          <button className="quiz-reveal primary" onClick={onExit}>
            {t("Panele dön")}
          </button>
        </div>
      </div>
    );
  const white = item.parent.fen.split(" ")[1] === "w";
  const answered = !!item.result;
  return (
    <div className="review-card" role="region" aria-label={t("Tekrar")}>
      <div className="quiz-label">
        {t("Tekrar")} · {index + 1} / {total}
      </div>
      <div className="sim-progress" aria-hidden>
        <div className="sim-bar" style={{ width: `${(index / Math.max(total, 1)) * 100}%` }} />
      </div>
      <p className="review-where">
        {item.meta.code ?? item.meta.title} ·{" "}
        <span className="san">{item.parent.ply ? t("{move} sonrası", { move: moveLabel(item.parent, notation) }) : t("başlangıç")}</span>
      </p>
      <p className="quiz-question">{item.kind === "quiz" && item.node.quiz ? item.node.quiz : white ? t("Beyaz burada ne oynar?") : t("Siyah burada ne oynar?")}</p>
      {!answered && <p className="quiz-hint">{t("Hamleni tahtada yap.")}</p>}
      {item.feedback && <p className={`quiz-feedback ${item.result === "right" ? "right" : item.result ? "other" : "wrong"}`}>{item.feedback}</p>}
      {answered && item.node.comment && (
        <div className="sim-end-note">
          <RichText text={firstParagraph(item.node.comment)} />
        </div>
      )}
      <div className="sim-actions">
        {!answered && (
          <button className="quiz-reveal" onClick={onReveal}>
            {t("Cevabı gör")}
          </button>
        )}
        {answered && (
          <>
            <button className="quiz-reveal" onClick={() => onOpen(item.meta.id, item.node.id)}>
              {t("Bölümde aç")}
            </button>
            <button className="quiz-reveal primary" onClick={onNext} autoFocus>
              {index + 1 < total ? t("Sıradaki") : t("Bitir")} <ArrowRight size={14} />
            </button>
          </>
        )}
        <button className="quiz-reveal" onClick={onExit}>
          {t("Çık")}
        </button>
      </div>
      <p className="sim-count">
        {t("Bu oturumda: {right} doğru · {wrong} yanlış", { right, wrong })}

      </p>
    </div>
  );
}
