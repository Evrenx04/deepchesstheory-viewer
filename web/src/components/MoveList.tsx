import { t } from "../lib/i18n";
import type { ReactNode } from "react";
import { NAG_SYMBOLS, pathTo, type MoveNode, type MoveTree } from "../lib/pgnTree";
import { formatSan } from "../lib/notation";
import { useNotation } from "../lib/notationContext";
import { boxStartedBy } from "../lib/boxes";

interface Props {
  tree: MoveTree;
  current: string;
  /** Moves before this ply are context and shown dimmed. */
  startPly: number;
  onSelect: (id: string) => void;
  /** Quiz moves not found yet: shown as "?" so the list does not give them away. */
  hidden?: Set<string>;
  /** Show only this box ("" the main line): the way to its start and its own moves; other boxes are left out. */
  box?: string;
  /** First moves of the box's side lines (several when lines are grouped into one box). */
  members?: string[];
  /** The chapter's points to simulate: done (simulated without a miss) or not yet. */
  points?: Map<string, boolean>;
}

/** Lichess-style move list: main line inline, side lines indented in brackets. */
export function MoveList({ tree, current, startPly, onSelect, hidden, box, members, points }: Props) {
  const notation = useNotation();
  const onPath = new Set(pathTo(tree, current));
  const move = (id: string, forceNumber: boolean) => {
    const node = tree.nodes.get(id)!;
    const white = node.ply % 2 === 1;
    const number = Math.ceil(node.ply / 2);
    const label = white ? `${number}.` : forceNumber ? `${number}…` : "";
    const nags = node.nags.map((n) => NAG_SYMBOLS[n] ?? "").join("");
    return (
      <button
        key={id}
        className={`move${id === current ? " current" : onPath.has(id) ? " on-path" : ""}${node.ply <= startPly ? " context" : ""}`}
        onClick={() => onSelect(id)}
        aria-current={id === current ? "step" : undefined}
      >
        {label && <span className="move-number">{label}</span>}
        {hidden?.has(id) ? (
          <span className="san quiz-mark" title={t("Soru: bu hamleyi önce sen bul")}>
            ?
          </span>
        ) : (
          <span className="san">{formatSan(node.san, notation)}</span>
        )}
        {nags && !hidden?.has(id) && <span className="nag">{nags}</span>}
        {(node.comment || node.deep) && <span className="has-comment" aria-label={t("yorumlu")} />}
        {node.critical !== undefined && <span className="critical-mark" aria-label={t("kritik an")}>★</span>}
        {points?.has(id) &&
          (points.get(id) ? (
            <span className="sim-tick done" title={t("Hatasız simüle ettin")} aria-label={t("simüle edildi")}>
              ✓
            </span>
          ) : (
            <span className="sim-tick" title={t("Burada simüle etmeni öneriyoruz")} aria-label={t("simüle edilecek")} />
          ))}
      </button>
    );
  };

  // Render a line starting at `id`; side lines of each move follow it.
  const line = (id: string, forceNumber: boolean): ReactNode[] => {
    const out: ReactNode[] = [];
    let currentId: string | undefined = id;
    let needNumber = forceNumber;
    while (currentId) {
      const node: MoveNode = tree.nodes.get(currentId)!;
      out.push(move(currentId, needNumber));
      needNumber = false;
      const parent = tree.nodes.get(node.parent!)!;
      // Inside a box, side lines that open another box are not part of it.
      const siblings = parent.children.slice(1).filter((sib) => box === undefined || (boxStartedBy(tree, sib) ?? box) === box);
      if (parent.children[0] === currentId && siblings.length) {
        out.push(
          <div key={`${currentId}-vars`} className="variations">
            {siblings.map((sib) => (
              <div key={sib} className={`variation${onPath.has(sib) ? " active" : ""}`}>
                {line(sib, true)}
              </div>
            ))}
          </div>,
        );
        needNumber = true;
      }
      currentId = node.children[0];
    }
    return out;
  };

  // A side-line box starts with the moves that lead to it, without their other branches; grouped
  // side lines follow one another.
  if (box) {
    const [first, ...rest] = members?.length ? members : [box];
    return (
      <div className="move-list">
        {pathTo(tree, box)
          .slice(0, -1)
          .map((id, i) => move(id, i === 0))}
        {line(first, true)}
        {rest.length > 0 && (
          <div className="variations">
            {rest.map((id) => (
              <div key={id} className={`variation${onPath.has(id) ? " active" : ""}`}>
                {line(id, true)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const first = tree.nodes.get(tree.root)!.children[0];
  // While the reader is inside a side line, the other side lines step back visually.
  const inSideLine = [...onPath].some((id) => tree.nodes.get(tree.nodes.get(id)!.parent!)!.children[0] !== id);
  return (
    <div className={`move-list${inSideLine ? " in-side-line" : ""}`}>
      {first ? line(first, false) : <span className="muted">{t("Hamle yok")}</span>}

    </div>
  );
}
