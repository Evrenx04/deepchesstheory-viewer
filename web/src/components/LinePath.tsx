import { pathTo, type MoveTree } from "../lib/pgnTree";
import { useNotation } from "../lib/notationContext";
import { moveText } from "./NextMoves";
import { L, t } from "../lib/i18n";

interface Props {
  tree: MoveTree;
  current: string;
  onSelect: (id: string) => void;
}

/** How the reader got here: every point where they left the main line (or a side line), with the move
 * it replaced. A choice leads back to its branch point, where the other moves can be picked. */
export function LinePath({ tree, current, onSelect }: Props) {
  const notation = useNotation();
  // Each move that is not its parent's first child starts a side line.
  const choices = pathTo(tree, current).filter((id) => {
    const node = tree.nodes.get(id)!;
    return tree.nodes.get(node.parent!)!.children[0] !== id;
  });
  if (!choices.length)
    return (
      <div className="line-path on-main">
        <div className="path-row">
          <span className="path-label">{t("Yol")}</span>
          <span className="path-chip main active">{t("Başlangıç")}</span>
        </div>
      </div>
    );
  const backTo = tree.nodes.get(choices[0])!.parent!;
  const last = tree.nodes.get(choices[choices.length - 1])!;
  return (
    <div className="line-path" aria-label={t("Buraya gelinen yol")}>
      <div className="path-row">
        <span className="path-label">{t("Yol")}</span>
        <button className="path-chip main" onClick={() => onSelect(backTo)} title={t("İlk ayrıldığın konuma dön")}>
          {t("Başlangıç")}
        </button>
        {choices.map((id, i) => {
          const node = tree.nodes.get(id)!;
          const instead = tree.nodes.get(tree.nodes.get(node.parent!)!.children[0])!;
          return (
            <span key={id} className="path-step">
              <span aria-hidden="true">›</span>
              <button
                className={`path-chip${i === choices.length - 1 ? " active" : ""}`}
                onClick={() => onSelect(node.parent!)}
                title={t("Bu seçimin yapıldığı konuma dön; oradaki öbür hamleler görünür")}
              >
                <span className="san">{moveText(node, notation)}</span>
                <span className="path-instead">
                  {" "}
                  {L(
                    <>
                      (<span className="san">{moveText(instead, notation)}</span> yerine)
                    </>,
                    <>
                      (instead of <span className="san">{moveText(instead, notation)}</span>)
                    </>,
                  )}
                </span>
              </button>
            </span>
          );
        })}
      </div>
      <div className="path-actions">
        {choices.length > 1 && (
          <button className="back-main" onClick={() => onSelect(last.parent!)}>
            ↩ {t("Son seçime dön")}
          </button>
        )}
        <button className="back-main" onClick={() => onSelect(backTo)}>
          ↩ {t("İlk ayrıldığın yere dön")}

        </button>
      </div>
    </div>
  );
}
