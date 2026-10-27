import type { MoveTree } from "../lib/pgnTree";

/** Id of the node reached by the given moves from the root, e.g. idAt(tree, "e4 c5"); throws if a move is not in the tree. */
export function idAt(tree: MoveTree, moves: string): string {
  let id = tree.root;
  for (const san of moves.split(" ").filter(Boolean)) {
    const next = tree.nodes.get(id)!.children.find((c) => tree.nodes.get(c)!.san === san);
    if (next === undefined) throw new Error(`${san} not found after "${id}"`);
    id = next;
  }
  return id;
}
