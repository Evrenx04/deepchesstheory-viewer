import { L, t } from "../lib/i18n";
import { ChevronDown } from "lucide-react";
import { pathTo, type MoveTree } from "../lib/pgnTree";
import type { ChapterMeta } from "../lib/study";
import type { Notation } from "../lib/notation";
import { chapterBoxes, firstDecision, type Box } from "../lib/boxes";
import { useNotation } from "../lib/notationContext";
import { moveText, preview } from "./NextMoves";
import { RichInline, RichText } from "./RichText";
import { MiniBoard } from "./MiniBoard";

interface Props {
  tree: MoveTree;
  meta: ChapterMeta;
  startId: string;
  showDeep: boolean;
  onToggleDeep: () => void;
  onOpen: (id: string) => void;
  orientation: "white" | "black";
}

/** What a box is called: the main line by its move at the chapter's first decision ("5…d6"), a single side
 * line by its first move, a group by its name (with its moves when `withMoves`). */
export function boxLabel(tree: MoveTree, box: string, startId: string, notation: Notation, withMoves = false): string {
  if (box === "") {
    const decision = firstDecision(tree, startId);
    return decision !== undefined ? moveText(tree.nodes.get(tree.nodes.get(decision)!.children[0])!, notation) : t("Ana hat");
  }
  const info = chapterBoxes(tree).find((b) => b.id === box);
  if (info && info.members.length > 1) {
    const moves = info.members.map((id) => moveText(tree.nodes.get(id)!, notation)).join(", ");
    return withMoves ? `${info.name ?? t("Diğerleri")} (${moves})` : (info.name ?? moves);
  }
  return moveText(tree.nodes.get(box)!, notation);
}

// A line's idea is often explained a move or two after it starts; leading statistics are skipped.
function linePreview(tree: MoveTree, id: string): string {
  let node = tree.nodes.get(id);
  for (let i = 0; node && i < 4; node = tree.nodes.get(node.children[0]), i++) {
    const text = preview(node.comment.replace(/^(\([^)]*\)\s*)+/, ""), 90);
    if (text) return text;
  }
  return "";
}

const NUMBERS = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz"];
const NUMBERS_EN = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"];


/** A chapter's front page when it is split into boxes. It reads as a sequence of decisions: first the ways
 * apart at the chapter's first branch point, then, under each way, the big lines that leave it later. */
