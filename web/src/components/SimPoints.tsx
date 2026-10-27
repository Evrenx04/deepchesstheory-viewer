import { t } from "../lib/i18n";
import { useEffect, useRef } from "react";
import { ArrowRight, X } from "lucide-react";
import { pathTo, type MoveNode, type MoveTree } from "../lib/pgnTree";
import { useNotation } from "../lib/notationContext";
import { moveText } from "./NextMoves";

interface ListProps {
  tree: MoveTree;
  points: string[];
  done: string[];
  /** The position on the board, marked in the list. */
  current?: string;
  onOpen: (id: string) => void;
}

/**
 * Where a point is: "Ana hat", or the side line it is on, named by the moves where it left the main line
 * (the last two when it left a side line too: "8…♘g4 › 9…♕f6 varyantı").
 */
export function pointPlace(tree: MoveTree, id: string, name: (n: MoveNode) => string): string {
  const turns = pathTo(tree, id)
    .map((p) => tree.nodes.get(p)!)
    .filter((n) => n.parent !== null && tree.nodes.get(n.parent)!.children[0] !== n.id);
  if (!turns.length) return t("Ana hat");
  return t("{moves} varyantı", { moves: turns.slice(-2).map(name).join(" › ") });
}

/** The chapter's points to simulate, each with where it is; a click opens the position (a question's position for a key moment not solved yet). */
export function PointsList({ tree, points, done, current, onOpen }: ListProps) {
  const notation = useNotation();
  return (
    <ol className="points-list">
      {points.map((id) => {
        const n = tree.nodes.get(id);
        if (!n) return null;
        const finished = done.includes(id);
        // A question is not answered here: its move is named only once the point is done.
        const hide = n.quiz !== undefined && !finished;
        return (
          <li key={id} className={`${finished ? "done" : ""}${id === current ? " here" : ""}`}>
            <span className={`sim-tick${finished ? " done" : ""}`} aria-label={finished ? t("simüle edildi") : t("simüle edilecek")}>
              {finished ? "✓" : ""}
            </span>
            <button className="point-open" onClick={() => onOpen(hide ? n.parent! : id)}>
              <span className="point-place">{pointPlace(tree, id, (m) => moveText(m, notation))}</span>
              <span className="point-move">
                {hide ? (
                  t(n.ply % 2 ? "Beyazın {n}. hamlesi" : "Siyahın {n}. hamlesi", { n: Math.ceil(n.ply / 2) })
                ) : (
                  <span className="san">{moveText(n, notation)}</span>
                )}
                {n.critical ? `: ${n.critical}` : n.children.length ? "" : ` · ${t("varyant sonu")}`}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

interface MenuProps extends ListProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  /** The first point not done yet. */
  next?: string;
}

/** "Noktalar 3 / 12": the list of points from anywhere in the chapter, as a panel (from the bottom on a phone). */
export function PointsMenu({ open, onToggle, next, ...list }: MenuProps) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !(event.target as Element).closest?.(".points-panel, .points-toggle")) onToggle(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open, onToggle]);
  if (!open) return null;
  const go = (id: string) => {
    onToggle(false);
    list.onOpen(id);
  };
  return (
    <div className="points-backdrop" onClick={(e) => e.target === e.currentTarget && onToggle(false)}>
      <div ref={panel} className="points-panel" role="dialog" aria-label={t("Simüle edilecek yerler")}>
        <div className="points-head">
          <strong>
            {t("Simüle edilecek yerler")} · {list.points.filter((id) => list.done.includes(id)).length} / {list.points.length}
          </strong>
          <button className="icon-button" aria-label={t("Kapat")} onClick={() => onToggle(false)}>
            <X size={18} />
          </button>
        </div>
        <p className="sim-points-note">{t("Hatasız simüle ettiğin yer yeşil tik alır; hepsi tiklenince bölüm tamamlanır.")}</p>
        {next ? (
          <button className="panel-button points-next" onClick={() => go(list.tree.nodes.get(next)?.quiz !== undefined ? list.tree.nodes.get(next)!.parent! : next)}>
            {t("Sıradaki noktaya git")} <ArrowRight size={15} />
          </button>
        ) : (
          <p className="point-strip done">✓ {t("Bu bölümün bütün noktalarını tamamladın")}</p>

        )}
        <PointsList {...list} onOpen={go} />
      </div>
    </div>
  );
}
