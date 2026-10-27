import { t } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { diagrams, wordCount, type Block } from "../lib/prose";
import { RichInline } from "./RichText";
import { HideButton, moreLabel } from "./CommentPanel";

interface Props {
  blocks: Block[];
  active: number;
  showDeep: boolean;
  onActivate: (index: number) => void;
}

/**
 * The summary above "Ayrıntılı açıklamayı oku", in pieces opened one by one like a chapter's way in (user, 2026-10-26):
 * a paragraph that ends with ":" takes the list after it, a heading goes with what follows.
 */
function pieces(blocks: Block[]): Block[][] {
  const out: Block[][] = [];
  let heading: Block[] = [];
  for (const block of blocks) {
    const last = out[out.length - 1];
    const prev = last?.[last.length - 1];
    if (block.kind === "heading") heading.push(block);
    else if (block.kind === "list" && prev?.kind === "paragraph" && /:\s*$/.test(prev.text) && !heading.length) last.push(block);
    else {
      out.push([...heading, block]);
      heading = [];
    }
  }
  if (heading.length) out.push(heading);
  return out;
}

export function ProseView({ blocks, active, showDeep, onActivate }: Props) {
  const root = useRef<HTMLDivElement>(null);
  // The long text behind the short summary starts closed on every chapter.
  const [openMore, setOpenMore] = useState(false);
  const [openFor, setOpenFor] = useState(blocks);
  if (openFor !== blocks) {
    setOpenFor(blocks);
    setOpenMore(false);
  }

  // While scrolling, the diagram nearest the top of the text drives the board.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) onActivate(Number((visible[0].target as HTMLElement).dataset.diagram));
      },
      { rootMargin: "0px 0px -55% 0px" },
    );
    el.querySelectorAll("[data-diagram]").forEach((d) => observer.observe(d));
    return () => observer.disconnect();
  }, [blocks, showDeep, openMore, onActivate]);

  const render = (list: Block[]) =>
    list.map((block, i) => {
      switch (block.kind) {
        case "heading": {
          const Tag = (["h2", "h3", "h4"] as const)[block.level - 1];
          return (
            <Tag key={i}>
              <RichInline text={block.text} />
            </Tag>
          );
        }
        case "paragraph":
          return (
            <p key={i}>
              <RichInline text={block.text} />
            </p>
          );
        case "list": {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={i}>
              {block.items.map((item, j) => (
                <li key={j}>
                  <RichInline text={item} />
                </li>
              ))}
            </List>
          );
        }
        case "diagram":
          return (
            <button
              key={i}
              data-diagram={block.index}
              className={`diagram-card${block.index === active ? " active" : ""}`}
              onClick={() => onActivate(block.index)}
            >
              <span className="diagram-number">{t("Diyagram {n}", { n: block.index })}</span>
              <span>
                <RichInline text={block.caption || t("Tahtada göster")} />
              </span>
            </button>
          );
        case "deep":
          return showDeep ? (
            <div key={i} className="prose-deep">
              <span className="deep-label">{t("Derinlemesine")}</span>
              {render(block.blocks)}
            </div>
          ) : null;
        case "more": {
          const minutes = Math.max(1, Math.round(wordCount(block.blocks) / 200));
          const figures = diagrams(block.blocks).length;
          return (
            <section key={i} className={`prose-more${openMore ? " open" : ""}`}>
              <button className="more-toggle" aria-expanded={openMore} onClick={() => setOpenMore((o) => !o)}>
                <span className="more-title">{openMore ? t("Ayrıntılı açıklamayı kapat") : t("Ayrıntılı açıklamayı oku")}</span>
                <span className="more-meta">
                  {t("yaklaşık {n} dakika", { n: minutes })}
                  {figures ? ` · ${t("{n} diyagram", { n: figures })}` : ""}
                </span>
              </button>
              {openMore && (
                <div className="more-body">
                  {render(block.blocks)}
                  <button
                    className="more-toggle more-close"
                    onClick={(e) => {
                      e.currentTarget.closest("section")?.scrollIntoView({ block: "start" });
                      setOpenMore(false);
                    }}
                  >
                    <span className="more-title">{t("Ayrıntılı açıklamayı kapat")}</span>

                  </button>
                </div>
              )}
            </section>
          );
        }
      }
    });

  const moreAt = blocks.findIndex((b) => b.kind === "more");
  const summary = moreAt < 0 ? blocks : blocks.slice(0, moreAt);
  const rest = moreAt < 0 ? [] : blocks.slice(moreAt);
  const parts = pieces(summary);
  const [shown, setShown] = useState(1);
  const [shownFor, setShownFor] = useState(blocks);
  if (shownFor !== blocks) {
    setShownFor(blocks);
    setShown(1);
  }
  const all = shown >= parts.length;
  return (
    <div ref={root} className="prose">
      {parts.slice(0, shown).map((part, i) => (
        <div key={i} className={i ? "note-piece" : undefined}>
          {i > 0 && <HideButton onClick={() => setShown(i)} />}
          {render(part)}
        </div>
      ))}
      {!all && (
        <div className="intro-bar note-bar">
          <button className="intro-more" onClick={() => setShown(shown + 1)}>
            {moreLabel(parts.length - shown)}
          </button>
          <button className="intro-all" onClick={() => setShown(parts.length)}>
            {t("Hepsini göster")}
          </button>
        </div>
      )}
      {all && render(rest)}
    </div>
  );
}
