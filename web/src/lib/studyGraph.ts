import type { MoveNode, MoveTree } from "./pgnTree";

/** A move node of one chapter, written "chapter|node id". */
export type Ref = string;

export const ref = (chapter: string, id: string): Ref => `${chapter}|${id}`;
export const splitRef = (r: Ref): { chapter: string; id: string } => {
  const at = r.indexOf("|");
  return { chapter: r.slice(0, at), id: r.slice(at + 1) };
};

const positionKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

/**
 * All line chapters of a study joined by position: where a line stops (it transposes, or goes on in
 * another chapter), the same position elsewhere carries on. Lets a run go through the whole study.
 */
export class StudyGraph {
  private trees: Map<string, MoveTree>;
  private byKey = new Map<string, Ref[]>();
  private size = new Map<Ref, number>();

  constructor(chapters: { id: string; tree: MoveTree }[]) {
    this.trees = new Map(chapters.map((c) => [c.id, c.tree]));
    for (const { id: chapter, tree } of chapters) {
      const count = (id: string): number => {
        const node = tree.nodes.get(id)!;
        const n = 1 + node.children.reduce((sum, c) => sum + count(c), 0);
        this.size.set(ref(chapter, id), n);
        const key = positionKey(node.fen);
        if (!this.byKey.has(key)) this.byKey.set(key, []);
        this.byKey.get(key)!.push(ref(chapter, id));
        return n;
      };
      count(tree.root);
    }
    // Where a position is studied most comes first.
    for (const refs of this.byKey.values()) refs.sort((a, b) => this.size.get(b)! - this.size.get(a)!);
  }

  has(r: Ref): boolean {
    const { chapter, id } = splitRef(r);
    return !!this.trees.get(chapter)?.nodes.has(id);
  }

  node(r: Ref): MoveNode {
    const { chapter, id } = splitRef(r);
    return this.trees.get(chapter)!.nodes.get(id)!;
  }

  key(r: Ref): string {
    return positionKey(this.node(r).fen);
  }

  /** This node's own moves (in its chapter). */
  children(r: Ref): Ref[] {
    const { chapter } = splitRef(r);
    return this.node(r).children.map((id) => ref(chapter, id));
  }

  /** Moves the study covers at this position: this node's own first, then those other places add (by SAN). */
  moves(r: Ref): Ref[] {
    const out = this.children(r);
    const seen = new Set(out.map((c) => this.node(c).san));
    for (const other of this.byKey.get(this.key(r)) ?? []) {
      if (other === r) continue;
      for (const c of this.children(other)) {
        const san = this.node(c).san;
        if (!seen.has(san)) {
          seen.add(san);
          out.push(c);
        }
      }
    }
    return out;
  }

  /** The move the study recommends here: this node's main move, or where the line stops, the main move
   * where the position is studied most. */
  main(r: Ref): Ref | undefined {
    const own = this.children(r);
    if (own.length) return own[0];
    const other = this.places(r)[0];
    return other && this.children(other)[0];
  }

  /** Other places in the study where this position has moves, most studied first. */
  places(r: Ref): Ref[] {
    return this.placesAt(this.key(r)).filter((o) => o !== r);
  }

  placesAt(key: string): Ref[] {
    return (this.byKey.get(key) ?? []).filter((o) => this.node(o).children.length);
  }
}

/** What a run needs from the study. */
export type Graph = Pick<StudyGraph, "has" | "node" | "key" | "children" | "moves" | "main" | "places"> & {
  /** On the quick path: whether a node is part of it (the run may go on in the full tree). */
  inQuick?: (r: Ref) => boolean;
};

/**
 * The quick path's graph. Where it has no moves at a position, the full tree's are used, so a run does not stop
 * just because the quick path leaves a line out. Node ids are the same in both trees.
 */
export class QuickGraph implements Graph {
  constructor(
    private quick: StudyGraph,
    private full: StudyGraph,
  ) {}

  has = (r: Ref) => this.full.has(r);
  inQuick = (r: Ref) => this.quick.has(r);
  node = (r: Ref) => (this.quick.has(r) ? this.quick.node(r) : this.full.node(r));
  key = (r: Ref) => this.full.key(r);
  children = (r: Ref) => (this.quick.has(r) ? this.quick.children(r) : this.full.children(r));

  moves(r: Ref): Ref[] {
    const at = this.quick.has(r) ? r : this.quick.placesAt(this.key(r))[0];
    const quick = at ? this.quick.moves(at) : [];
    return quick.length ? quick : this.full.moves(r);
  }

  main = (r: Ref): Ref | undefined => this.moves(r)[0];

  places(r: Ref): Ref[] {
    const quick = this.quick.placesAt(this.key(r)).filter((o) => o !== r);
    return quick.length ? quick : this.full.places(r);
  }
}
