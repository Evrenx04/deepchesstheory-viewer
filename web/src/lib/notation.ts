export type Notation = "figurine" | "tr" | "en";

const LETTERS: Record<Notation, Record<string, string>> = {
  figurine: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘" },
  // Şah, Vezir, Kale, Fil, At
  tr: { K: "Ş", Q: "V", R: "K", B: "F", N: "A" },
  en: { K: "K", Q: "Q", R: "R", B: "B", N: "N" },
};

/** "Nf3" → "♘f3" / "Af3" / "Nf3". Castling and pawn moves pass through unchanged. */
export function formatSan(san: string, notation: Notation = "figurine"): string {
  const map = LETTERS[notation];
  return san.replace(/^[KQRBN]/, (p) => map[p]).replace(/=([QRBN])/, (_, p) => `=${map[p]}`);
}

export const figurine = (san: string) => formatSan(san, "figurine");

// A SAN token inside prose. Piece moves, captures and castling are always moves;
// a bare square like "d4" is only a pawn move when numbered ("5.d4", "...d5").
// A manoeuvre written as one token ("Nbd2-f1-g3") counts as a piece move too.
const NUM = String.raw`(?:\d+\.(?:\.\.)?\s?|\.\.\.|…)`;
const ALWAYS = String.raw`(?:O-O(?:-O)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:-[a-h][1-8])*|[a-h]x[a-h][1-8](?:=[QRBN])?)`;
const PUSH = String.raw`[a-h][1-8](?:=[QRBN])?`;
const SAN_IN_TEXT = new RegExp(
  String.raw`(^|[\s(“"«\[—–-])((?:${NUM}?${ALWAYS}|${NUM}${PUSH})[+#]?(?:[!?]{1,2})?)(?=$|[\s.,;:!?)”"»'’\]—–])`,
  "g",
);

export interface TextPart {
  text: string;
  move?: boolean;
}

/** Split prose into plain text and move tokens so moves can be styled. */
export function splitMoves(text: string, notation: Notation = "figurine"): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(SAN_IN_TEXT)) {
    const start = m.index! + m[1].length;
    if (start > last) parts.push({ text: text.slice(last, start) });
    const [, number = "", move] = m[2].match(/^(\d+\.(?:\.\.)?\s?|\.\.\.|…)?(.*)$/)!;
    parts.push({ text: number.trim() + formatSan(move, notation), move: true });
    last = start + m[2].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
