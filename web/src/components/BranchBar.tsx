import { t } from "../lib/i18n";
import type { MoveNode, MoveTree } from "../lib/pgnTree";
import { useNotation } from "../lib/notationContext";
import { moveText } from "./NextMoves";

interface Props {
  tree: MoveTree;
  node: MoveNode;
  onSelect: (id: string) => void;
  /** Moves not offered here (they open another box). */
  exclude?: Set<string>;
}

/** Sits under the board, so a branch point is visible however long the comment is. */
export function BranchBar({ tree, node, onSelect, exclude }: Props) {
  const notation = useNotation();
  const children = node.children.filter((id) => !exclude?.has(id));
  if (children.length < 2) return null;
  return (
    <div className="branch-bar" role="group" aria-label={t("Bu konumdaki seçenekler")}>
      <span className="branch-label">⑂ {t("Burada dallanıyor:")}</span>
      {children.map((id, i) => (
        <button key={id} className={`branch-chip${i === 0 ? " main" : ""}`} onClick={() => onSelect(id)} title={i === 0 ? t("Ana hat (→)") : t("Yan varyant")}>

          <span className="san">{moveText(tree.nodes.get(id)!, notation)}</span>
        </button>
      ))}
    </div>
  );
}
