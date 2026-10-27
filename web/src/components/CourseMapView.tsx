import { t } from "../lib/i18n";
import { useState } from "react";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import type { MapNode, SideLine } from "../lib/courseMap";
import type { ChapterMeta } from "../lib/study";
import { formatSan } from "../lib/notation";
import { useNotation } from "../lib/notationContext";
import { ProgressRing } from "./ProgressRing";
import type { NavStatus } from "./StudyNav";
import { RichInline } from "./RichText";

interface Props {
  root: MapNode;
  chapterOf: (id: string) => ChapterMeta | undefined;
  statusOf: (id: string) => NavStatus | undefined;
  sideLinesOf: (id: string) => SideLine[];
  onOpen: (chapter: string, node?: string) => void;
  onClose: () => void;
}

/** "Kurs haritası": the course as an opening tree; each chapter sits where its subject begins, its quick-path side lines under it. */
export function CourseMapView({ root, chapterOf, statusOf, sideLinesOf, onOpen, onClose }: Props) {
  const notation = useNotation();
  const label = (text: string) => text.replace(/([KQRBN][a-h1-8x]*[a-h][1-8]|O-O(?:-O)?)/g, (m) => formatSan(m, notation));
  const [openLines, setOpenLines] = useState<Set<string>>(() => new Set());
  const render = (node: MapNode, depth: number) => (
    <li key={node.id || "root"} className="map-node">
      <div className="map-run">
        {node.at ? (
          <button className="map-moves san" onClick={() => onOpen(node.at!.chapter, node.at!.node)} title={t("Bu konumu aç")}>
            {label(node.label) || t("Başlangıç")}
          </button>
        ) : (
          <span className="map-moves san">{label(node.label)}</span>
        )}
      </div>
      {node.chapters.length > 0 && (
        <ul className="map-chapters">
          {node.chapters.map((id) => {
            const meta = chapterOf(id);
            if (!meta) return null;
            const s = statusOf(id);
            const lines = sideLinesOf(id);
            const linesOpen = openLines.has(id);
            return (
              <li key={id}>
                <div className="map-chapter">
                  <button className="map-chapter-open" onClick={() => onOpen(id)}>
                    {s && <ProgressRing fraction={s.fraction} status={s.status} />}
                    {meta.code && <span className="nav-code">{meta.code}</span>}
                    <RichInline text={meta.title} />
                  </button>
                  {lines.length > 0 && (
                    <button
                      className="nav-fold"
                      aria-expanded={linesOpen}
                      onClick={() =>
                        setOpenLines((o) => {
                          const n = new Set(o);
                          if (n.has(id)) n.delete(id);
                          else n.add(id);
                          return n;
                        })
                      }
                    >
                      {t("{n} varyant", { n: lines.length })} {linesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                  )}
                </div>
                {linesOpen && (
                  <ul className="map-lines">
                    {lines.map((l) => (
                      <li key={l.node.id}>
                        <button className="map-line san" onClick={() => onOpen(id, l.node.id)}>
                          {label(l.label)}
                          {l.name && <span className="map-line-name"> · {l.name}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {node.children.length > 0 && <ul className={`map-children depth-${Math.min(depth, 4)}`}>{node.children.map((c) => render(c, depth + 1))}</ul>}
    </li>
  );
  return (
    <main className="course-map">
      <div className="course-map-head">
        <div>
          <h1>{t("Kurs haritası")}</h1>
          <p className="panel-note">{t("Her bölüm, konusunun başladığı hamlenin yanında duruyor. Hamle dizisine tıklarsan o konum, bölüme tıklarsan bölüm açılır.")}</p>
        </div>
        <button className="icon-button" aria-label={t("Haritayı kapat")} onClick={onClose}>

          <X size={20} />
        </button>
      </div>
      <ul className="map-tree">{render(root, 0)}</ul>
    </main>
  );
}
