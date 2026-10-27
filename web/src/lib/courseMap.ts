import { pathTo, type MoveNode, type MoveTree } from "./pgnTree";
import type { ChapterMeta } from "./study";

export interface MapNode {
  /** The SANs from the initial position to the end of this node's run, joined by spaces ("" for an empty root). */
  id: string;
  /** This node's run of moves. */
  moves: string[];
  /** Ply before the first move of the run. */
  startPly: number;
  /** Numbered run, e.g. "4.c3 Nf6 5.d3" or "5...d6 6.O-O". */
  label: string;
  /** Position after the run. */
  fen: string;
  /** Where the position after the run is in a chapter's tree, for opening it. */
  at?: { chapter: string; node: string };
  /** Chapters whose subject begins after this run. */
  chapters: string[];
  children: MapNode[];
}

/** "5...d6 6.O-O": the first move gets its number either way; a White move gets one after that. */
export function numbered(sans: string[], startPly: number): string {
  return sans
    .map((san, i) => {
      const ply = startPly + i;
      const n = Math.floor(ply / 2) + 1;
      if (ply % 2 === 0) return `${n}.${san}`;
      return i === 0 ? `${n}...${san}` : san;
    })
    .join(" ");
}

interface Trie {
  san: string;
  fen: string;
  at?: { chapter: string; node: string };
  chapters: string[];
  /** Lowest chapter index (study order) under this branch. */
  first: number;
  children: Map<string, Trie>;
}

/**
 * The course as an opening tree: each line chapter's main line up to its [Start] position, merged by SAN,
 * chains of single moves joined into one node. The root's run is the common trunk (3...Bc5 here);
 * branches follow the chapters' order in the study (A before B).
 */
export function buildCourseMap(chapters: { meta: ChapterMeta; tree: MoveTree; startId: string }[]): MapNode {
  const root: Trie = { san: "", fen: "", chapters: [], first: Infinity, children: new Map() };
  chapters.forEach(({ meta, tree, startId }, index) => {
    let at = root;
    at.first = Math.min(at.first, index);
    const rootNode = tree.nodes.get(tree.root)!;
    if (!at.fen) at.fen = rootNode.fen;
    at.at ??= { chapter: meta.id, node: tree.root };
    for (const id of pathTo(tree, startId)) {
      const node = tree.nodes.get(id)!;
      let next = at.children.get(node.san);
      if (!next) {
        next = { san: node.san, fen: node.fen, at: { chapter: meta.id, node: id }, chapters: [], first: index, children: new Map() };
        at.children.set(node.san, next);
      }
      next.first = Math.min(next.first, index);
      at = next;
    }
    at.chapters.push(meta.id);
  });

  const build = (start: Trie, path: string[], ply: number, isRoot: boolean): MapNode => {
    const moves: string[] = isRoot ? [] : [start.san];
    const chapters = [...start.chapters];
    let at = start;
    // The root runs on through the trunk even when a chapter (the introduction) begins at the initial position.
    while (at.children.size === 1 && (isRoot || !at.chapters.length)) {
      at = [...at.children.values()][0];
      moves.push(at.san);
      chapters.push(...at.chapters);
      if (at.chapters.length) break;
    }
    const full = [...path, ...moves];
    const startPly = isRoot ? 0 : ply;
    return {
      id: full.join(" "),
      moves,
      startPly,
      label: numbered(moves, startPly),
      fen: at.fen,
      ...(at.at ? { at: at.at } : {}),
      chapters,
      children: [...at.children.values()]
        .sort((a, b) => a.first - b.first)
        .map((child) => build(child, full, startPly + moves.length, false)),
    };
  };
  return build(root, [], 0, true);
}

/** Indented text of the map, one node per line (for tests and debugging). */
export function mapText(node: MapNode, names: (id: string) => string = (id) => id, depth = 0): string[] {
  const own = node.chapters.length ? `  [${node.chapters.map(names).join(", ")}]` : "";
  return [`${"  ".repeat(depth)}${node.label || "(başlangıç)"}${own}`, ...node.children.flatMap((c) => mapText(c, names, depth + 1))];
}

export interface SideLine {
  node: MoveNode;
  /** Numbered moves from the chapter's start to the line's first move, e.g. "6...a6 7.Bb3"; long ones keep the last moves. */
  label: string;
  /** The line's box or key-moment name, when it has one. */
  name?: string;
}

const MAX_SIDE_LINES = 8;
const MAX_LABEL_MOVES = 4;

/**
 * The chapter's named sub-lines for the map: first moves of the quick path's side lines after the
 * chapter's start (moves marked [%hizli]), in the order they come up on the board; at most 8.
 */
export function sideLines(tree: MoveTree, quick: MoveTree | undefined, startId: string): SideLine[] {
  const source = quick ?? tree;
  const start = source.nodes.get(startId);
  if (!start) return [];
  const out: SideLine[] = [];
  const walk = (id: string, sans: string[]) => {
    const node = source.nodes.get(id)!;
    node.children.forEach((childId, i) => {
      const child = source.nodes.get(childId)!;
      const run = [...sans, child.san];
      if (i > 0 && (quick || child.fast)) {
        const keep = run.length > MAX_LABEL_MOVES ? run.slice(-MAX_LABEL_MOVES) : run;
        const name = child.box || child.critical || undefined;
        out.push({ node: child, label: numbered(keep, child.ply - keep.length), ...(name ? { name } : {}) });
      }
      walk(childId, run);
    });
  };
  walk(startId, []);
  return out.sort((a, b) => a.node.ply - b.node.ply).slice(0, MAX_SIDE_LINES);
}
