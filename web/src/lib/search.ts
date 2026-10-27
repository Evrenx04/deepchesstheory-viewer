import type { MoveNode, MoveTree } from "./pgnTree";
import { GAME_PREFIX, positionKey, type ChapterMeta, type GamesIndex, type StudyMeta } from "./study";

/** A chapter with moves, as search reads it. `startId` (where its subject begins) ranks places inside the subject first. */
export interface SearchChapter {
  meta: ChapterMeta;
  tree: MoveTree;
  quick?: MoveTree;
  startId?: string;
}

/** Candidate move keys for one typed token (see moveKey); more than one when the letter is ambiguous (Turkish K = rook, English K = king). */
export type MoveToken = string[];

const PIECES_EN: Record<string, string> = { K: "K", Q: "Q", R: "R", B: "B", N: "N" };
// Şah, Vezir, Kale, Fil, At
const PIECES_TR: Record<string, string> = { Ş: "K", V: "Q", K: "R", F: "B", A: "N" };
const FIGURINES: Record<string, string> = { "♔": "K", "♚": "K", "♕": "Q", "♛": "Q", "♖": "R", "♜": "R", "♗": "B", "♝": "B", "♘": "N", "♞": "N" };

const PAWN_MOVE = /^(?:[a-h][1-8]|[a-h]x?[a-h][1-8])(?:=?[QRBNVKFA])?$/i;
const PIECE_REST = /^[a-h]?[1-8]?x?[a-h][1-8]$/;
const PROMO: Record<string, string> = { Q: "Q", R: "R", B: "B", N: "N", V: "Q", K: "R", F: "B", A: "N" };

/**
 * What two spellings of a move share: piece letter, target square and promotion; capture marks,
 * disambiguation, checks and annotations are dropped ("Nbxd2+" and "Nd2" → "Nd2", "exd4" → "ed4").
 */
