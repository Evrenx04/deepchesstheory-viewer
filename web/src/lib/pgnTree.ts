import { parsePgn, parseComment, startingPosition, type Node, type PgnNodeData } from "chessops/pgn";
import { parseSan, makeSan } from "chessops/san";
import { makeFen } from "chessops/fen";
import { chessgroundMove } from "chessops/compat";
import type { Position } from "chessops/chess";
import type { Move } from "chessops/types";

export type Brush = "green" | "red" | "blue" | "yellow";

export interface Shape {
  orig: string;
  dest?: string;
  brush: Brush;
}

export interface MoveNode {
  /** The moves from the root to here (see moveCode), so it stays when lines are added or reordered. The root is "". */
  id: string;
  parent: string | null;
  children: string[];
  ply: number;
  san: string;
  fen: string;
  lastMove?: [string, string];
  check: boolean;
  nags: number[];
  comment: string;
  /** Extra detail for advanced readers, hidden behind a toggle. */
  deep: string;
  shapes: Shape[];
  /** Names other comments use to link here. */
  anchors: string[];
  /** Set when the reader is asked to find this move before it is shown; the text is the question. */
  quiz?: string;
  /** "[%kutu Ad]": this side line is big enough to be studied as its own box; the text names the box. */
  box?: string;
  /** "[%hizli]" on a side line's first move: the line belongs to the chapter's quick path;
   * "[%hizli tek]": only this first move does (its comment points to where the line is studied). */
  fast?: boolean | "first";
  /** Quick path only: the line goes on in the full tree but is cut here ("[%hizli tek]"). */
  cut?: boolean;
  /** "[%kritik Başlık]": one of the chapter's key moments; the text is its short title. */
  critical?: string;
  /** "[%disari]" on a side line's first move: outside the study's subject (a short note); the random opponent leaves it out. */
  outside?: boolean;
  /** In a quick-path tree: how many side lines of the full tree start here but are left out. */
  hidden?: number;
}

export interface MoveTree {
  headers: Record<string, string>;
  intro: string;
  introDeep: string;
  introShapes: Shape[];
  nodes: Map<string, MoveNode>;
  root: string;
}

// Text after "[%deep]" (in the same or a separate comment) is the advanced note.
const DEEP_MARK = "[%deep]";
// "[%id name]" names a position so other comments can link to it with [[name|text]].
const ANCHOR = /[ \t]*\[%id\s+([\w-]+)\]/g;
const SHAPES = /[ \t]*\[%(?:cal|csl)\s[^\]]*\]/g;
// "[%quiz]" or "[%quiz Soru metni]" on a move: ask the reader to find it first.
const QUIZ = /[ \t]*\[%quiz(?:\s+([^\]]*))?\]/g;
// "[%kutu]" or "[%kutu Ad]" on a side line's first move makes it a box of its own.
const BOX = /[ \t]*\[%kutu(?:\s+([^\]]*))?\]/g;
// "[%games]" asks tools/games_index.py to list master games at this position; nothing to show here.
const GAMES = /[ \t]*\[%games\]/g;
// "[%hizli]" puts a side line on the quick path ("[%hizli tek]": its first move only); "[%kritik Başlık]" marks a key moment.
const FAST = /[ \t]*\[%hizli(\s+tek)?\]/g;
const CRITICAL = /[ \t]*\[%kritik(?:\s+([^\]]*))?\]/g;
// "[%disari]": a line outside the study's subject.
const OUTSIDE = /[ \t]*\[%disari\]/g;

function readComments(raw: string[] | undefined) {
  let comment = "";
  let deep = "";
  const shapes: Shape[] = [];
  const anchors: string[] = [];
  let quiz: string | undefined;
  let box: string | undefined;
  let fast: boolean | "first" = false;
  let critical: string | undefined;
  let outside = false;
  for (const text of raw ?? []) {
    // chessops swallows the line break next to a command, so arrows and anchors are moved
    // out of the way first; their position in the comment carries no meaning.
    const commands: string[] = [];
    const body = text
      .replace(ANCHOR, (_, name) => (anchors.push(name), ""))
      .replace(QUIZ, (_, question) => ((quiz = question?.trim() ?? ""), ""))
      .replace(GAMES, "")
      .replace(FAST, (_, first) => ((fast = first ? "first" : true), ""))
      .replace(OUTSIDE, () => ((outside = true), ""))
      .replace(CRITICAL, (_, title) => ((critical = title?.trim() ?? ""), ""))
      .replace(BOX, (_, name) => ((box = name?.trim() ?? ""), ""))
      .replace(SHAPES, (command) => (commands.push(command.trim()), ""));
    const parsed = parseComment(`${body} ${commands.join(" ")}`);
    for (const s of parsed.shapes)
      shapes.push(
        s.from === s.to
          ? { orig: squareName(s.from), brush: s.color }
          : { orig: squareName(s.from), dest: squareName(s.to), brush: s.color },
      );
    const [main, ...rest] = parsed.text.split(DEEP_MARK);
    if (main.trim()) comment = join(comment, main.trim());
    if (rest.join(" ").trim()) deep = join(deep, rest.join(" ").trim());
  }
  return {
    comment,
    deep,
    shapes,
    anchors,
    ...(quiz !== undefined && { quiz }),
    ...(box !== undefined ? { box } : {}),
    ...(fast ? { fast } : {}),
    ...(critical !== undefined && { critical }),
    ...(outside ? { outside } : {}),
  };
}

