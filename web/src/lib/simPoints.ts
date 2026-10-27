import type { MoveTree } from "./pgnTree";
import { readerMoves, type Side } from "./sim";
import { positionKey } from "./study";

/** Where each line chapter's subject begins (position key → chapter id). */
export function chapterStarts(chapters: Iterable<{ meta: { id: string }; tree: MoveTree; startId?: string }>): Map<string, string> {
  const starts = new Map<string, string>();
  for (const { meta, tree, startId } of chapters) {
    const node = startId !== undefined ? tree.nodes.get(startId) : undefined;
    if (node && node.ply) starts.set(positionKey(node.fen), meta.id);
  }
  return starts;
}

/** Positions the study plays on from somewhere (they have moves in some chapter's tree). */
export function continuing(chapters: Iterable<{ tree: MoveTree }>): Set<string> {
  const keys = new Set<string>();
  for (const { tree } of chapters) for (const node of tree.nodes.values()) if (node.children.length) keys.add(positionKey(node.fen));
  return keys;
}

export interface Course {
  starts: Map<string, string>;
  continuing: Set<string>;
}

/**
 * The positions of a chapter where the site recommends "Simüle et" (its points to simulate): the key moments,
 * and the line ends that close with a comment (a plan summary). Left out: lines the quick path only points to,
 * lines that end where another chapter begins or where the study plays on elsewhere (the run would go past
 * them), and positions with none of the reader's moves on the way.
 */
export function simPoints(chapter: string, tree: MoveTree, startId: string, color: Side, course: Course): string[] {
  const startPly = tree.nodes.get(startId)?.ply ?? 0;
  return [...tree.nodes.values()]
    .filter((n) => {
      if (n.ply <= startPly) return false;
      if (n.critical === undefined) {
        if (n.children.length || n.cut || !n.comment.trim()) return false;
        const key = positionKey(n.fen);
        const owner = course.starts.get(key);
        if ((owner && owner !== chapter) || course.continuing.has(key)) return false;
      }
      return readerMoves(tree, startId, n.id, color) > 0;
    })
    .map((n) => n.id);
}