export function moveKey(san: string): string {
  const s = san.replace(/[+#!?]+$/, "");
  if (s.startsWith("O-O")) return s;
  const m = s.match(/^([KQRBN])?([a-h]?)([1-8]?)x?([a-h][1-8])(?:=([QRBN]))?$/);
  if (!m) return s;
  const [, piece, file, , to, promo] = m;
  return piece ? `${piece}${to}` : `${file && file !== to[0] ? file : ""}${to}${promo ? `=${promo}` : ""}`;
}

function tokenKeys(raw: string): MoveToken | undefined {
  let t = raw.replace(/[+#!?‼⁇]+$/u, "");
  if (!t) return undefined;
  if (/^[o0]-[o0](?:-[o0])?$/i.test(t)) return [t.length > 3 ? "O-O-O" : "O-O"];
  const first = t[0];
  if (FIGURINES[first]) t = FIGURINES[first] + t.slice(1);
  // A lowercase file letter is a pawn whenever it can be one: "b4", "bxc3", "ed4"; "bc4" is the bishop.
  if (PAWN_MOVE.test(t) && /^[a-h]/.test(t) && !/^b[a-h][1-8]/.test(t)) {
    const promo = t.match(/=?([QRBNVKFAqrbnvkfa])$/);
    const body = promo ? t.slice(0, -promo[0].length) : t;
    const p = promo ? PROMO[promo[1].toUpperCase()] : "";
    return [moveKey(body.replace(/^([a-h])([a-h][1-8])$/, "$1x$2") + (p ? `=${p}` : ""))];
  }
  const letter = t[0].toLocaleUpperCase("tr");
  const rest = t.slice(1);
  if (!PIECE_REST.test(rest)) return undefined;
  const pieces = new Set<string>();
  if (PIECES_EN[letter]) pieces.add(PIECES_EN[letter]);
  if (PIECES_TR[letter]) pieces.add(PIECES_TR[letter]);
  if (!pieces.size) return undefined;
  return [...pieces].map((p) => moveKey(p + rest));
}

/**
 * A typed move sequence as candidate keys per move: "5.d4 exd4 6.e5", "5... exd4", "Af3 Ac6", "♘f3", "nf3", "0-0".
 * Undefined when the query does not read as moves (a name, a chapter code).
 */
export function parseMoves(query: string): MoveToken[] | undefined {
  const text = query
    .normalize("NFC")
    // Move numbers: "5.", "5...", "5…", "5. ", and a bare "..." before a Black move.
    .replace(/\b\d+\s*(?:\.{1,3}|…)\s*/g, " ")
    .replace(/(?:\.{2,3}|…)/g, " ")
    .replace(/[,;]/g, " ")
    .trim();
  if (!text) return undefined;
  const tokens: MoveToken[] = [];
  for (const raw of text.split(/\s+/)) {
    const keys = tokenKeys(raw);
    if (!keys) return undefined;
    tokens.push(keys);
  }
  return tokens;
}

export interface Place {
  chapter: string;
  node: MoveNode;
  onQuick: boolean;
  ply: number;
  /** e.g. "B1 · 6.e5" */
  label: string;
  /** Reached by another move order than the one searched for. */
  transposed: boolean;
  /** At or after the chapter's [Start] (when the chapter's startId was given). */
  inSubject: boolean;
}

export interface PlaceGroup {
  key: string;
  fen: string;
  places: Place[];
}

/** "6.e5" / "5...exd4" for the move that led to the node. */
export const moveLabel = (node: MoveNode) => `${Math.floor((node.ply - 1) / 2) + 1}${node.ply % 2 ? "." : "..."}${node.san}`;

const chapterName = (meta: ChapterMeta) => meta.code ?? meta.title;

function place(c: SearchChapter, node: MoveNode, transposed: boolean): Place {
  const start = c.startId;
  return {
    chapter: c.meta.id,
    node,
    onQuick: !!c.quick?.nodes.has(node.id),
    ply: node.ply,
    label: node.ply ? `${chapterName(c.meta)} · ${moveLabel(node)}` : chapterName(c.meta),
    transposed,
    // A node id starts with the ids of the moves before it (pgnTree.ts).
    inSubject: start === undefined || node.id.startsWith(start),
  };
}

const placeOrder = (order: Map<string, number>) => (a: Place, b: Place) =>
  Number(a.transposed) - Number(b.transposed) ||
  Number(b.inSubject) - Number(a.inSubject) ||
  Number(b.onQuick) - Number(a.onQuick) ||
  a.ply - b.ply ||
  order.get(a.chapter)! - order.get(b.chapter)!;

const MAX_PLACES = 30;

function byPosition(chapters: SearchChapter[]) {
  const index = new Map<string, { c: SearchChapter; node: MoveNode }[]>();
  for (const c of chapters)
    for (const node of c.tree.nodes.values()) {
      const key = positionKey(node.fen);
      if (!index.has(key)) index.set(key, []);
      index.get(key)!.push({ c, node });
    }
  return index;
}

function capGroups(groups: PlaceGroup[]): PlaceGroup[] {
  let left = MAX_PLACES;
  const out: PlaceGroup[] = [];
  for (const g of groups) {
    if (left <= 0) break;
    out.push({ ...g, places: g.places.slice(0, left) });
    left -= g.places.length;
  }
  return out;
}

/**
 * Every node whose path ends with the given moves (a suffix match, so "d4 exd4 e5" finds 5.d4 exd4 6.e5
 * in any chapter), grouped by the position reached; each group also lists the places that reach the same
 * position by another move order (`transposed`). Earliest groups first, then studied ones; at most 30 places.
 */
export function searchMoves(chapters: SearchChapter[], tokens: (string | MoveToken)[]): PlaceGroup[] {
  const wanted = tokens.map((t) => (typeof t === "string" ? (tokenKeys(t) ?? [t]) : t).map((k) => new Set([k])));
  if (!wanted.length) return [];
  const order = new Map(chapters.map((c, i) => [c.meta.id, i]));
  const groups = new Map<string, PlaceGroup>();
  const matched = new Set<string>();
  for (const c of chapters) {
    for (const node of c.tree.nodes.values()) {
      if (node.ply < wanted.length) continue;
      let at: MoveNode | undefined = node;
      let ok = true;
      for (let i = wanted.length - 1; i >= 0 && ok; i--) {
        ok = !!at && at.parent !== null && wanted[i].some((s) => s.has(moveKey(at!.san)));
        at = at?.parent != null ? c.tree.nodes.get(at.parent) : undefined;
      }
      if (!ok) continue;
      const key = positionKey(node.fen);
      if (!groups.has(key)) groups.set(key, { key, fen: node.fen, places: [] });
      groups.get(key)!.places.push(place(c, node, false));
      matched.add(`${c.meta.id}|${node.id}`);
    }
  }
  if (!groups.size) return [];
  const index = byPosition(chapters);
  for (const g of groups.values()) {
    for (const { c, node } of index.get(g.key) ?? [])
      if (!matched.has(`${c.meta.id}|${node.id}`)) g.places.push(place(c, node, true));
    g.places.sort(placeOrder(order));
  }
  const best = (g: PlaceGroup) => g.places[0];
  // The earliest position first (a later one is the same moves in an odd order), then where the moves are
  // studied (a chapter's subject, on its quick path), then the most covered.
  const studied = (g: PlaceGroup) => Number(best(g).inSubject && best(g).onQuick);
  const sorted = [...groups.values()].sort(
    (a, b) => best(a).ply - best(b).ply || studied(b) - studied(a) || b.places.length - a.places.length,
  );
  return capGroups(sorted);
}

/** Every place of the FEN's position (side to move, castling and en passant count; move counters do not). */
export function positionPlaces(chapters: SearchChapter[], fen: string): Place[] {
  const key = positionKey(fen);
  const order = new Map(chapters.map((c, i) => [c.meta.id, i]));
  const out: Place[] = [];
  for (const c of chapters) for (const node of c.tree.nodes.values()) if (positionKey(node.fen) === key) out.push(place(c, node, false));
  return out.sort(placeOrder(order)).slice(0, MAX_PLACES);
}

/** Lowercase without diacritics, Turkish dotted and dotless i alike: "İtalyan", "ıtalyan" → "italyan", "Møller" → "moller". */
export function fold(text: string): string {
  return text
    .replace(/[İIı]/g, "i")
    .replace(/[Øø]/g, "o")
    .replace(/[Ææ]/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[–—‑-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export type NameKind = "chapter" | "card" | "game" | "endgame";

export interface NameResult {
  /** Chapter id; a master game of the games index is GAME_PREFIX + its id (see loadGameChapter). */
  chapter: string;
  title: string;
  kind: NameKind;
}

const kindOf = (meta: ChapterMeta): NameKind => (/^P\d/.test(meta.code ?? "") ? "card" : /^O\d/.test(meta.code ?? "") ? "endgame" : "chapter");

const MAX_NAMES = 30;

/**
 * Chapters by title or code ("A1b", "Kart 3", "P3", "Møller"), then master games of the games index by
 * player name. Case and diacritics do not matter. An exact code comes first, then codes it starts, then titles.
 */
export function searchNames(query: string, study: StudyMeta, games?: GamesIndex): NameResult[] {
  const q = fold(query);
  if (!q) return [];
  const scored: { r: NameResult; score: number; i: number }[] = [];
  study.chapters.forEach((meta, i) => {
    const code = fold(meta.code ?? "");
    const title = fold(meta.title);
    const score =
      code === q ? 0 : code && code.startsWith(q) && /\d/.test(q) ? 1 : title.startsWith(q) ? 2 : title.includes(q) ? 3 : -1;
    if (score >= 0) scored.push({ r: { chapter: meta.id, title: meta.title, kind: kindOf(meta) }, score, i });
  });
  scored.sort((a, b) => a.score - b.score || a.i - b.i);
  const out = scored.map((s) => s.r);
  if (games) {
    const found = Object.entries(games.games)
      .filter(([, g]) => fold(g.white).includes(q) || fold(g.black).includes(q))
      .sort(([, a], [, b]) => b.date.localeCompare(a.date));
    for (const [id, g] of found)
      out.push({
        chapter: `${GAME_PREFIX}${id}`,
        title: `${surname(g.white)} – ${surname(g.black)} ${g.date.slice(0, 4)}`,
        kind: "game",
      });
  }
  return out.slice(0, MAX_NAMES);
}

/** "Kramnik, Vladimir" → "Kramnik". */
const surname = (name: string) => name.split(",")[0].trim();

export interface SearchData {
  chapters: SearchChapter[];
  study: StudyMeta;
  games?: GamesIndex;
}

export type SearchResult =
  | { kind: "moves"; tokens: MoveToken[]; groups: PlaceGroup[] }
  | { kind: "names"; results: NameResult[] }
  | { kind: "none" };

/** Moves when the query reads as moves and the study has them, otherwise names. */
export function search(query: string, data: SearchData): SearchResult {
  const tokens = parseMoves(query);
  if (tokens) {
    const groups = searchMoves(data.chapters, tokens);
    if (groups.length) return { kind: "moves", tokens, groups };
  }
  const results = searchNames(query, data.study, data.games);
  return results.length ? { kind: "names", results } : { kind: "none" };
}