const join = (a: string, b: string) => (a ? `${a}\n\n${b}` : b);

// A node id is the moves that lead to it, each its from- and to-square as one URL-safe character
// (a1 = "A" … h8 = "_"), a promotion followed by "." and the piece: 1.e4 e5 → "Mc0k", e7e8=Q → "08.q".
// An id is a prefix of the ids of all the moves after it. docs/dugum-kimligi.md has the reasons.
const SQUARE_CODES = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const PROMOTION_CODES: Record<string, string> = { queen: "q", rook: "r", bishop: "b", knight: "n", king: "k" };

export function moveCode(move: Move): string {
  if (!("from" in move)) throw new Error("Taş bırakma hamlesi desteklenmiyor.");
  const code = SQUARE_CODES[move.from] + SQUARE_CODES[move.to];
  return move.promotion ? `${code}.${PROMOTION_CODES[move.promotion]}` : code;
}

// chessops squares are 0..63 (a1 = 0); chessground wants names.
function squareName(sq: number): string {
  return "abcdefgh"[sq & 7] + String((sq >> 3) + 1);
}

export function parseStudyPgn(pgn: string, source = "PGN"): MoveTree {
  const games = parsePgn(pgn);
  if (games.length !== 1) throw new Error(`${source}: tam olarak bir oyun bekleniyordu, ${games.length} bulundu.`);
  const game = games[0];
  const start = startingPosition(game.headers).unwrap();
  const intro = readComments(game.comments);
  const rootNode: MoveNode = {
    id: "",
    parent: null,
    children: [],
    ply: 0,
    san: "",
    fen: makeFen(start.toSetup()),
    check: start.isCheck(),
    nags: [],
    // The game comment is the chapter intro, kept on the tree rather than the node.
    comment: "",
    deep: "",
    shapes: [],
    anchors: intro.anchors,
  };
  const nodes = new Map<string, MoveNode>([["", rootNode]]);

  const visit = (node: Node<PgnNodeData>, pos: Position, parent: MoveNode) => {
    node.children.forEach((child) => {
      const after = pos.clone();
      const move = parseSan(after, child.data.san);
      const moveNumber = Math.floor(parent.ply / 2) + 1;
      if (!move)
        throw new Error(
          `${source}: ${moveNumber}${parent.ply % 2 ? "..." : "."}${child.data.san} yasal değil (konum: ${parent.fen}).`,
        );
      const san = makeSan(after, move);
      after.play(move);
      const id = parent.id + moveCode(move);
      if (nodes.has(id))
        throw new Error(`${source}: ${moveNumber}${parent.ply % 2 ? "..." : "."}${san} aynı yerde iki kez yazılmış (konum: ${parent.fen}).`);
      const notes = readComments([...(child.data.startingComments ?? []), ...(child.data.comments ?? [])]);
      const [from, to] = chessgroundMove(move);
      const entry: MoveNode = {
        id,
        parent: parent.id,
        children: [],
        ply: parent.ply + 1,
        san,
        fen: makeFen(after.toSetup()),
        lastMove: [from, to],
        check: after.isCheck(),
        nags: child.data.nags ?? [],
        ...notes,
      };
      nodes.set(id, entry);
      parent.children.push(id);
      visit(child, after, entry);
    });
  };
  visit(game.moves, start, rootNode);

  return {
    headers: Object.fromEntries(game.headers),
    intro: intro.comment,
    introDeep: intro.deep,
    introShapes: intro.shapes,
    nodes,
    root: "",
  };
}

