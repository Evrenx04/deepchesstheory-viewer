import { t } from "../lib/i18n";
import type { MoveNode, MoveTree } from "../lib/pgnTree";
import { NAG_SYMBOLS } from "../lib/pgnTree";
import { formatSan } from "../lib/notation";
import { useNotation } from "../lib/notationContext";
import { RichInline } from "./RichText";

interface Props {
  tree: MoveTree;
  node: MoveNode;
  onSelect: (id: string) => void;
  /** Moves not offered here (they open another box). */
  exclude?: Set<string>;
}

/** Opening sentence of a comment, without markup, as a one-line preview. A very short
 * first sentence ("Erken.") takes the next one along. */
export function preview(text: string, max = 110): string {
  const plain = text
    .replace(/\[\[[\w-]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\*\*?([^*]+)\*\*?/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = plain.split(/(?<=[.!?:])\s/);
  let out = sentences[0];
  if (out.length < 30 && sentences[1]) out += ` ${sentences[1]}`;
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}

// A side line's idea is often explained a move or two after it starts.
function lineComment(tree: MoveTree, node: MoveNode): string {
  for (let n: MoveNode | undefined = node, i = 0; n && i < 4; n = tree.nodes.get(n.children[0]), i++)
    if (n.comment) return n.comment;
  return "";
}

export function moveText(node: MoveNode, notation: Parameters<typeof formatSan>[1], forceNumber = true) {
  const number = Math.ceil(node.ply / 2);
  const prefix = node.ply % 2 ? `${number}.` : forceNumber ? `${number}…` : "";
  return `${prefix}${formatSan(node.san, notation)}${node.nags.map((n) => NAG_SYMBOLS[n] ?? "").join("")}`;
}

/** The choices at this position: what comes next, and what could have been played instead. */
export function NextMoves({ tree, node, onSelect, exclude }: Props) {
  const notation = useNotation();
  const children = node.children.filter((id) => !exclude?.has(id)).map((id) => tree.nodes.get(id)!);
  const parent = node.parent !== null ? tree.nodes.get(node.parent)! : null;
  const siblings = parent ? parent.children.filter((id) => id !== node.id && !exclude?.has(id)).map((id) => tree.nodes.get(id)!) : [];

  if (!children.length && !siblings.length) return null;
  return (
    <div className="next-moves">
      {children.length > 0 && (
        <>
          {/* One move on: named too, so the main line never goes on unseen (user, 2026-10-26). */}
          <div className="next-title">{children.length > 1 ? t("Burada {n} seçenek var", { n: children.length }) : t("Sıradaki hamle")}</div>
          <ul>
            {children.map((child, i) => (
              <li key={child.id}>
                <button className="next-move" onClick={() => onSelect(child.id)}>
                  <span className="san">{moveText(child, notation)}</span>
                  <span className={`next-tag${i === 0 ? " main" : ""}`}>{i === 0 ? t("ana hat") : t("alternatif")}</span>
                  {lineComment(tree, child) && <span className="next-preview"><RichInline text={preview(lineComment(tree, child))} /></span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {siblings.length > 0 && (
        <div className="instead">
          <span>{t("Bunun yerine:")}</span>

          {siblings.map((sib) => (
            <button key={sib.id} className="instead-move san" onClick={() => onSelect(sib.id)}>
              {moveText(sib, notation)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
