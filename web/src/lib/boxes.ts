import { pathTo, type MoveTree } from "./pgnTree";

/** A part of a chapter studied on its own: the main line ("") or side lines marked [%kutu]. Side lines that
 * leave the same position under the same name ("[%kutu Diğerleri]") share one box. */
export interface Box {
  /** "" for the main line, else the id of the box's first side line. */
  id: string;
  /** First move of each side line in the box (one, unless several are grouped). */
  members: string[];
  /** The box this one branches from. */
  parent?: string;
  /** The name given in [%kutu Ad], if any. */
  name?: string;
  /** Moves in the box (nested boxes not counted). */
  size: number;
}

const groupCache = new WeakMap<MoveTree, Map<string, string>>();

/** Each marked side line's first move → the id of its box (the first of its group). */
function groups(tree: MoveTree): Map<string, string> {
  let map = groupCache.get(tree);
  if (map) return map;
  map = new Map();
  const first = new Map<string, string>();
  // Within a position the children come in PGN order, so the first of a group is the first one written.
  for (const parent of tree.nodes.values())
    for (const id of parent.children) {
      const name = tree.nodes.get(id)!.box;
      if (name === undefined) continue;
      const key = name ? `${parent.id}|${name}` : `#${id}`;
      if (!first.has(key)) first.set(key, id);
      map.set(id, first.get(key)!);
    }
  groupCache.set(tree, map);
  return map;
}

export const hasBoxes = (tree: MoveTree) => groups(tree).size > 0;

/** The box a side line's first move opens, or undefined if it opens none. */
export const boxStartedBy = (tree: MoveTree, id: string) => groups(tree).get(id);

/** The box a position belongs to: the innermost box started on the way to it. */
export function boxOf(tree: MoveTree, id: string): string {
  let box = "";
  for (const step of pathTo(tree, id)) box = groups(tree).get(step) ?? box;
  return box;
}

/** Whether a position comes before a side-line box starts: shown for context, without its other choices. */
export function onWayTo(tree: MoveTree, box: string, id: string): boolean {
  if (box === "") return false;
  return id === tree.root || pathTo(tree, box).slice(0, -1).includes(id);
}

/** Whether a position is shown inside a box: one of its moves, or a move on the way to its start. */
export function inBox(tree: MoveTree, box: string, id: string): boolean {
  return boxOf(tree, id) === box || onWayTo(tree, box, id);
}

/** The chapter's boxes: the main line first, then the others in the order they branch off. */
export function chapterBoxes(tree: MoveTree): Box[] {
  const sizes = new Map<string, number>();
  for (const node of tree.nodes.values()) {
    if (node.parent === null) continue;
    const box = boxOf(tree, node.id);
    sizes.set(box, (sizes.get(box) ?? 0) + 1);
  }
  const members = new Map<string, string[]>();
  for (const [id, box] of groups(tree)) members.set(box, [...(members.get(box) ?? []), id]);
  const sides = [...members.entries()]
    .map(([id, ids]) => {
      const node = tree.nodes.get(id)!;
      return { id, members: ids, parent: boxOf(tree, node.parent!), name: node.box || undefined, size: sizes.get(id) ?? 0 };
    })
    .sort((a, b) => tree.nodes.get(a.id)!.ply - tree.nodes.get(b.id)!.ply);
  return [{ id: "", members: [], size: sizes.get("") ?? 0 }, ...sides];
}

/** Inside a box, moving forward from a position on the way to its start follows that way, not the main move. */
export function nextInBox(tree: MoveTree, box: string, id: string): string | undefined {
  if (onWayTo(tree, box, id)) {
    const way = pathTo(tree, box);
    return id === tree.root ? way[0] : way[way.indexOf(id) + 1];
  }
  return tree.nodes.get(id)!.children[0];
}

/** The moves at a position that open a box other than `box`: shown as a note, not as choices. */
export function otherBoxesAt(tree: MoveTree, box: string, id: string): string[] {
  return tree.nodes.get(id)!.children.filter((c) => {
    const opens = boxStartedBy(tree, c);
    return opens !== undefined && opens !== box;
  });
}

/** The first position on the main line where a box branches off: the chapter's first decision. */
export function firstDecision(tree: MoveTree, startId: string): string | undefined {
  for (let node = tree.nodes.get(startId); node; node = tree.nodes.get(node.children[0]))
    if (node.children.some((c) => boxStartedBy(tree, c) !== undefined)) return node.id;
  return undefined;
}
