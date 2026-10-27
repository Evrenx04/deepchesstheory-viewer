import { Chess, normalizeMove } from "chessops/chess";
import { parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { parseUci } from "chessops/util";
import { chessgroundDests } from "chessops/compat";

function position(fen: string) {
  return Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
}

/** Legal moves for chessground at this position. */
export function legalDests(fen: string): Map<string, string[]> {
  return chessgroundDests(position(fen)) as Map<string, string[]>;
}

/** SAN of a move dragged on the board, or undefined if it is not legal. */
export function sanOf(fen: string, orig: string, dest: string): string | undefined {
  const pos = position(fen);
  const raw = parseUci(orig + dest);
  if (!raw || !("from" in raw)) return undefined;
  // Auto-queen; the studies do not ask for underpromotions.
  const piece = pos.board.get(raw.from);
  const lastRank = dest[1] === "8" || dest[1] === "1";
  const move = normalizeMove(pos, piece?.role === "pawn" && lastRank ? { ...raw, promotion: "queen" } : raw);
  return pos.isLegal(move) ? makeSan(pos, move) : undefined;
}
