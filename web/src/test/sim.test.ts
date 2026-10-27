import { describe, expect, it } from "vitest";
import { lineEnd, mainlineAt, parseStudyPgn, quickTree, type MoveNode, type MoveTree } from "../lib/pgnTree";
import {
  chapterOf,
  moveChances,
  readerIndices,
  readerMoves,
  readerTurn,
  simAdvance,
  simAt,
  simChoose,
  simGoOn,
  simNext,
  simRecommended,
  simReveal,
  simTry,
  simWiden,
  startRandom,
  startSim,
  type Weights,
} from "../lib/sim";
import { QuickGraph, ref, StudyGraph, type Ref } from "../lib/studyGraph";
import { idAt } from "./nodes";

// Chapter "a": 2...d6 stops at once; chapter "b" goes on from 3.Bc4 (the end of a's 3.Bc4 line).
const A = `[Event "a"]
[Start "2"]

1. e4 e5 2. Nf3 Nc6 (2... d6 3. d4 { Varyant sonu planı. }) (2... Nf6 3. Nxe5) 3. Bc4 { [%kritik Fil] } (3. Bb5 a6) *`;
const B = `[Event "b"]
[Start "5"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 (3... Nf6 4. Ng5) 4. c3 Nf6 *`;
const a = parseStudyPgn(A);
const b = parseStudyPgn(B);
const graph = new StudyGraph([
  { id: "a", tree: a },
  { id: "b", tree: b },
]);
const name = (n: MoveNode) => n.san;
const startA = mainlineAt(a, 2);
const afterNf3 = ref("a", mainlineAt(a, 3));
const sans = (refs: Ref[]) => refs.map((r) => graph.node(r).san);

describe("simulation along a path", () => {
  const target = mainlineAt(a, 5); // 3.Bc4

  it("runs from the chapter start to the target", () => {
    const sim = startSim("a", a, startA, target, "white");
    expect(sans(sim.path)).toEqual(["Nf3", "Nc6", "Bc4"]);
    expect(simAt(sim)).toBe(ref("a", startA));
    expect(readerMoves(a, startA, target, "white")).toBe(2);
    expect(readerIndices(graph, sim)).toEqual([0, 2]);
  });

  it("takes the right move; a wrong one counts, a move of another line is named but counts too", () => {
    const sim = simAdvance(graph, startSim("a", a, startA, mainlineAt(a, 4), "black"));
    const other = simTry(graph, sim, "d6");
    expect(other.feedback?.kind).toBe("other");
    expect(other.feedback?.text).not.toContain("Nc6");
    expect(other.done).toBe(1);
    expect(other.missed).toEqual([1]);
    const wrong = simTry(graph, sim, "a6");
    expect(wrong.feedback?.kind).toBe("wrong");
    expect(simTry(graph, wrong, "a6").missed).toEqual([1]);
    const right = simTry(graph, wrong, "Nc6");
    expect(right.done).toBe(2);
    expect(right.missed).toEqual([1]);
  });

  it("reveals a move as missed and stops at the end", () => {
    let sim = startSim("a", a, startA, mainlineAt(a, 4), "white");
    sim = simReveal(graph, sim, name);
    expect(sim.missed).toEqual([0]);
    sim = simAdvance(graph, sim);
    expect(simNext(sim)).toBeUndefined();
    expect(simTry(graph, sim, "Bc4")).toBe(sim);
  });

  it("recommends key moments and line ends with a closing comment", () => {
    expect(simRecommended(a.nodes.get(mainlineAt(a, 5))!)).toBe(true);
    const d6 = a.nodes.get(a.nodes.get(mainlineAt(a, 3))!.children[1])!;
    expect(simRecommended(a.nodes.get(lineEnd(a, d6.id))!)).toBe(true);
    expect(simRecommended(a.nodes.get(mainlineAt(a, 4))!)).toBe(false);
  });
});

