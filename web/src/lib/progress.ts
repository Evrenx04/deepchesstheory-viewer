import type { MoveTree } from "./pgnTree";
import type { ChapterMeta } from "./study";

// What the reader has done, as one small versioned JSON value per study. It lives in localStorage for now
// and has no browser types in it, so it can be sent to a server account later as it is.
// All updaters are pure: they return a new state and take the time as an argument.

export interface ChapterProgress {
  /** Line ends of the quick path the reader reached while reading. */
  leaves: string[];
  /** Line ends the reader simulated without a miss. */
  drilled: string[];
  /** Prose/game chapters: when the reader marked it finished. */
  done?: number;
  /** When the chapter was first opened. */
  opened?: number;
}

export interface QuizRecord {
  /** When the question was last solved. */
  at: number;
  /** Whether the first answer ever given was right. */
  firstTry: boolean;
}

export interface Progress {
  /** 2 since node ids are move sequences (docs/dugum-kimligi.md); version 1 stored tree paths. */
  v: 2;
  chapters: Record<string, ChapterProgress>;
  /** "chapter|node" -> record. */
  quiz: Record<string, QuizRecord>;
  last?: { chapter: string; spot?: string; at: number };
  /** Local dates (YYYY-MM-DD) on which the reader studied, sorted, deduped, newest ~120 kept. */
  days: string[];
}

export type ChapterState = "new" | "started" | "read" | "drilled" | "mastered";

export interface ChapterStatus {
  lines: number;
  read: number;
  drilled: number;
  quizzes: number;
  solved: number;
  status: ChapterState;
  /** 0..1, for a progress ring. */
  fraction: number;
}

const MAX_DAYS = 120;

export const emptyProgress = (): Progress => ({ v: 2, chapters: {}, quiz: {}, days: [] });

/** Key of one move of one chapter, shared by quiz records and review cards. */
export const nodeKey = (chapter: string, node: string) => `${chapter}|${node}`;

const chapterOf = (state: Progress, chapter: string): ChapterProgress => state.chapters[chapter] ?? { leaves: [], drilled: [] };

const withChapter = (state: Progress, chapter: string, patch: Partial<ChapterProgress>): Progress => ({
  ...state,
  chapters: { ...state.chapters, [chapter]: { ...chapterOf(state, chapter), ...patch } },
});

const withId = (ids: string[], id: string) => (ids.includes(id) ? ids : [...ids, id]);