export function BoxPage({ tree, meta, startId, showDeep, onToggleDeep, onOpen, orientation }: Props) {
  const notation = useNotation();
  const boxes = chapterBoxes(tree);
  const decision = firstDecision(tree, startId);
  const decisionNode = decision !== undefined ? tree.nodes.get(decision)! : undefined;
  const mainChild = decisionNode ? tree.nodes.get(decisionNode.children[0])! : undefined;

  // The ways apart at the first decision: the main line's move there, and the boxes leaving the same position.
  const atDecision = (b: Box) => b.id !== "" && tree.nodes.get(b.id)!.parent === decision;
  // Single lines first, a group of short ones ("Diğerleri") last.
  const top = [boxes[0], ...boxes.filter((b) => atDecision(b) && b.members.length === 1), ...boxes.filter((b) => atDecision(b) && b.members.length > 1)];
  // Every other box hangs under the box it branches from.
  const under = (parent: string) => boxes.filter((b) => b.id !== "" && b.parent === parent && !atDecision(b));

  const way = decision !== undefined ? pathTo(tree, decision).map((id) => tree.nodes.get(id)!) : [];
  const wayText = way.map((n, i) => moveText(n, notation, i === 0 || n.ply % 2 === 1)).join(" ");
  const blackToMove = !!decisionNode && decisionNode.ply % 2 === 1;

  const card = (b: Box, main: boolean) => {
    const grouped = b.members.length > 1;
    const first = b.id === "" ? mainChild : tree.nodes.get(b.id)!;
    // A group shows the position its lines leave from.
    const shown = grouped ? decisionNode : first;
    const title = b.id === "" ? boxLabel(tree, "", startId, notation) : grouped ? (b.name ?? t("Diğerleri")) : moveText(first!, notation);
    const subtitle = b.id === "" ? t("en sık oynanan yol") : grouped ? b.members.map((id) => moveText(tree.nodes.get(id)!, notation)).join(" · ") : b.name;
    const text = grouped ? "" : first ? linePreview(tree, first.id) : "";
    return (
      <button key={b.id} className={`box-card${main ? " main" : ""}`} onClick={() => onOpen(b.id === "" ? (mainChild?.id ?? startId) : b.id)}>
        {shown && <MiniBoard fen={shown.fen} lastMove={shown.lastMove} orientation={orientation} />}
        <span className="box-text">
          <span className="box-title">
            <span className="box-move san">{title}</span>
            {subtitle && (
              <span className="box-name">
                <RichInline text={subtitle} />
              </span>
            )}
          </span>
          {text && (
            <span className="box-note">
              <RichInline text={text} />
            </span>
          )}
        </span>
      </button>
    );
  };

  const section = (parent: Box) => {
    const kids = under(parent.id);
    if (!kids.length) return null;
    return (
      <section key={`under-${parent.id}`} className="box-branch">
        <h3>
          {L(
            <>
              <span className="san">{boxLabel(tree, parent.id, startId, notation)}</span> yolunda ayrılan büyük varyantlar
            </>,
            <>
              Big lines branching off the <span className="san">{boxLabel(tree, parent.id, startId, notation)}</span> path
            </>,
          )}
        </h3>
        <div className="box-grid small">
          {kids.map((b) => {
            const node = tree.nodes.get(b.id)!;
            const from = tree.nodes.get(node.parent!)!;
            const instead = tree.nodes.get(from.children[0])!;
            return (
              <button key={b.id} className="box-card small" onClick={() => onOpen(b.id)}>
                <MiniBoard fen={node.fen} lastMove={node.lastMove} orientation={orientation} />
                <span className="box-text">
                  <span className="box-title">
                    <span className="box-move san">{moveText(node, notation)}</span>
                    {b.name && (
                      <span className="box-name">
                        <RichInline text={b.name} />
                      </span>
                    )}
                  </span>
                  <span className="box-kicker">
                    {L(
                      <>
                        <span className="san">{moveText(instead, notation)}</span> yerine
                      </>,
                      <>
                        instead of <span className="san">{moveText(instead, notation)}</span>
                      </>,
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {kids.map((k) => section(k))}
      </section>
    );
  };

  return (
    <div className="box-page">
      <div className="chapter-head">
        <span className="chapter-group">
          {meta.group}
          {meta.code ? ` · ${meta.code}` : ""}
        </span>
        <h1>
          <RichInline text={meta.title} />
        </h1>
      </div>
      {meta.goals?.length ? (
        <div className="key-points goals">
          <div className="key-title">{t("Bu bölümde öğreneceklerin")}</div>
          <ul>
            {meta.goals.map((goal, i) => (
              <li key={i}>
                <RichInline text={goal} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {tree.intro && (
        <details className="box-intro">
          <summary>
            <RichInline text={preview(tree.intro, 180)} /> <span className="more">{t("Girişin tamamı")}</span>
          </summary>
          <RichText text={tree.intro} />
          {tree.introDeep && (
            <div className={`deep${showDeep ? " open" : ""}`}>
              <button className="deep-toggle" onClick={onToggleDeep} aria-expanded={showDeep}>
                <ChevronDown size={15} />
                {t("Derinlemesine")}
              </button>
              {showDeep && (
                <div className="deep-body">
                  <RichText text={tree.introDeep} />
                </div>
              )}
            </div>
          )}
        </details>
      )}

      <h2 className="box-heading">
        {L(
          <>
            <span className="san">{wayText}</span> sonrası {blackToMove ? "Siyahın" : "Beyazın"} {NUMBERS[top.length] ?? top.length} yolu
          </>,
          <>
            {blackToMove ? "Black's" : "White's"} {NUMBERS_EN[top.length] ?? top.length} ways after <span className="san">{wayText}</span>
          </>,
        )}
      </h2>
      <div className="box-grid">{top.map((b, i) => card(b, i === 0))}</div>
      {top.map((b) => section(b))}
    </div>
  );
}