describe("study graph", () => {
  it("offers the moves of every chapter at a position, this chapter's first", () => {
    const bc4 = ref("a", mainlineAt(a, 5));
    expect(graph.node(bc4).children).toEqual([]);
    expect(sans(graph.moves(bc4))).toEqual(["Bc5", "Nf6"]);
    expect(graph.main(bc4)).toBe(ref("b", mainlineAt(b, 6)));
    expect(sans(graph.moves(afterNf3))).toEqual(["Nc6", "d6", "Nf6"]);
  });
});

describe("random opponent", () => {
  const weights: Weights = { [graph.key(afterNf3)]: { Nc6: [600, 50], d6: [200, 10], Nf6: [200, 40] } };

  it("weighs the study's moves by Lichess games, then masters, then equally", () => {
    const chances = (w: Weights) => [...moveChances(graph, afterNf3, w).values()];
    expect(chances(weights)).toEqual([0.6, 0.2, 0.2]);
    expect(chances({ [graph.key(afterNf3)]: { Nc6: [10, 50], d6: [5, 10], Nf6: [0, 40] } })).toEqual([0.5, 0.1, 0.4]);
    expect(chances({})).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it("picks the site's move by chance and expects the main move from the reader", () => {
    const pickAt = (r: number) => sans(startRandom(graph, afterNf3, "white", weights, () => r).path);
    expect(pickAt(0.1)).toEqual(["Nc6"]);
    expect(pickAt(0.7)).toEqual(["d6"]);
    expect(pickAt(0.9)).toEqual(["Nf6"]);
    let sim = simAdvance(graph, startRandom(graph, afterNf3, "white", weights, () => 0.9), weights);
    expect(readerTurn(graph, sim)).toBe(true);
    expect(simTry(graph, sim, "d3").feedback?.kind).toBe("wrong");
    sim = simTry(graph, sim, "Nxe5", weights);
    expect(sans(sim.path)).toEqual(["Nf6", "Nxe5"]);
    expect(simNext(sim)).toBeUndefined();
  });

  it("goes on in another chapter where a line stops", () => {
    let sim = startRandom(graph, ref("a", startA), "black", weights, () => 0.1);
    while (simNext(sim))
      sim = readerTurn(graph, sim) ? simTry(graph, sim, graph.node(simNext(sim)!).san, weights, () => 0.1) : simAdvance(graph, sim, weights, () => 0.1);
    expect(sans(sim.path)).toEqual(["Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6"]);
    expect(sim.path.slice(3).every((r) => r.startsWith("b|"))).toBe(true);
  });

  it("stops when a position comes up again", () => {
    const rep = parseStudyPgn(`[Event "r"]\n\n1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 *`);
    const g = new StudyGraph([{ id: "r", tree: rep }]);
    let sim = startRandom(g, ref("r", ""), "white", {});
    while (simNext(sim)) sim = readerTurn(g, sim) ? simTry(g, sim, g.node(simNext(sim)!).san) : simAdvance(g, sim);
    expect(sim.path).toHaveLength(4);
    expect(sim.repeated).toBe(true);
  });
});

describe("lines outside the study", () => {
  it("are never picked by the random opponent", () => {
    const t = parseStudyPgn(`[Event "o"]\n\n1. e4 e5 (1... c5 { [%disari] Sicilya. }) 2. Nf3 *`);
    const g = new StudyGraph([{ id: "o", tree: t }]);
    const [e4, e5, c5] = ["e4", "e4 e5", "e4 c5"].map((m) => idAt(t, m));
    expect(t.nodes.get(c5)!.outside).toBe(true);
    expect(t.nodes.get(c5)!.comment).toBe("Sicilya.");
    const w: Weights = { [g.key(ref("o", e4))]: { c5: [900, 0], e5: [100, 0] } };
    expect([...moveChances(g, ref("o", e4), w).keys()]).toEqual([ref("o", e5)]);
    expect(startRandom(g, ref("o", e4), "white", w, () => 0.99).path.map((r) => g.node(r).san)).toEqual(["e5"]);
  });
});

describe("free play against the opponent", () => {
  const x = parseStudyPgn(`[Event "x"]\n\n1. e4 (1. f3 $2) (1. Nf3) e5 *`);
  const y = parseStudyPgn(`[Event "y"]\n\n1. d4 d5 *`);
  const g = new StudyGraph([
    { id: "x", tree: x },
    { id: "y", tree: y },
  ]);
  const names = (s: { path: Ref[] }) => s.path.map((r) => g.node(r).san);

  it("follows a move of another chapter and offers the recommended line's moves to go back", () => {
    let sim = startRandom(g, ref("x", ""), "white", {});
    sim = simTry(g, sim, "d4");
    expect(sim.missed).toEqual([]);
    expect(sim.detour?.played).toBe(ref("y", idAt(y, "d4")));
    expect(sim.detour?.options.map((o) => g.node(o).san)).toEqual(["e4", "Nf3"]);
    expect(names(sim)).toEqual(["d4", "d5"]);
    sim = simChoose(g, simAdvance(g, sim), ref("x", idAt(x, "e4")));
    expect(sim.detour).toBeUndefined();
    expect(sim.done).toBe(1);
    expect(names(sim)).toEqual(["e4", "e5"]);
  });

  it("names a side line of the same chapter, and keeps moves marked as mistakes wrong", () => {
    const side = simTry(g, startRandom(g, ref("x", ""), "white", {}), "Nf3");
    expect(chapterOf(side.detour!.played)).toBe(chapterOf(side.detour!.expected));
    const bad = simTry(g, startRandom(g, ref("x", ""), "white", {}), "f3");
    expect(bad.detour).toBeUndefined();
    expect(bad.feedback?.text).toContain("hata");
    expect(bad.missed).toEqual([0]);
  });

  it("stays in its chapter when asked", () => {
    const only = new StudyGraph([{ id: "x", tree: x }]);
    const sim = simTry(only, startRandom(only, ref("x", ""), "white", {}, Math.random, "x"), "d4");
    expect(sim.feedback?.kind).toBe("wrong");
    expect(sim.scope).toBe("x");
  });
});

describe("a run kept to one chapter", () => {
  it("can go on through the whole study where its chapter stops", () => {
    const only = new StudyGraph([{ id: "a", tree: a }]);
    const bc4 = ref("a", mainlineAt(a, 5));
    let sim = startRandom(only, ref("a", mainlineAt(a, 4)), "black", {}, () => 0.1, "a");
    sim = simAdvance(only, sim);
    expect(simAt(sim)).toBe(bc4);
    expect(simNext(sim)).toBeUndefined();
    sim = simWiden(graph, sim);
    expect(sim.scope).toBeUndefined();
    expect(sans(sim.path)).toEqual(["Bc4", "Bc5"]);
  });
});

// The node reached by these moves from the start, side lines included.
const nodeAt = (tree: MoveTree, sans: string[]): string =>
  sans.reduce((id, san) => tree.nodes.get(id)!.children.find((c) => tree.nodes.get(c)!.san === san)!, tree.root);

describe("a fixed run past a transposition", () => {
  // "t": 3...Nf6 4.d3 Bc5 5.c3 transposes to the main line's 5.d3. "u" reaches it too, and only "t" goes on.
  const t = parseStudyPgn(`[Event "t"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 (3... Nf6 4. d3 Bc5 5. c3 { Ana hatta döndü. }) 4. c3 Nf6 5. d3 d6 6. O-O { Plan. } *`);
  const u = parseStudyPgn(`[Event "u"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. c3 { T bölümünde sürüyor. } *`);
  const g = new StudyGraph([
    { id: "t", tree: t },
    { id: "u", tree: u },
  ]);
  const names = (refs: Ref[]) => refs.map((r) => g.node(r).san);

  it("goes on along the main line to the real end of the line", () => {
    const leaf = nodeAt(t, ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "d3", "Bc5", "c3"]);
    const sim = startSim("t", t, t.root, leaf, "white", g);
    expect(names(sim.path).slice(-3)).toEqual(["c3", "d6", "O-O"]);
    expect(sim.end).toBe(ref("t", lineEnd(t, t.root)));
    expect(sim.joins).toEqual([8]);
    expect(sim.onward).toBeUndefined();
    expect(simRecommended(t.nodes.get(leaf)!, true)).toBe(false);
    expect(simRecommended(t.nodes.get(leaf)!)).toBe(true);
  });

  it("stops where another chapter takes over, and goes on there when asked", () => {
    const leaf = lineEnd(u, u.root);
    let sim = startSim("u", u, u.root, leaf, "black", g);
    expect(sim.path).toHaveLength(9);
    expect(sim.end).toBeUndefined();
    expect(names([sim.onward!])).toEqual(["d6"]);
    sim = { ...sim, done: sim.path.length };
    sim = simGoOn(g, sim);
    expect(names(sim.path.slice(9))).toEqual(["d6", "O-O"]);
    expect(chapterOf(sim.end!)).toBe("t");
    expect(sim.onward).toBeUndefined();
    expect(simNext(sim)).toBe(sim.path[9]);
  });

  it("passes through another chapter's moves that come back to its own", () => {
    // "v": 3...Nf6 4.O-O stops; "w" plays 4...Bc5 from there, which is v's main line again (4.O-O Nf6).
    const v = parseStudyPgn(`[Event "v"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 (3... Nf6 4. O-O) 4. O-O Nf6 5. d3 d6 *`);
    const w = parseStudyPgn(`[Event "w"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O Bc5 *`);
    const vw = new StudyGraph([
      { id: "v", tree: v },
      { id: "w", tree: w },
    ]);
    const leaf = nodeAt(v, ["e4", "e5", "Nf3", "Nc6", "Bc4", "Nf6", "O-O"]);
    const sim = startSim("v", v, v.root, leaf, "white", vw);
    expect(sim.path.slice(7).map(chapterOf)).toEqual(["w", "v", "v"]);
    expect(sim.path.slice(7).map((r) => vw.node(r).san)).toEqual(["Bc5", "d3", "d6"]);
    expect(sim.joins).toEqual([6, 7]);
    expect(sim.onward).toBeUndefined();
  });

  it("does not go round a repetition", () => {
    const r = parseStudyPgn(`[Event "r"]

1. e4 e5 2. Nf3 Nc6 3. Ng1 Nb8 4. Nf3 Nc6 *`);
    const sim = startSim("r", r, r.root, lineEnd(r, r.root), "white", new StudyGraph([{ id: "r", tree: r }]));
    expect(sim.path).toHaveLength(8);
    expect(sim.end).toBeUndefined();
  });
});

describe("the quick path's graph", () => {
  // In "r" the quick path leaves 3.Bc4 out; "p" reaches its position on the quick path.
  const r = parseStudyPgn(`[Event "r"]

1. e4 e5 2. Nf3 (2. Bc4 { [%hizli] } Nf6) 2... Nc6 3. Bb5 (3. Bc4 Bc5 4. c3) 3... a6 *`);
  const p = parseStudyPgn(`[Event "p"]

1. e4 e5 2. Bc4 { [%hizli] } (2. d4 exd4) 2... Nc6 3. Nf3 Bc5 *`);
  const chapters = (quick: boolean) =>
    new StudyGraph([
      { id: "r", tree: (quick && quickTree(r)) || r },
      { id: "p", tree: (quick && quickTree(p)) || p },
    ]);
  const g = new QuickGraph(chapters(true), chapters(false));

  it("goes on in the full tree where the quick path has nothing more", () => {
    const from = ref("p", nodeAt(p, ["e4", "e5", "Bc4", "Nc6", "Nf3"]));
    let sim = startRandom(g, from, "black", {});
    sim = simTry(g, sim, "Bc5");
    expect(sim.path.map((m) => g.node(m).san)).toEqual(["Bc5", "c3"]);
    expect(g.inQuick(sim.path[0])).toBe(true);
    expect(g.inQuick(sim.path[1])).toBe(false);
  });

  it("keeps to the quick path where it has moves", () => {
    const root = ref("r", r.root);
    expect(g.moves(ref("r", nodeAt(r, ["e4", "e5", "Nf3", "Nc6"]))).map((m) => g.node(m).san)).toEqual(["Bb5"]);
    expect(g.main(root)).toBe(ref("r", nodeAt(r, ["e4"])));
  });
});
