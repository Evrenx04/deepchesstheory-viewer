import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { NAG_SYMBOLS, type MoveNode } from "../lib/pgnTree";
import { formatSan, type Notation } from "../lib/notation";
import { useNotation } from "../lib/notationContext";
import { RichInline, RichText } from "./RichText";
import { t } from "../lib/i18n";
import { CONTROLLER } from "../lib/privacy";

/**
 * Under a note or a card summary: where to write about a mistake (2026-10-28 proposal). The email opens with the page's
 * address in its body, so the reader does not have to say where they were.
 */
export function ReportLine({ where }: { where?: string }) {
  const subject = t("Hata bildirimi");
  const body = `${t("Sayfa")}: ${window.location.href}${where ? `\n${t("Yer")}: ${where}` : ""}\n\n`;
  const href = `mailto:${CONTROLLER.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <p className="report-line">
      {t("Bir hata ya da eksik mi gördün?")} <a href={href}>{CONTROLLER.email}</a>
    </p>
  );
}

/** Top right of an opened piece: closes it again, and whatever was opened after it (user, 2026-10-26). */
export function HideButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="piece-hide" onClick={onClick}>
      {t("Gizle")}
    </button>
  );
}

/** The Devam button says how much is still closed: "4 / 4" read as if the last piece were already open. */
export const moreLabel = (left: number) => (left === 1 ? t("Devam · son parça") : t("Devam · {n} parça daha", { n: left }));

interface Props {
  node: MoveNode;
  /** Chapter overview, shown while the reader is at the chapter's start. */
  intro?: string;
  introDeep?: string;
  showDeep: boolean;
  onToggleDeep: () => void;
  goals?: string[];
  takeaways?: string[];
  /** Shown above the comment, e.g. after a quiz answer. */
  banner?: string;
  /** A question is open here: no "no comment" line, which would tell the reader something about the answer. */
  question?: boolean;
  /** At a line chapter's start: the goals and the introduction open one bubble at a time, "Başla" leads to the first move. */
  reveal?: { firstMove?: string; onStart: () => void };
}

export function moveLabel(node: MoveNode, notation: Notation) {
  if (!node.ply) return t("Başlangıç konumu");
  const number = Math.ceil(node.ply / 2);
  return `${number}${node.ply % 2 ? "." : "…"}${formatSan(node.san, notation)}${node.nags.map((n) => NAG_SYMBOLS[n] ?? "").join("")}`;
}

function KeyPoints({ title, items, kind }: { title: string; items?: string[]; kind: string }) {
  if (!items?.length) return null;
  return (
    <div className={`key-points ${kind}`}>
      <div className="key-title">{title}</div>
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            <RichInline text={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A chapter's way in, piece by piece: "Bu bölümde öğreneceklerin" first, then each paragraph of the introduction in its
 * own bubble on "Devam". Nothing is cut: "Hepsini göster" opens the rest, "Başla" goes to the first move at any time.
 */
export function IntroReveal({
  goals,
  intro,
  firstMove,
  onStart,
}: {
  goals?: string[];
  intro?: string;
  firstMove?: string;
  onStart: () => void;
}) {
  const parts = [
    ...(goals?.length ? [<KeyPoints key="goals" title={t("Bu bölümde öğreneceklerin")} items={goals} kind="goals" />] : []),
    ...(intro ?? "")
      .split(/\n\s*\n/)
      .filter((p) => p.trim())
      .map((p, i) => <RichText key={i} text={p} />),
  ];
  const [shown, setShown] = useState(1);
  const all = shown >= parts.length;
  return (
    <div className="intro-reveal" data-tour="intro">
      {parts.slice(0, shown).map((part, i) => (
        <div key={i} className={`intro-bubble${i === 0 ? " first" : ""}`}>
          {i > 0 && <HideButton onClick={() => setShown(i)} />}
          {part}
        </div>
      ))}
      <div className="intro-bar">
        {!all && (
          <button className="intro-more" onClick={() => setShown(shown + 1)}>
            {moreLabel(parts.length - shown)}
          </button>
        )}
        {!all && (
          <button className="intro-all" onClick={() => setShown(parts.length)}>
            {t("Hepsini göster")}
          </button>
        )}
        {firstMove && (
          <button className={`intro-start${all ? " primary-action" : ""}`} onClick={onStart}>
            {t("Başla:")} <span className="san">{firstMove}</span> →
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A long note in pieces: its paragraphs (a list counts as one piece), opened one by one with "Devam". Short notes stay
 * whole: one paragraph, or two with at most LONG_NOTE words. Returns one piece for a note shown whole.
 */
const LONG_NOTE = 80;
export function notePieces(text: string): string[] {
  const pieces: string[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    if (!block.trim()) continue;
    // A list starting under a sentence is its own piece: "…belli:" first, the list on "Devam".
    let current: string[] = [];
    let inList = false;
    for (const line of block.split("\n")) {
      const item = /^\s*(?:[-*]|\d+\.)\s/.test(line);
      if (current.length && item !== inList) {
        pieces.push(current.join("\n"));
        current = [];
      }
      inList = item;
      current.push(line);
    }
    if (current.length) pieces.push(current.join("\n"));
  }
  const words = text.split(/\s+/).filter(Boolean).length;
  return pieces.length > 2 || (pieces.length === 2 && words > LONG_NOTE) ? pieces : [text];
}

// How far each long note was opened, kept while the page is open: back at the same move, the note is as it was left.
const opened = new Map<string, number>();

/** A long note opened piece by piece; "Aklında kalsın" comes as the last piece. "›" still goes to the next move. */
function NoteReveal({ id, text, takeaways }: { id: string; text: string; takeaways?: string[] }) {
  const pieces = notePieces(text);
  const total = pieces.length + (takeaways?.length ? 1 : 0);
  const [shown, setShown] = useState(() => opened.get(id) ?? 1);
  const show = (n: number) => {
    opened.set(id, n);
    setShown(n);
  };
  return (
    <div className="note-reveal">
      <div className="comment-body">
        {pieces.slice(0, shown).map((piece, i) => (
          <div key={i} className={i ? "note-piece" : undefined}>
            {i > 0 && <HideButton onClick={() => show(i)} />}
            <RichText text={piece} />
          </div>
        ))}
      </div>
      {shown > pieces.length && (
        <div className="note-piece">
          <HideButton onClick={() => show(pieces.length)} />
          <KeyPoints title={t("Aklında kalsın")} items={takeaways} kind="takeaways" />
        </div>
      )}
      {shown < total && (
        <div className="intro-bar note-bar">
          <button className="intro-more" onClick={() => show(shown + 1)}>
            {moreLabel(total - shown)}
          </button>
          <button className="intro-all" onClick={() => show(total)}>
            {t("Hepsini göster")}
          </button>
        </div>
      )}
    </div>
  );
}

export function CommentPanel({ node, intro, introDeep, showDeep, onToggleDeep, goals, takeaways, banner, question, reveal }: Props) {
  const notation = useNotation();
  const deep = [introDeep, node.deep].filter(Boolean).join("\n\n");
  const empty = !intro && !node.comment && !deep && !takeaways?.length && !question;
  return (
    <article className="comment-panel" aria-live="polite">
      <div className="comment-move">{moveLabel(node, notation)}</div>
      {banner && <p className="quiz-feedback right">{banner}</p>}
      {reveal && (goals?.length || intro) ? (
        <IntroReveal key={intro ?? ""} goals={goals} intro={intro} firstMove={reveal.firstMove} onStart={reveal.onStart} />
      ) : (
        <>
          <KeyPoints title={t("Bu bölümde öğreneceklerin")} items={goals} kind="goals" />
          {/* A master game's way in opens piece by piece too, like a chapter's (user, 2026-10-26). */}
          {intro && notePieces(intro).length > 1 ? (
            <NoteReveal key={`intro:${intro.slice(0, 40)}`} id={`intro:${intro.slice(0, 40)}`} text={intro} />
          ) : (
            intro && (
              <div className="comment-intro">
                <RichText text={intro} />
              </div>
            )
          )}
        </>
      )}
      {node.comment && notePieces(node.comment).length > 1 ? (
        <NoteReveal key={`${node.id}:${node.comment.length}`} id={`${node.id}:${node.comment.length}`} text={node.comment} takeaways={takeaways} />
      ) : (
        <>
          {node.comment && (
            <div className="comment-body">
              <RichText text={node.comment} />
            </div>
          )}
          <KeyPoints title={t("Aklında kalsın")} items={takeaways} kind="takeaways" />
        </>
      )}
      {empty && <p className="muted">{t("Bu hamlede yorum yok, devam et.")}</p>}
      {deep && (
        <div className={`deep${showDeep ? " open" : ""}`}>
          <button className="deep-toggle" onClick={onToggleDeep} aria-expanded={showDeep}>
            <ChevronDown size={15} />
            {t("Derinlemesine")}

          </button>
          {showDeep && (
            <div className="deep-body">
              <RichText text={deep} />
            </div>
          )}
        </div>
      )}
      {!empty && <ReportLine where={moveLabel(node, notation) || undefined} />}
    </article>
  );
}
