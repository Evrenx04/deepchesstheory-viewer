import { t } from "./i18n";
import { pathTo, type MoveNode, type MoveTree } from "./pgnTree";
import { ref, splitRef, type Graph, type Ref } from "./studyGraph";

export type { Graph };

export type Side = "white" | "black";

/** Games played with each move of a position, [Lichess 2000+, masters], by position key and SAN. */
export type Weights = Record<string, Record<string, [number, number]>>;

/**
 * A run with the reader playing `color` and the site the other side. Either along a fixed path (from the
 * chapter start to a chosen position) or, with `random`, onwards from a position through the whole study:
 * the site picks its moves by how often they are played, the reader is expected to play the main move.
 */
export interface Sim {
  random: boolean;
  /** Position the run starts from. */
  start: Ref;
  /** The position aimed at (fixed path only). */
  target?: Ref;
  /** Moves after the start; a random run adds them as it goes. */
  path: Ref[];
  /** How many of them are on the board. */
  done: number;
  color: Side;
  /** Indices into `path` of the reader's moves that were not found at the first try. */
  missed: number[];
  feedback?: { kind: "right" | "wrong" | "other"; text: string };
  /** Changing it puts the position back after a wrong try. */
  attempt: number;
  /** A random run that stopped because the position came up again. */
  repeated?: boolean;
  /** "Yalnız bu bölüm": the run keeps to this chapter. */
  scope?: string;
  /**
   * In a random run, the reader played a move the study covers elsewhere than the recommended line, and the
   * run went on with it. `index` is that move in `path`; `options` are the recommended line's moves there.
   */
  detour?: { index: number; played: Ref; expected: Ref; options: Ref[] };
  /** Fixed path whose target ends a line the study carries on elsewhere: the run's real end past the target. */
  end?: Ref;
  /** Indices into `path` of the moves after which the line goes on at the same position elsewhere. */
  joins?: number[];
  /** Fixed path that stopped where another chapter takes the line on: that chapter's next move. */
  onward?: Ref;
}

export const chapterOf = (r: Ref): string => splitRef(r).chapter;

export const sideToMove = (node: MoveNode): Side => (node.fen.split(" ")[1] === "w" ? "white" : "black");

/** The moves from the chapter start to `target`. */
export function simPath(tree: MoveTree, startId: string, target: string): string[] {
  const startPly = tree.nodes.get(startId)!.ply;
  return pathTo(tree, target).filter((id) => tree.nodes.get(id)!.ply > startPly);
}

/**
 * A run from the chapter start to `target`. With the graph, a target that ends a line the study carries on
 * elsewhere (a transposition) is not the end: the run follows the line on (see `carryOn`).
 */
export function startSim(chapter: string, tree: MoveTree, startId: string, target: string, color: Side, g?: Graph): Sim {
  const path = simPath(tree, startId, target).map((id) => ref(chapter, id));
  const sim: Sim = { random: false, start: ref(chapter, startId), target: ref(chapter, target), path, done: 0, color, missed: [], attempt: 0 };
  return g && !tree.nodes.get(target)!.children.length ? goOn(g, sim, chapter) : sim;
}

// A fixed run passes through another chapter's moves when the line comes back to its own within this many.
const PASS_THROUGH = 10;

/**
 * Where a line that ends at `from` goes on: the study has the position elsewhere with moves, and the run
 * follows the main moves from there to the real end (through further transpositions). It keeps to `home`:
 * it goes back there as soon as it can, passes through a short stretch of another chapter that comes back,
 * and otherwise stops where another chapter takes over, `onward` being that chapter's next move. `seen` are
 * the positions the run has been through; it stops before one comes up again.
 */
export function carryOn(g: Graph, from: Ref, home: string, seen: string[]): { moves: Ref[]; joins: Ref[]; onward?: Ref } {
  const moves: Ref[] = [];
  const joins: Ref[] = [];
  const keys = new Set(seen);
  let at = from;
  let away: number | undefined; // where the moves left `home`
  for (;;) {
    const own = g.children(at);
    const places = g.places(at);
    const homePlace = places.find((p) => chapterOf(p) === home);
    const place = chapterOf(at) !== home && homePlace ? homePlace : own.length ? undefined : (homePlace ?? places[0]);
    const next = place ? g.children(place)[0] : own[0];
    if (!next || keys.has(g.key(next))) break;
    if (chapterOf(next) === home) away = undefined;
    else if (away === undefined) away = moves.length;
    else if (moves.length - away >= PASS_THROUGH) break;
    if (place) joins.push(at);
    keys.add(g.key(next));
    moves.push(next);
    at = next;
  }
  if (away === undefined) return { moves, joins };
  const kept = moves.slice(0, away);
  return { moves: kept, joins: joins.filter((j) => j === from || kept.includes(j)), onward: moves[away] };
}