/**
 * The quick path of a chapter: the main line plus side lines whose first move is marked "[%hizli]",
 * each followed along its own main line (their side lines need their own mark); a line marked
 * "[%hizli tek]" keeps its first move only and is flagged `cut` there. Deep notes are dropped; figures stay (user, 2026-10-26:
 * "motor da gözüksün, kişi konumu anlasın"). Node ids stay those of the full tree. Undefined when the chapter marks no quick path.
 */
export function quickTree(tree: MoveTree): MoveTree | undefined {
  if (![...tree.nodes.values()].some((n) => n.fast)) return undefined;
  const nodes = new Map<string, MoveNode>();
  const keep = (id: string) => {
    const node = tree.nodes.get(id)!;
    const cut = node.fast === "first" && node.children.length > 0;
    const children = cut ? [] : node.children.filter((c, i) => i === 0 || tree.nodes.get(c)!.fast);
    const hidden = cut ? 0 : node.children.length - children.length;
    nodes.set(id, {
      ...node,
      children,
      comment: node.comment,
      deep: "",
      ...(hidden ? { hidden } : {}),
      ...(cut ? { cut } : {}),
    });
    children.forEach(keep);
  };
  keep(tree.root);
  return { ...tree, introDeep: "", nodes };
}

const FIGURES = /[ \t]*\(([^()]*)\)/g;
// A percentage or an engine figure, e.g. "(%33, son iki yılda %45)", "(+0,3)" or the unsigned "(0,0)":
// the parenthesis goes whatever else it says ("(Nxe5 ile +0,6)"). English writes "(33%, 45% in the last two years)",
// "(+0.3)", "(0.0)", "(+0.6 with Nxe5)".
const FIGURE = /%\d|(?<![\d.,])\d+(?:\.\d+)?%|[+\-−]\d+,\d|[+\-−]\d+\.\d(?![\p{L}\d])|(?<![\d.,])0[,.]00?(?![\d.,]*\d)/u;
// A game count, e.g. "(8 oyunun 6'sı)", "(ustaların 3 oyununun 2'si)", "(13 oyun)", or a bare count "(21)".
// The parenthesis goes only when it holds nothing but counts and moves: "(16 oyunun 8'i ...Bxe3)" goes,
// "(27 oyunun 18'inde a6'da piyon vardı)" and "(9 ve 7 oyun)" stay, so do years "(2021)".
const COUNT =
  /(?:(?:[Uu]staların|[Uu]stalarda|son iki yılda|[Çç]evrimiçinde)\s+)?\d+\s+oyun(?:(?:un)?un\s+\d+['’]s?[iıuü])?(?![\p{L}'’])|\d+['’][ae]\s+\d+(?!\d)|(?<![\p{L}\d.'’])(?!(?:1[5-9]|20)\d\d(?!\d))\d+(?![\p{L}\d.,'’])/gu;
// English counts: "(6 of 8 games)", "(masters: 2 of 3 games)", "(13 games)", "(8 games to 6)".
const COUNT_EN = /(?:(?:[Mm]asters|[Oo]nline|[Ii]n the last two years)[:,]?\s+)?\d+\s+of\s+\d+(?:\s+games?)?(?![\p{L}])|\d+\s+games?(?![\p{L}])|\d+\s+to\s+\d+(?!\d)/gu;
const MOVE = /(?<![\p{L}\d])(?:\d+\.(?:\.\.)?\s?|\.\.\.)?(?:O-O(?:-O)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h](?:x[a-h])?[1-8])(?:=[QRBN])?[+#]?[!?]*(?![\p{L}\d])/gu;

function onlyCounts(inside: string): boolean {
  const rest = inside.replace(MOVE, " ");
  const left = rest.replace(COUNT_EN, "").replace(COUNT, "");

  return left !== rest && !left.replace(/[\s,;]+/g, "");
}

// "Sorular: (1) Merkez ..." numbers a list: a bare number at the start of a clause stays.
const BARE = /^\s*\d+\s*$/;
const CLAUSE_START = /(?:^|[:.?!;])\s*$/;

/** The words without the figures (they live in parentheses by convention). The quick path used it until 2026-10-26. */
export function withoutFigures(text: string): string {
  return text
    .replace(FIGURES, (paren, inside: string, at: number) => {
      if (inside.includes("[[")) return paren;
      if (FIGURE.test(inside)) return "";
      if (BARE.test(inside) && CLAUSE_START.test(text.slice(0, at))) return paren;
      return onlyCounts(inside) ? "" : paren;
    })
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]+([,;:!?]|\.(?!\.))/g, "$1"); // not before "...": a Black move like "...Nd4" keeps its space
}

