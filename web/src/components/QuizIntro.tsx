import { Fragment } from "react";
import { Check } from "lucide-react";
import type { MoveNode } from "../lib/pgnTree";
import { L, t } from "../lib/i18n";

interface Props {
  /** The game's question moves (the answers), in the order they come. */
  questions: MoveNode[];
  solved: (id: string) => boolean;
  /** Opens a question's position (the answer's parent). */
  onOpen: (id: string) => void;
}

/** "22." for a White move, "22…" for a Black one: the move number of the question, not the move. */
const moveNumber = (n: MoveNode) => `${Math.ceil(n.ply / 2)}${n.ply % 2 ? "." : "…"}`;

/**
 * Under a master game's players: one line saying where the game stops to ask, each move number a link to its question
 * (user, 2026-10-26: the box above the first note was in the way).
 */
export function QuizIntro({ questions, solved, onOpen }: Props) {
  const moves = questions.map((q, i) => (
    <Fragment key={q.id}>
      {i > 0 && (i === questions.length - 1 ? L(" ve ", " and ") : ", ")}
      <button className={`quiz-note-move${solved(q.id) ? " solved" : ""}`} onClick={() => onOpen(q.parent!)}>
        {moveNumber(q)}
        {solved(q.id) && <Check size={11} aria-label={t("Çözüldü")} />}
      </button>
    </Fragment>
  ));
  return (
    <p className="quiz-note" role="note">
      <span className="quiz-mark">?</span>{" "}
      {L(
        <>
          {questions.length} soru: {moves} hamlede oyun durur, büyük ustanın hamlesini önce sen tahmin et.
        </>,
        <>
          {questions.length === 1 ? "1 question" : `${questions.length} questions`}: the game stops at {questions.length === 1 ? "move" : "moves"} {moves}; guess the
          grandmaster's move first.
        </>,
      )}
    </p>
  );
}