/** A fixed run whose path ends a line: the path goes on as far as `carryOn` takes it, keeping to `home`. */
function goOn(g: Graph, sim: Sim, home: string): Sim {
  const from = sim.path.length ? sim.path[sim.path.length - 1] : sim.start;
  const seen = [sim.start, ...sim.path].map((r) => g.key(r));
  const { moves, joins, onward } = carryOn(g, from, home, seen);
  const path = [...sim.path, ...moves];
  return {
    ...sim,
    path,
    end: moves.length ? moves[moves.length - 1] : sim.end,
    joins: [...(sim.joins ?? []), ...joins.map((j) => path.indexOf(j)).filter((i) => i >= 0)],
    onward,
  };
}

/** A fixed run that stopped where another chapter takes the line on: go on in that chapter. */
export const simGoOn = (g: Graph, sim: Sim): Sim => (sim.onward ? { ...goOn(g, sim, chapterOf(sim.onward)), feedback: undefined } : sim);

/** Whether a node is on its chapter's main line. */
export function onMainLine(g: Graph, r: Ref): boolean {
  const { chapter } = splitRef(r);
  for (let node = g.node(r); node.parent !== null; ) {
    const parent = g.node(ref(chapter, node.parent));
    if (parent.children[0] !== node.id) return false;
    node = parent;
  }
  return true;
}

/** A random run from `from`; the first move (if it is the site's) is already chosen. */
export function startRandom(g: Graph, from: Ref, color: Side, weights: Weights, rand = Math.random, scope?: string): Sim {
  return extend(g, { random: true, start: from, path: [], done: 0, color, missed: [], attempt: 0, scope }, weights, rand);
}

/** Position on the board during the run. */
export const simAt = (sim: Sim): Ref => (sim.done ? sim.path[sim.done - 1] : sim.start);

/** The move the run expects next, or undefined at the end. */
export const simNext = (sim: Sim): Ref | undefined => (sim.done < sim.path.length ? sim.path[sim.done] : undefined);

const mover = (g: Graph, r: Ref): Side => sideToMove(g.node(r));

export const readerTurn = (g: Graph, sim: Sim): boolean => sim.done < sim.path.length && mover(g, simAt(sim)) === sim.color;

/** The reader's moves in the run (indices into `path`). */
export const readerIndices = (g: Graph, sim: Sim): number[] =>
  sim.path.flatMap((_, i) => (mover(g, i ? sim.path[i - 1] : sim.start) === sim.color ? [i] : []));

/** Number of moves the reader plays in a run to `target`. */
export function readerMoves(tree: MoveTree, startId: string, target: string, color: Side): number {
  return simPath(tree, startId, target).filter((id) => sideToMove(tree.nodes.get(tree.nodes.get(id)!.parent!)!) === color).length;
}

/** Where the run is worth doing: key moments and line ends that close with a comment (a plan summary), but not
 * those where the study carries the position on elsewhere (`carriesOn`): there the real end is further on. */
export const simRecommended = (node: MoveNode, carriesOn = false): boolean =>
  node.critical !== undefined || (node.children.length === 0 && !node.cut && !carriesOn && node.comment.trim() !== "");

// Below this many games among the study's moves, Lichess counts give way to masters, then to equal chances.
const MIN_LICHESS = 20;
const MIN_MASTERS = 5;

/** The moves the random opponent may play here: those the study covers, less lines outside its subject. */
const opponentMoves = (g: Graph, at: Ref): Ref[] => g.moves(at).filter((m) => !g.node(m).outside);

/** Chance of each move the random opponent may play here, by how often it is played in practice. */
export function moveChances(g: Graph, at: Ref, weights: Weights): Map<Ref, number> {
  const moves = opponentMoves(g, at);
  const counts = weights[g.key(at)] ?? {};
  const of = (i: 0 | 1) => moves.map((m) => counts[g.node(m).san]?.[i] ?? 0);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const lichess = of(0);
  const masters = of(1);
  const use = sum(lichess) >= MIN_LICHESS ? lichess : sum(masters) >= MIN_MASTERS ? masters : moves.map(() => 1);
  const total = sum(use);
  return new Map(moves.map((m, i) => [m, use[i] / total]));
}

function pick(chances: Map<Ref, number>, rand: () => number): Ref {
  let r = rand();
  let last = "";
  for (const [m, p] of chances) {
    last = m;
    if (p > 0 && (r -= p) < 0) return m;
  }
  return last;
}

