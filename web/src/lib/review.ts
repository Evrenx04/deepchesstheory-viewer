import { localDay, nodeKey, readStored, writeStored } from "./progress";

// Spaced repetition of the reader's own moves. A card is one move the reader must play
// (its parent position is shown); the state is plain JSON, like progress.ts, and every function is pure.

export type CardKind = "move" | "quiz";

export interface Card {
  /** "chapter|node": the node is the move to find. */
  id: string;
  kind: CardKind;
  /** 0..6; see INTERVAL_DAYS. */
  level: number;
  /** When the card is next due (ms). */
  due: number;
  /** When it was last answered; undefined while it has never been shown. */
  last?: number;
  /** Times a card that had been learned was answered wrong. */
  lapses: number;
  /** How often the position is played; higher is more worth knowing. */
  weight?: number;
}

export interface ReviewState {
  /** 2 since node ids are move sequences (docs/dugum-kimligi.md); a version 1 deck is dropped. */
  v: 2;
  cards: Record<string, Card>;
}

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
export const MAX_LEVEL = 6;
/** Days until the next showing, by the level a card has reached. Level 0 is "learning": due at once. */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 90];
/** A wrong answer comes back after this long, two levels lower. */
export const RETRY_MS = 10 * MINUTE;
/** Mastered = level 4 reached: the next showing is 14 or more days away. */
export const MASTERED_LEVEL = 4;

export const emptyReview = (): ReviewState => ({ v: 2, cards: {} });

export const cardId = nodeKey;

/** Adds cards for the given ids (due now); an id that already has a card keeps it, only a given weight is refreshed. */
export function addCards(state: ReviewState, ids: string[], kind: CardKind, now: number, weight?: number): ReviewState {
  const cards = { ...state.cards };
  for (const id of ids) {
    const old = cards[id];
    if (old) {
      if (weight !== undefined && old.weight !== weight) cards[id] = { ...old, weight };
    } else cards[id] = { id, kind, level: 0, due: now, lapses: 0, ...(weight !== undefined && { weight }) };
  }
  return { ...state, cards };
}

/**
 * Right: one level up, due after that level's interval. Wrong: two levels down (floor 0), due in 10 minutes,
 * and a lapse if the card had been learned. A right answer given before the card is due, on the day of the
 * last answer, is noted but does not raise the level again. Unknown ids change nothing.
 */
export function answer(state: ReviewState, id: string, correct: boolean, now: number): ReviewState {
  const card = state.cards[id];
  if (!card) return state;
  let next: Card;
  if (!correct) {
    next = { ...card, level: Math.max(0, card.level - 2), due: now + RETRY_MS, last: now, lapses: card.lapses + (card.level > 0 ? 1 : 0) };
  } else if (now < card.due && card.last !== undefined && localDay(card.last) === localDay(now)) {
    next = { ...card, last: now };
  } else {
    const level = Math.min(MAX_LEVEL, card.level + 1);
    next = { ...card, level, due: now + INTERVAL_DAYS[level] * DAY, last: now };
  }
  return { ...state, cards: { ...state.cards, [id]: next } };
}

// A card that fell back and has not climbed past level 2 yet is being relearned: it goes first.
const relearning = (c: Card) => c.lapses > 0 && c.level <= 2;
const isNew = (c: Card) => c.last === undefined;

/**
 * Cards due at `now`, most urgent first: relearning cards, then by weight (higher first), then oldest due.
 * Never-shown cards count against `newLimit` (default 15); the list is cut at `limit` (default 30).
 */
export function dueCards(state: ReviewState, now: number, { limit = 30, newLimit = 15 }: { limit?: number; newLimit?: number } = {}): Card[] {
  const due = Object.values(state.cards)
    .filter((c) => c.due <= now)
    .sort((a, b) => Number(relearning(b)) - Number(relearning(a)) || (b.weight ?? 0) - (a.weight ?? 0) || a.due - b.due || a.id.localeCompare(b.id));
  let fresh = 0;
  return due.filter((c) => !isNew(c) || fresh++ < newLimit).slice(0, limit);
}

/** True when every listed card exists and has reached level 4 (see MASTERED_LEVEL); false for an empty list. */
export const mastered = (state: ReviewState, ids: string[]): boolean =>
  ids.length > 0 && ids.every((id) => (state.cards[id]?.level ?? 0) >= MASTERED_LEVEL);

export function stats(state: ReviewState, now: number) {
  const cards = Object.values(state.cards);
  return {
    due: cards.filter((c) => c.due <= now).length,
    learning: cards.filter((c) => c.level === 0).length,
    mature: cards.filter((c) => c.level >= MASTERED_LEVEL).length,
    total: cards.length,
  };
}

/** Cards due on each of the next `days` local calendar days; index 0 is tomorrow (what is due today is stats().due). */
export function forecast(state: ReviewState, now: number, days = 7): number[] {
  const d = new Date(now);
  const edges = Array.from({ length: days + 1 }, (_, i) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + i + 1).getTime());
  const out = new Array<number>(days).fill(0);
  for (const c of Object.values(state.cards))
    for (let i = 0; i < days; i++)
      if (c.due >= edges[i] && c.due < edges[i + 1]) {
        out[i]++;
        break;
      }
  return out;
}

export const reviewKey = (studyId: string) => `review:${studyId}`;

export function loadReview(key: string): ReviewState {
  const raw = readStored(key) as Partial<ReviewState> | undefined;
  if (typeof raw !== "object" || raw === null || raw.v !== 2 || typeof raw.cards !== "object" || raw.cards === null) return emptyReview();
  return { v: 2, cards: raw.cards };
}

export const saveReview = (state: ReviewState, key: string): void => writeStored(key, state);
