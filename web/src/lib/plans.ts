import { pathTo, type MoveTree } from "./pgnTree";

export interface PlanMeta {
  side: "white" | "black";
  title: string;
  /** Moves in SAN ("Nd2", "h3", "d5"); a step counts as done once that piece reaches that square. */
  steps: string[];
}

/** "Nbd2" / "Nxd2+" → "Nd2"; pawn moves keep only the target square; castling stays as is. */
export function stepKey(san: string): string {
  const s = san.replace(/[+#!?]/g, "").replace(/=[QRBN]$/, "");
  if (s.startsWith("O-O")) return s;
  const piece = /^[KQRBN]/.test(s) ? s[0] : "";
  return piece + s.slice(-2);
}

/** For each step of the plan, whether it has been played on the way to `nodeId`. */
export function planProgress(tree: MoveTree, nodeId: string, plan: PlanMeta): boolean[] {
  const played = new Set(
    pathTo(tree, nodeId)
      .map((id) => tree.nodes.get(id)!)
      .filter((n) => (n.ply % 2 === 1) === (plan.side === "white"))
      .map((n) => stepKey(n.san)),
  );
  return plan.steps.map((step) => played.has(stepKey(step)));
}
