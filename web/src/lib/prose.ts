import { parseFen } from "chessops/fen";
import type { Brush, Shape } from "./pgnTree";

export type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "diagram"; index: number; fen: string; shapes: Shape[]; caption: string; lastMove?: [string, string] }
  | { kind: "deep"; blocks: Block[] }
  | { kind: "more"; blocks: Block[] };

/** "- item" or "1. item". */
const LIST_ITEM = /^(?:- |\d+\.\s+)/;

const BRUSHES: Record<string, Brush> = { G: "green", R: "red", B: "blue", Y: "yellow" };

/** "Gd2d4 Rf5" → arrows and highlighted squares, same letters as lichess %cal/%csl. */
export function parseShapes(spec: string): Shape[] {
  return spec
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((token) => {
      const m = token.match(/^([GRBY])([a-h][1-8])([a-h][1-8])?$/);
      if (!m) throw new Error(`Geçersiz işaret: ${token}`);
      return m[3] ? { brush: BRUSHES[m[1]], orig: m[2], dest: m[3] } : { brush: BRUSHES[m[1]], orig: m[2] };
    });
}

function attributes(line: string): Record<string, string> {
  return Object.fromEntries([...line.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

/**
 * A deliberately small Markdown subset: #/##/### headings, paragraphs, "- " and "1. " lists,
 * ":::deep … :::" blocks shown with the deep-notes switch, ":::detay … :::" for the long text behind
 * a "read more" button (the short summary stays above it) and one-line `@diagram fen="…" arrows="…" caption="…"`.
 */
export function parseProse(source: string, file = "metin"): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let diagrams = 0;

  const parse = (until?: string): Block[] => {
    const blocks: Block[] = [];
    let paragraph: string[] = [];
    let list: string[] | null = null;
    let ordered = false;
    const flush = () => {
      if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      if (list) blocks.push(ordered ? { kind: "list", items: list, ordered } : { kind: "list", items: list });
      paragraph = [];
      list = null;
      ordered = false;
    };
    while (lines.length) {
      const line = lines.shift()!;
      const trimmed = line.trim();
      if (until && trimmed === until) break;
      if (!trimmed) {
        flush();
      } else if (trimmed === ":::deep") {
        flush();
        blocks.push({ kind: "deep", blocks: parse(":::") });
      } else if (trimmed === ":::detay") {
        flush();
        blocks.push({ kind: "more", blocks: parse(":::") });
      } else if (trimmed.startsWith("@diagram")) {
        flush();
        const attrs = attributes(trimmed);
        const fen = attrs.fen ?? "";
        if (parseFen(fen).isErr) throw new Error(`${file}: geçersiz FEN: ${fen}`);
        const last = attrs.last?.match(/^([a-h][1-8])([a-h][1-8])$/);
        blocks.push({
          kind: "diagram",
          index: ++diagrams,
          fen,
          shapes: parseShapes(attrs.arrows ?? ""),
          caption: attrs.caption ?? "",
          lastMove: last ? [last[1], last[2]] : undefined,
        });
      } else if (/^#{1,3}\s/.test(trimmed)) {
        flush();
        const [, hashes, text] = trimmed.match(/^(#{1,3})\s+(.*)$/)!;
        blocks.push({ kind: "heading", level: hashes.length, text });
      } else if (LIST_ITEM.test(trimmed)) {
        const numbered = !trimmed.startsWith("- ");
        if (paragraph.length || (list && numbered !== ordered)) flush();
        ordered = numbered;
        (list ??= []).push(trimmed.replace(LIST_ITEM, ""));
      } else if (list && /^\s{2,}/.test(line)) {
        list[list.length - 1] += ` ${trimmed}`;
      } else {
        if (list) flush();
        paragraph.push(trimmed);
      }
    }
    flush();
    return blocks;
  };
  return parse();
}

export function diagrams(blocks: Block[]): Extract<Block, { kind: "diagram" }>[] {
  return blocks.flatMap((b) => (b.kind === "diagram" ? [b] : b.kind === "deep" || b.kind === "more" ? diagrams(b.blocks) : []));
}

/** Words of running text (headings, paragraphs, lists, captions) in a block list. */
export function wordCount(blocks: Block[]): number {
  const words = (text: string) => text.replace(/\[\[[\w-]+\|([^\]]+)\]\]/g, "$1").split(/\s+/).filter(Boolean).length;
  return blocks.reduce((sum, b) => {
    switch (b.kind) {
      case "heading":
      case "paragraph":
        return sum + words(b.text);
      case "list":
        return sum + b.items.reduce((n, item) => n + words(item), 0);
      case "diagram":
        return sum + words(b.caption);
      case "deep":
      case "more":
        return sum + wordCount(b.blocks);
    }
  }, 0);
}