/** Local date as YYYY-MM-DD. */
export function localDay(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The reader is at `spot` of the chapter (remembered to continue there); also notes the first opening. Not a study day by itself. */
export function visit(state: Progress, chapter: string, spot: string | undefined, now: number): Progress {
  const next = withChapter(state, chapter, { opened: chapterOf(state, chapter).opened ?? now });
  return { ...next, last: { chapter, ...(spot !== undefined && { spot }), at: now } };
}

/** The reader reached the end of a quick-path line (`leafId`) while reading. Counts as a study day. */
export function visitLine(state: Progress, chapter: string, leafId: string, now: number): Progress {
  const cp = chapterOf(state, chapter);
  return touchDay(withChapter(state, chapter, { leaves: withId(cp.leaves, leafId), opened: cp.opened ?? now }), now);
}

/** The reader simulated the line ending at `leafId` with no miss. Counts as a study day. */
export function markDrilled(state: Progress, chapter: string, leafId: string, now: number): Progress {
  const cp = chapterOf(state, chapter);
  return touchDay(withChapter(state, chapter, { drilled: withId(cp.drilled, leafId), opened: cp.opened ?? now }), now);
}

/** The reader solved a quiz/critical question. The first record decides `firstTry`. Counts as a study day. */
export function markQuiz(state: Progress, chapter: string, node: string, firstTry: boolean, now: number): Progress {
  const key = nodeKey(chapter, node);
  const record: QuizRecord = { at: now, firstTry: state.quiz[key]?.firstTry ?? firstTry };
  return touchDay({ ...state, quiz: { ...state.quiz, [key]: record } }, now);
}

/** A prose or game chapter was finished. Counts as a study day. */
export function markDone(state: Progress, chapter: string, now: number): Progress {
  const cp = chapterOf(state, chapter);
  return touchDay(withChapter(state, chapter, { done: now, opened: cp.opened ?? now }), now);
}

/** Records that the reader studied on the local day of `now`. */
export function touchDay(state: Progress, now: number): Progress {
  const day = localDay(now);
  if (state.days.includes(day)) return state;
  return { ...state, days: [...state.days, day].sort().slice(-MAX_DAYS) };
}

/** Ids of the line ends of a tree (pass the quick tree, or the full one when the chapter has no quick path). */
export function lineEnds(tree: MoveTree): string[] {
  return [...tree.nodes.values()].filter((n) => n.children.length === 0 && n.id !== tree.root).map((n) => n.id);
}

/**
 * Where the reader stands in a chapter. `tree` is the quick tree (or the full one without a quick path).
 * Line chapters: reading counts 50%, drilling 30%, quizzes 20% of `fraction` (without quizzes 5/8 and 3/8).
 * "mastered" needs every line drilled and `mastered` (decided by review.ts); "drilled"/"read" need all lines.
 * Prose, game and tree-less chapters are only new / started (opened) / read (done); fraction 0, 0.5, 1.
 */
export function chapterStatus(
  meta: ChapterMeta,
  tree: MoveTree | undefined,
  state: Progress,
  mastered = false,
  /** The chapter's points to simulate (lib/simPoints.ts); all line ends when not given. */
  drillable?: string[],
): ChapterStatus {
  const cp = state.chapters[meta.id];
  if (meta.type !== "line" || !tree) {
    const status = cp?.done ? "read" : cp?.opened ? "started" : "new";
    return { lines: 0, read: 0, drilled: 0, quizzes: 0, solved: 0, status, fraction: status === "read" ? 1 : status === "started" ? 0.5 : 0 };
  }
  const ends = lineEnds(tree);
  // Counted against the current tree, so ids left over from older content do not inflate anything.
  const read = ends.filter((id) => cp?.leaves.includes(id)).length;
  const drillSet = drillable ?? ends;
  const drilled = drillSet.filter((id) => cp?.drilled.includes(id)).length;
  const quizIds = [...tree.nodes.values()].filter((n) => n.quiz !== undefined).map((n) => n.id);
  const solved = quizIds.filter((id) => state.quiz[nodeKey(meta.id, id)]).length;
  const lines = ends.length;

  const part = (n: number, of: number) => (of ? n / of : 0);
  const fraction = quizIds.length
    ? 0.5 * part(read, lines) + 0.3 * part(drilled, drillSet.length) + 0.2 * part(solved, quizIds.length)
    : (5 * part(read, lines) + 3 * part(drilled, drillSet.length)) / 8;

  let status: ChapterState = "new";
  if (cp?.opened || read || drilled || solved) status = "started";
  if (lines > 0 && read === lines) status = "read";
  if (drillSet.length > 0 && drilled === drillSet.length) status = mastered ? "mastered" : "drilled";
  return { lines, read, drilled, quizzes: quizIds.length, solved, status, fraction };
}

/** The current week (Monday first, local time): which days the reader studied, against a goal of `goal` days. */
export function weekProgress(state: Progress, now: number, goalDays = 5) {
  const d = new Date(now);
  const sinceMonday = (d.getDay() + 6) % 7;
  // Built from calendar fields, so a daylight-saving change inside the week cannot shift a day.
  const days = Array.from({ length: 7 }, (_, i) =>
    state.days.includes(localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday + i, 12).getTime())),
  );
  const count = days.filter(Boolean).length;
  return { days, count, goal: goalDays, met: count >= goalDays };
}

/** Consecutive study days ending today (or yesterday, so the streak survives until the day is over). */
export function streak(state: Progress, now: number): number {
  const d = new Date(now);
  const at = (back: number) => localDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, 12).getTime());
  let back = state.days.includes(at(0)) ? 0 : 1;
  let n = 0;
  while (state.days.includes(at(back))) (n++, back++);
  return n;
}

// Storage: one JSON value per key; any failure (no storage, bad JSON) falls back to a fresh state.

export const progressKey = (studyId: string) => `progress:${studyId}`;

export function readStored(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: keep the in-memory value */
  }
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

export function loadProgress(key: string): Progress {
  const raw = readStored(key);
  if (!isRecord(raw) || (raw.v !== 1 && raw.v !== 2)) return emptyProgress();
  const days = Array.isArray(raw.days) ? raw.days.filter((d): d is string => typeof d === "string") : [];
  const chapters = isRecord(raw.chapters) ? (raw.chapters as Progress["chapters"]) : {};
  const last = isRecord(raw.last) ? (raw.last as NonNullable<Progress["last"]>) : undefined;
  // Version 1 named nodes by their tree path: what does not name a node is kept, the rest is dropped.
  if (raw.v === 1)
    return {
      v: 2,
      chapters: Object.fromEntries(
        Object.entries(chapters).map(([id, cp]) => [id, { leaves: [], drilled: [], ...(cp.done && { done: cp.done }), ...(cp.opened && { opened: cp.opened }) }]),
      ),
      quiz: {},
      ...(last && { last: { chapter: last.chapter, at: last.at } }),
      days,
    };
  return { v: 2, chapters, quiz: isRecord(raw.quiz) ? (raw.quiz as Progress["quiz"]) : {}, ...(last && { last }), days };
}

export const saveProgress = (state: Progress, key: string): void => writeStored(key, state);