/** A random run decides its next move once the board has caught up: the main move for the reader, a pick for
 * the site. It stops at the end of the study's lines, or when a position comes up again. */
function extend(g: Graph, sim: Sim, weights: Weights, rand: () => number): Sim {
  if (!sim.random || sim.done < sim.path.length) return sim;
  const at = simAt(sim);
  const seen = [sim.start, ...sim.path.slice(0, -1)].map((r) => g.key(r));
  if (sim.path.length && seen.includes(g.key(at))) return { ...sim, repeated: true };
  const next = mover(g, at) === sim.color ? g.main(at) : opponentMoves(g, at).length ? pick(moveChances(g, at, weights), rand) : undefined;
  return next ? { ...sim, path: [...sim.path, next] } : sim;
}

const missedHere = (sim: Sim) => (sim.missed.includes(sim.done) ? sim.missed : [...sim.missed, sim.done]);

// "?" and "??": the study shows the move as a mistake.
const isMistake = (n: MoveNode) => n.nags.includes(2) || n.nags.includes(4);

/**
 * The reader's move. Right: it goes on the board. On a fixed path anything else is a mistake, try again (a move
 * the study covers elsewhere is named as such, without giving the expected move away). In a random run a move
 * the study covers anywhere at this position is played on, and the line it belongs to is followed; a move the
 * study marks as a mistake, or one it does not cover, is a mistake.
 */
export function simTry(g: Graph, sim: Sim, san: string | undefined, weights: Weights = {}, rand = Math.random): Sim {
  const expected = simNext(sim);
  if (!expected) return sim;
  const base = { ...sim, detour: undefined };
  if (san === g.node(expected).san)
    return extend(g, { ...base, done: sim.done + 1, feedback: { kind: "right", text: t("Doğru.") } }, weights, rand);
  const at = simAt(sim);
  const known = g.moves(at).find((m) => g.node(m).san === san);
  if (known && sim.random && !isMistake(g.node(known))) {
    const options = g.moves(at).filter((m) => m !== known && chapterOf(m) === chapterOf(expected) && !isMistake(g.node(m)));
    const detour = { index: sim.done, played: known, expected, options };
    return extend(g, { ...base, path: [...sim.path.slice(0, sim.done), known], done: sim.done + 1, feedback: undefined, detour }, weights, rand);
  }
  const why = !known
    ? t("Bu değil. Tekrar dene ya da hamleyi gör.")
    : isMistake(g.node(known))
      ? t("Çalışma bu hamleyi hata olarak inceliyor. Tekrar dene.")
      : t("Bu hamle çalışmanın başka bir varyantında; simüle ettiğin yol bu değil. Tekrar dene.");
  return { ...base, attempt: sim.attempt + 1, missed: missedHere(sim), feedback: { kind: known ? "other" : "wrong", text: why } };
}

/** After a detour: take the reader's move back and play one of the recommended line's moves instead. */
export function simChoose(g: Graph, sim: Sim, option: Ref, weights: Weights = {}, rand = Math.random): Sim {
  if (!sim.detour) return sim;
  const { index } = sim.detour;
  const back = { ...sim, path: [...sim.path.slice(0, index), option], done: index + 1, missed: sim.missed.filter((i) => i < index) };
  return extend(g, { ...back, detour: undefined, feedback: undefined, attempt: sim.attempt + 1 }, weights, rand);
}

/** "Hamleyi göster": the expected move goes on the board and counts as missed. */
export function simReveal(g: Graph, sim: Sim, nameOf: (n: MoveNode) => string, weights: Weights = {}, rand = Math.random): Sim {
  const expected = simNext(sim);
  if (!expected) return sim;
  const shown = {
    ...sim,
    detour: undefined,
    done: sim.done + 1,
    missed: missedHere(sim),
    feedback: { kind: "wrong" as const, text: t("Hamle: {move}.", { move: nameOf(g.node(expected)) }) },

  };
  return extend(g, shown, weights, rand);
}

/** "Yalnız bu bölüm" run that reached the end of its chapter: go on through the whole study (`g` unscoped). */
export const simWiden = (g: Graph, sim: Sim, weights: Weights = {}, rand = Math.random): Sim =>
  extend(g, { ...sim, scope: undefined }, weights, rand);

/** The site plays its move. */
export const simAdvance = (g: Graph, sim: Sim, weights: Weights = {}, rand = Math.random): Sim =>
  extend(g, { ...sim, done: sim.done + 1, feedback: sim.feedback?.kind === "right" ? undefined : sim.feedback }, weights, rand);
