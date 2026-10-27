import { L, t } from "../lib/i18n";
import { useEffect, useRef } from "react";
import { Chessground } from "chessground";
import type { Api } from "chessground/api";
import type { Key } from "chessground/types";
import type { DrawShape } from "chessground/draw";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RotateCw } from "lucide-react";
import type { Shape } from "../lib/pgnTree";

export interface BoardState {
  fen: string;
  lastMove?: [string, string];
  check?: boolean;
  shapes?: Shape[];
}

interface Props {
  state: BoardState;
  orientation: "white" | "black";
  onFlip: () => void;
  /** Navigation is optional: prose diagrams show a still position. */
  nav?: {
    first: () => void;
    prev: () => void;
    next: () => void;
    last: () => void;
    canPrev: boolean;
    canNext: boolean;
  };
  caption?: string;
  /** On a touch screen: a tap on the board's left half goes back a move, on its right half forward. */
  onTap?: (dir: 1 | -1) => void;
  /** When set, the reader may move for `color` (used by quiz positions). */
  play?: {
    color: "white" | "black";
    dests: Map<string, string[]>;
    onMove: (orig: string, dest: string) => void;
    /** Changing it puts the position back after a wrong try. */
    attempt: number;
  };
}

const LEGEND: [string, string][] = [
  ["green", "plan, fikir"],
  ["red", "tehdit, zayıflık"],
  ["blue", "alternatif"],
  ["yellow", "önemli kare"],
];

export function Board({ state, orientation, onFlip, nav, caption, play, onTap }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const ground = useRef<Api | null>(null);

  useEffect(() => {
    if (!element.current) return;
    // Never view-only: chessground binds its mouse handlers once, at creation, and only when the board is
    // interactive. Moves are allowed through `movable` when a position asks for one.
    ground.current = Chessground(element.current, {
      viewOnly: false,
      coordinates: true,
      animation: {
        enabled: !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
        duration: 200,
      },
      drawable: { enabled: false, visible: true },
      draggable: { enabled: false },
      selectable: { enabled: false },
      movable: { free: false, color: undefined },
    });
    return () => {
      ground.current?.destroy();
      ground.current = null;
    };
  }, []);

  useEffect(() => {
    ground.current?.set({
      fen: state.fen,
      orientation,
      lastMove: state.lastMove as Key[] | undefined,
      turnColor: state.fen.split(" ")[1] === "b" ? "black" : "white",
      check: state.check ?? false,
    });
    ground.current?.setAutoShapes(
      (state.shapes ?? []).map(
        (s): DrawShape => ({ orig: s.orig as Key, dest: s.dest as Key | undefined, brush: s.brush }),
      ),
    );
  }, [state, orientation, play?.attempt]);

  useEffect(() => {
    ground.current?.set({
      draggable: { enabled: !!play },
      selectable: { enabled: !!play },
      movable: play
        ? { free: false, color: play.color, dests: play.dests as Map<Key, Key[]>, showDests: true, events: { after: play.onMove } }
        : { color: undefined, dests: new Map() },
    });
    // A piece picked up while moves were allowed must not stay highlighted.
    if (!play) ground.current?.cancelMove();
    // The board may have moved since chessground measured it (a bar above it came or went).
    ground.current?.state.dom.bounds.clear();
  }, [play]);

  useEffect(() => {
    if (!nav) return;
    const handle = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.altKey || event.ctrlKey || event.metaKey || (target instanceof Element && target.closest("input, textarea, select")))
        return;
      const action = { ArrowLeft: nav.prev, ArrowRight: nav.next, Home: nav.first, End: nav.last }[event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [nav]);

  return (
    <section className="board-column" aria-label={t("Tahta")}>
      <div
        className={`board-frame${play ? " playing" : ""}`}
        onClick={(event) => {
          // Only where moves are not being played on the board, and only on touch screens.
          if (play || !onTap || !window.matchMedia?.("(pointer: coarse)").matches) return;
          const rect = event.currentTarget.getBoundingClientRect();
          onTap(event.clientX - rect.left < rect.width / 2 ? -1 : 1);
        }}
      >
        <div ref={element} className="chessground" role="img" aria-label={t("Satranç tahtası")} />
      </div>
      <div className="board-controls">
        {nav ? (
          <div className="flex items-center gap-1">
            <button className="icon-button" aria-label={t("Bölüm başı")} title={t("Bölüm başı (Home)")} disabled={!nav.canPrev} onClick={nav.first}>
              <ChevronsLeft size={19} />
            </button>
            <button className="icon-button" aria-label={t("Geri")} title={t("Geri (←)")} disabled={!nav.canPrev} onClick={nav.prev}>
              <ChevronLeft size={21} />
            </button>
            <button className="icon-button" data-tour="next" aria-label={t("İleri")} title={t("İleri (→)")} disabled={!nav.canNext} onClick={nav.next}>
              <ChevronRight size={21} />
            </button>
            <button className="icon-button" aria-label={t("Varyant sonu")} title={t("Varyantın sonu (End)")} disabled={!nav.canNext} onClick={nav.last}>
              <ChevronsRight size={19} />
            </button>
          </div>
        ) : (
          <span className="board-caption-inline">{caption}</span>
        )}
        <button className="icon-button" aria-label={t("Tahtayı çevir")} title={t("Tahtayı çevir")} onClick={onFlip}>
          <RotateCw size={18} />
        </button>
      </div>
      {!!state.shapes?.length && (
        <div className="shape-legend" aria-label={t("Ok renkleri")}>
          {LEGEND.filter(([brush]) => state.shapes!.some((s) => s.brush === brush)).map(([brush, label]) => (
            <span key={brush}>
              <i className={`dot ${brush}`} />
              {t(label)}
            </span>
          ))}
        </div>
      )}
      {nav && (
        <div className="board-caption">
          <span>{caption}</span>
          <span>
            {L(
              <>
                <kbd>←</kbd> <kbd>→</kbd> ile gezin
              </>,
              <>
                Use <kbd>←</kbd> <kbd>→</kbd> to step through
              </>,
            )}

          </span>
        </div>
      )}
    </section>
  );
}
