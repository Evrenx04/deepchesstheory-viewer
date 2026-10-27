import { useEffect, useRef } from "react";
import { Chessground } from "chessground";
import type { Key } from "chessground/types";

interface Props {
  fen: string;
  lastMove?: [string, string];
  orientation: "white" | "black";
}

/** A small still board, e.g. on a box card: the position the box starts from. */
export function MiniBoard({ fen, lastMove, orientation }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const move = lastMove?.join("");
  useEffect(() => {
    if (!element.current) return;
    const ground = Chessground(element.current, {
      fen,
      orientation,
      viewOnly: true,
      coordinates: false,
      lastMove: lastMove as Key[] | undefined,
      animation: { enabled: false },
      drawable: { enabled: false, visible: false },
    });
    return () => ground.destroy();
    // lastMove is compared by value (move) so a new array with the same squares does not redraw.
  }, [fen, move, orientation]);
  return (
    <div className="mini-board">
      <div ref={element} className="chessground" aria-hidden="true" />
    </div>
  );
}
