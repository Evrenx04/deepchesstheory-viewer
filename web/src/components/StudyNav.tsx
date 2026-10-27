import { t } from "../lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, LayoutDashboard, Lock, Map as MapIcon } from "lucide-react";
import type { StudyMeta } from "../lib/study";
import { courseModules, moduleOf } from "../lib/modules";
import { RichInline } from "./RichText";
import { ProgressRing } from "./ProgressRing";

export interface NavStatus {
  /** 0..1, how much of the chapter the reader has done. */
  fraction: number;
  /** "mastered" shows a star, "read" and "drilled" a tick. */
  status: "new" | "started" | "read" | "drilled" | "mastered";
}

interface Props {
  study: StudyMeta;
  current: string;
  onSelect: (chapterId: string) => void;
  statusOf?: (chapterId: string) => NavStatus | undefined;
  /** "Kurs haritası" and other entries shown above the modules. */
  onMap?: () => void;
  onPanel?: () => void;
  /** Search box (rendered by the caller) above the modules. */
  search?: React.ReactNode;
}

// A chapter is indented once for every chapter whose code is a prefix of its own (A1 → A1b).
const depth = (study: StudyMeta, code?: string) =>
  code ? study.chapters.filter((c) => c.code && c.code !== code && c.type === "line" && code.startsWith(c.code)).length : 0;

/** The course menu: modules that fold, the open chapter's module open; a card's games fold under the card. */
export function StudyNav({ study, current, onSelect, statusOf, onMap, onPanel, search }: Props) {
  const modules = useMemo(() => courseModules(study), [study]);
  const here = moduleOf(modules, current);
  const [open, setOpen] = useState<Set<string>>(() => new Set(here ? [here.module.key] : []));
  const [openCards, setOpenCards] = useState<Set<string>>(() => new Set());
  // Opening a chapter from elsewhere (a link, the panel) opens its module.
  useEffect(() => {
    if (here && !open.has(here.module.key)) setOpen((o) => new Set(o).add(here.module.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector<HTMLElement>(".nav-item.active")?.scrollIntoView({ block: "nearest" });
  }, [current]);
  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };
  const mark = (id: string) => {
    const s = statusOf?.(id);
    if (!s) return null;
    return <ProgressRing fraction={s.fraction} status={s.status} />;
  };
  return (
    <nav ref={navRef} className="study-nav" aria-label={t("Çalışma bölümleri")}>
      {search}
      {(onPanel || onMap) && (
        <div className="nav-shortcuts">
          {onPanel && (
            <button className="nav-map" onClick={onPanel}>
              <LayoutDashboard size={15} /> {t("Kurs paneli")}
            </button>
          )}
          {onMap && (
            <button className="nav-map" onClick={onMap}>
              <MapIcon size={15} /> {t("Kurs haritası")}
            </button>
          )}
        </div>
      )}
      {modules.map((module) => {
        const isOpen = open.has(module.key);
        const statuses = statusOf ? module.entries.map((e) => statusOf(e.chapter.id)) : [];
        const done = statuses.filter((s) => s && s.status !== "new" && s.status !== "started").length;
        const share = statuses.length ? statuses.reduce((sum, s) => sum + (s?.fraction ?? 0), 0) / statuses.length : 0;
        const single = module.entries.length === 1 && !module.entries[0].children.length;
        return (
          <div key={module.key} className={`nav-group${isOpen ? " open" : ""}`}>
            <button
              className="nav-module"
              aria-expanded={single ? undefined : isOpen}
              onClick={() => (single ? onSelect(module.entries[0].chapter.id) : setOpen((o) => toggle(o, module.key)))}
            >
              {!single && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
              <span className="nav-module-title">
                {/^[A-Z]$/.test(module.key) && <span className="nav-code">{module.key}</span>}
                {module.title}
                {module.moves && <span className="nav-module-moves">{module.moves}</span>}
              </span>
              {statusOf && (
                <span className="nav-module-meter" title={t("{done} / {total} tamamlandı", { done, total: module.entries.length })}>
                  <i style={{ width: `${Math.round(share * 100)}%` }} />
                </span>
              )}
            </button>
            {isOpen && !single && (
              <ul>
                {module.entries.map(({ chapter, children }) => {
                  const cardOpen = openCards.has(chapter.id) || chapter.id === current || children.some((c) => c.id === current);
                  return (
                    <li key={chapter.id}>
                      <div className="nav-row">
                        <button
                          className={`nav-item${chapter.id === current ? " active" : ""}`}
                          style={{ paddingLeft: 10 + depth(study, chapter.code) * 14 }}
                          aria-current={chapter.id === current ? "page" : undefined}
                          onClick={() => onSelect(chapter.id)}
                        >
                          {chapter.locked ? <Lock size={12} className="nav-lock" aria-label={t("Kilitli")} /> : mark(chapter.id)}
                          {chapter.code && <span className="nav-code">{chapter.code}</span>}
                          <span className="nav-title">
                            <RichInline text={chapter.title} />
                            {chapter.untranslated && <span className="nav-untranslated" title={t("Henüz çevrilmedi")}>TR</span>}
                          </span>
                        </button>
                        {children.length > 0 && (
                          <button
                            className="nav-fold"
                            aria-label={cardOpen ? t("Oyunları gizle") : t("Oyunları göster")}
                            aria-expanded={cardOpen}
                            onClick={() => setOpenCards((o) => toggle(o, chapter.id))}
                          >
                            {t("{n} oyun", { n: children.length })} {cardOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>
                        )}
                      </div>
                      {cardOpen && children.length > 0 && (
                        <ul className="nav-games">
                          {children.map((game) => (
                            <li key={game.id}>
                              <button
                                className={`nav-item${game.id === current ? " active" : ""}`}
                                aria-current={game.id === current ? "page" : undefined}
                                onClick={() => onSelect(game.id)}
                              >
                                {game.locked ? <Lock size={12} className="nav-lock" aria-label={t("Kilitli")} /> : mark(game.id)}
                                {game.code && <span className="nav-code">{game.code}</span>}
                                <span className="nav-title">
                                  <RichInline text={game.title} />
                                  {game.untranslated && <span className="nav-untranslated" title={t("Henüz çevrilmedi")}>TR</span>}
                                </span>

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
          </div>
        );
      })}
    </nav>
  );
}
