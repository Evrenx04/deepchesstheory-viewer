import { Fragment, type ReactNode } from "react";
import { splitMoves, type Notation } from "../lib/notation";
import { useNotation } from "../lib/notationContext";
import { useLinkResolver } from "../lib/linkContext";

type Resolve = (name: string) => string | undefined;

// [[name|text]] links to another position; **bold** and *italic*; move tokens get their own style.
function inline(text: string, notation: Notation, resolve: Resolve): ReactNode[] {
  return text.split(/(\[\[[\w-]+\|[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*)/g).map((chunk, i) => {
    const link = chunk.match(/^\[\[([\w-]+)\|([^\]]+)\]\]$/);
    if (link) {
      const href = resolve(link[1]);
      const label = moves(link[2], notation);
      return href ? (
        <a key={i} className="study-link" href={href}>
          {label}
        </a>
      ) : (
        <Fragment key={i}>{label}</Fragment>
      );
    }
    // Bold and italic may hold links ("**[[k1-ortak|Kramnik–Carlsen]]: ...**"), so their text goes through inline again.
    if (/^\*\*[^*]+\*\*$/.test(chunk)) return <strong key={i}>{inline(chunk.slice(2, -2), notation, resolve)}</strong>;
    if (/^\*[^*]+\*$/.test(chunk)) return <em key={i}>{inline(chunk.slice(1, -1), notation, resolve)}</em>;
    return <Fragment key={i}>{moves(chunk, notation)}</Fragment>;
  });
}

function moves(text: string, notation: Notation): ReactNode[] {
  return splitMoves(text, notation).map((part, i) =>
    part.move ? (
      <span key={i} className="san">
        {part.text}
      </span>
    ) : (
      <Fragment key={i}>{part.text}</Fragment>
    ),
  );
}

export function RichInline({ text }: { text: string }) {
  return <>{inline(text, useNotation(), useLinkResolver())}</>;
}

/** Blank lines separate paragraphs; runs of lines starting with "- " (or "1. ") form a list. */
export function RichText({ text }: { text: string }) {
  const notation = useNotation();
  const resolve = useLinkResolver();
  const out: ReactNode[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    let prose: string[] = [];
    let items: string[] = [];
    let ordered = false;
    const flush = () => {
      if (prose.length) {
        const text = prose.join(" ");
        // "Tehdit: …" and "Dikkat: …" paragraphs ("Threat: …", "Careful: …" in English) stand out from the explanation.
        out.push(
          <p key={out.length} className={/^(Tehdit|Dikkat|Threat|Careful):/.test(text) ? "callout" : undefined}>

            {inline(text, notation, resolve)}
          </p>,
        );
      }
      if (items.length) {
        const List = ordered ? "ol" : "ul";
        out.push(
          <List key={out.length}>
            {items.map((item, j) => (
              <li key={j}>{inline(item, notation, resolve)}</li>
            ))}
          </List>,
        );
      }
      prose = [];
      items = [];
      ordered = false;
    };
    for (const line of block.split("\n").map((l) => l.trim()).filter(Boolean)) {
      const item = line.match(/^(?:- |(\d+)\.\s+)/);
      if (item) {
        const numbered = item[1] !== undefined;
        if (prose.length || (items.length && numbered !== ordered)) flush();
        ordered = numbered;
        items.push(line.slice(item[0].length));
      } else {
        if (items.length) flush();
        prose.push(line);
      }
    }
    flush();
  }
  return <>{out}</>;
}