/** Nearest node at or above `id` that the tree contains. */
export function nearestIn(tree: MoveTree, full: MoveTree, id: string): string {
  let node = full.nodes.get(id);
  while (node && !tree.nodes.has(node.id)) node = node.parent === null ? undefined : full.nodes.get(node.parent);
  return node?.id ?? tree.root;
}

/**
 * The node's spot in the address: eight URL-safe characters hashed from its id (the root is ""), so the
 * address keeps its length as the reader moves on, and like the id it stays when lines are reordered or added.
 */
export function urlCode(id: string): string {
  if (id === "") return "";
  // cyrb53: two 32-bit FNV-like lanes mixed at the end; 48 of its 53 bits make the code.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  let n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  let code = "";
  for (let i = 0; i < 8; i++, n = Math.floor(n / 64)) code += SQUARE_CODES[n % 64];
  return code;
}

const urlCodeCache = new WeakMap<MoveTree, Map<string, string>>();

/** Address code → node id for every node of the tree; throws when two nodes share a code (tests and the build check every chapter). */
export function urlCodes(tree: MoveTree, source = "PGN"): Map<string, string> {
  let codes = urlCodeCache.get(tree);
  if (codes) return codes;
  codes = new Map();
  for (const id of tree.nodes.keys()) {
    const code = urlCode(id);
    const other = codes.get(code);
    if (other !== undefined) throw new Error(`${source}: iki düğüm aynı adres kodunu aldı (${code}): ${other} / ${id}`);
    codes.set(code, id);
  }
  urlCodeCache.set(tree, codes);
  return codes;
}

/** The node id a spot of the address names: an address code, or an id as links and the history hold; anything else is returned as it is. */
export function nodeFromUrl(tree: MoveTree, spot: string): string {
  if (tree.nodes.has(spot)) return spot;
  try {
    return urlCodes(tree).get(spot) ?? spot;
  } catch {
    return spot; // a chapter with a clash reports it when loaded (study.ts); a master game just keeps the spot
  }
}

/**
 * The node a stored or linked id stands for: the id itself, or when the content has changed since, its nearest
 * ancestor still in the tree; `fallback` when that is above `fallback` or nothing matches (an id of an older format).
 */
export function resolveNode(tree: MoveTree, id: string, fallback: string): string {
  if (tree.nodes.has(id)) return id;
  const floor = tree.nodes.get(fallback)?.ply ?? 0;
  for (let n = id.length - 1; n > 0; n--) {
    const node = tree.nodes.get(id.slice(0, n));
    if (node) return node.ply >= floor ? node.id : fallback;
  }
  return fallback;
}

/** Key moments ("[%kritik]") in the order they come up on the board (by move number). */
export function criticalMoments(tree: MoveTree): MoveNode[] {
  const out: MoveNode[] = [];
  const walk = (id: string) => {
    const node = tree.nodes.get(id)!;
    if (node.critical !== undefined) out.push(node);
    node.children.forEach(walk);
  };
  walk(tree.root);
  return out.sort((a, b) => a.ply - b.ply);
}

/** Follow first children from a node to the end of its line. */
export function lineEnd(tree: MoveTree, id: string): string {
  let node = tree.nodes.get(id)!;
  while (node.children.length) node = tree.nodes.get(node.children[0])!;
  return node.id;
}

/** Node reached by following the main line for `ply` half-moves. */
export function mainlineAt(tree: MoveTree, ply: number): string {
  let node = tree.nodes.get(tree.root)!;
  while (node.ply < ply && node.children.length) node = tree.nodes.get(node.children[0])!;
  return node.id;
}

/** All node ids from the root to `id`, root excluded. */
export function pathTo(tree: MoveTree, id: string): string[] {
  const out: string[] = [];
  let node = tree.nodes.get(id);
  while (node && node.parent !== null) {
    out.unshift(node.id);
    node = tree.nodes.get(node.parent);
  }
  return out;
}

export const NAG_SYMBOLS: Record<number, string> = {
  1: "!",
  2: "?",
  3: "!!",
  4: "??",
  5: "!?",
  6: "?!",
  10: "=",
  13: "∞",
  14: "⩲",
  15: "⩱",
  16: "±",
  17: "∓",
  18: "+−",
  19: "−+",
  22: "⨀",
  32: "⟳",
  36: "→",
  40: "↑",
  44: "=∞",
  132: "⇆",
  140: "∆",
  146: "N",
};
