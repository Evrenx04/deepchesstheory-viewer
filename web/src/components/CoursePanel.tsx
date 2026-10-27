import { L, t } from "../lib/i18n";

import { ArrowRight, Lock, Map as MapIcon, Minus, Plus, Repeat } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Module, ModuleEntry } from "../lib/modules";
import type { StudyMeta } from "../lib/study";
import { ProgressRing } from "./ProgressRing";
import type { NavStatus } from "./StudyNav";
import { RichInline } from "./RichText";
import { SourcesLink } from "./SourcesPage";

export interface ModuleCount {
  /** Chapters finished (read or better) out of the module's menu entries. */
  done: number;
  total: number;
  /** Average progress of the entries, 0..1. */
  share: number;
  /** Key moments solved / in the module (opening sections only). */
  solved?: number;
  quizzes?: number;
}

interface Props {
  study: StudyMeta;
  modules: Module[];
  statusOf: (id: string) => NavStatus | undefined;
  countOf: (module: Module) => ModuleCount;
  /** Where the reader stopped: the chapter's title and the move or diagram. */
  last?: { chapter: string; title: string; code?: string; spot?: string; where?: string; board?: ReactNode };
  /** Spaced repetition: how many positions are due today, and tomorrow. */
  review?: { due: number; total: number; tomorrow: number };
  totals: { solved: number; quizzes: number; gameSolved: number; gameQuizzes: number; done: number; chapters: number; loading?: boolean };
  /** A master game's questions and how many the reader solved. */
  gameQuizzes: (id: string) => { quizzes: number; solved: number };
  onOpen: (chapterId: string, spot?: string) => void;
  onMap: () => void;
  onReview?: () => void;
  search: ReactNode;
}

/** The course's first page: where the reader stopped, today's review, the modules with their progress. */
export function CoursePanel({ study, modules, statusOf, countOf, gameQuizzes, last, review, totals, onOpen, onMap, onReview, search }: Props) {
  // The first chapter not finished yet, in course order: where a new reader begins.
  const firstOpen = study.chapters.find((c) => {
    const s = statusOf(c.id);
    return c.type !== "game" && (!s || s.status === "new" || s.status === "started");
  });
  // The first module of chapters (A in the Italian): the tour lights it and its first chapter, a new reader may start there.
  const firstModule = modules.find((m) => m.entries.length > 1 && !m.entries.some((e) => e.children.length));
  const firstLine = firstModule?.entries[0].chapter;
  return (
    <main className="course-panel">
      <header className="panel-head">
        <div>
          <div className="panel-eyebrow">{study.orientation === "white" ? t("Beyaz ile") : t("Siyah ile")} · {study.subtitle}</div>
          <h1>{study.title}</h1>
          <p className="panel-totals">
            {totals.loading
              ? t("İlerlemen yükleniyor…")
              : [
                  t("{done} / {chapters} bölüm tamamlandı", { done: totals.done, chapters: totals.chapters }),
                  t("{solved} / {quizzes} açılış sorusu", { solved: totals.solved, quizzes: totals.quizzes }),
                  ...(totals.gameQuizzes ? [t("{solved} / {quizzes} usta oyunu sorusu", { solved: totals.gameSolved, quizzes: totals.gameQuizzes })] : []),
                ].join(" · ")}
          </p>
        </div>
        <div className="panel-search">{search}</div>
      </header>

      <div className="panel-grid">
        <section className="panel-card panel-continue">
          <h2>{last ? t("Kaldığın yerden devam") : t("Sıradaki")}</h2>
          {last ? (
            <div className={`continue-row${last.board ? "" : " no-board"}`}>
              {last.board}
              <div className="continue-text">
                <strong>
                  {last.code && <span className="nav-code">{last.code}</span>} <RichInline text={last.title} />
                </strong>
                {last.where && <span className="san">{last.where}</span>}
                <button className="panel-button" onClick={() => onOpen(last.chapter, last.spot)}>
                  {t("Devam et")} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="continue-text">
              <strong>
                <RichInline text={study.chapters[0].title} />
              </strong>
              <span>{t("Giriş bölümü ilk dört hamlenin mantığını ve kursu nasıl çalışacağını anlatır.")}</span>
              <button className="panel-button primary-action" onClick={() => onOpen(study.chapters[0].id)}>
                {t("Girişten başla")} <ArrowRight size={16} />
              </button>
              {firstLine && firstLine.id !== study.chapters[0].id && (
                <button className="panel-link next-open" onClick={() => onOpen(firstLine.id)}>
                  {t("ya da doğrudan {code} ile başla:", { code: firstLine.code ?? "" })} <RichInline text={shortTitle(firstLine.title)} />
                </button>
              )}
            </div>
          )}
          {last && firstOpen && firstOpen.id !== last.chapter && (
            <button className="panel-link next-open" onClick={() => onOpen(firstOpen.id)}>
              {t("Sıradaki bitmemiş bölüm:")} {firstOpen.code ?? ""} <RichInline text={firstOpen.title} />
            </button>
          )}
        </section>

        {review && onReview && (
          <section className="panel-card panel-week">
            <h2>{t("Tekrar")}</h2>
            <div className="panel-review">
              <div>
                <strong>{review.due ? t("Bugün {due} konum tekrar", review) : review.total ? t("Bugün tekrar yok") : t("Tekrar destesi boş")}</strong>
                <span className="panel-note">
                  {review.total
                    ? t("Destede {total} konum · yarın {tomorrow}", review)
                    : t("Simüle et'te oynadığın hamleler ve çözdüğün sorular buraya gelir.")}
                </span>
              </div>
              {review.due > 0 && (
                <button className="panel-button" onClick={onReview}>
                  <Repeat size={15} /> {t("Tekrara başla")}
                </button>
              )}
            </div>
          </section>
        )}

        <section className="panel-card panel-modules">
          <div className="panel-modules-head">
            <h2>{t("Bölümler")}</h2>
            <button className="panel-link" onClick={onMap}>
              <MapIcon size={15} /> {t("Kurs haritası")}
            </button>
          </div>
          <ul>
            {modules.map((module) => {
              const c = countOf(module);
              // The tour (lib/tour.ts) lights the first module of chapters and its first chapter.
              const toured = module === firstModule;
              const target =
                module.entries.find((e) => {
                  const s = statusOf(e.chapter.id);
                  return !s || s.status === "new" || s.status === "started";
                }) ?? module.entries[0];
              return (
                <li key={module.key} data-tour={toured ? "modules" : undefined}>
                  <button className="module-row" onClick={() => onOpen(target.chapter.id)}>
                    <span className="module-name">
                      {/^[A-Z]$/.test(module.key) && <span className="nav-code">{module.key}</span>}
                      <strong>{module.title}</strong>
                      {module.moves && <span className="nav-module-moves">{module.moves}</span>}
                    </span>
                    <span className="module-meter">
                      <i style={{ width: `${Math.round(c.share * 100)}%` }} />
                    </span>
                    <span className="module-count">
                      {c.done}/{c.total}
                      {c.quizzes ? <small> · {t("{solved}/{quizzes} soru", { solved: c.solved ?? 0, quizzes: c.quizzes })}</small> : null}
                    </span>
                  </button>
                  {module.entries.some((e) => e.children.length) ? (
                    <ul className="module-cards">
                      {module.entries.map((e) => (
                        <CardRow key={e.chapter.id} entry={e} statusOf={statusOf} gameQuizzes={gameQuizzes} onOpen={onOpen} />
                      ))}
                    </ul>
                  ) : module.entries.length > 1 && (
                    <div className="module-chapters named">
                      {module.entries.map((e, i) => {
                        const s = statusOf(e.chapter.id);
                        return (
                          <button
                            key={e.chapter.id}
                            className="module-chip"
                            title={e.chapter.title}
                            data-tour={toured && i === 0 ? "first-chapter" : undefined}
                            onClick={() => onOpen(e.chapter.id)}
                          >
                            {e.chapter.locked ? <Lock size={11} className="chip-lock" aria-label={t("Kilitli")} /> : <ProgressRing fraction={s?.fraction ?? 0} status={s?.status ?? "new"} size={13} />}
                            <span className="chip-code">{e.chapter.code ?? e.chapter.title}</span>
                            {e.chapter.code && (
                              <span className="chip-name">
                                <RichInline text={shortTitle(e.chapter.title)} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <SourcesLink />
    </main>
  );
}

/** "Giuoco Pianissimo: 6...a6 ve ...Ba7" → "6...a6 ve ...Ba7": the module's name stands above the chapter. */
const shortTitle = (title: string) => (title.includes(": ") ? title.slice(title.indexOf(": ") + 2) : title);

/** "Kart 1: d4 ve merkezin çözülmesi" → "d4 ve merkezin çözülmesi": the code already says which card. */
const cardTitle = (title: string) => {
  const t = title.replace(/^(Kart|Oyun sonu|Card|Endgame) \d+:\s*/, "");
  // "katlı b piyonları" → "Katlı b piyonları"; a move or a square ("hxg4 yapısı", "e5-d4", "e piyonu") stays as it is.
  return /^[a-h](\s|x?[a-h]?\d)/.test(t) ? t : t.charAt(0).toLocaleUpperCase(L("tr", "en")) + t.slice(1);
};
/** "Murzin–Narayanan 2025 (blitz): d5, Qg4 ve gxf5" → "Murzin–Narayanan". */
const gameName = (title: string) => title.split(":")[0].replace(/\s+\d{4}\b.*$/, "");

/** A card (or an endgame) on the course panel: its own row; the + beside it opens its games as chips. */
function CardRow({ entry, statusOf, gameQuizzes, onOpen }: { entry: ModuleEntry; statusOf: Props["statusOf"]; gameQuizzes: Props["gameQuizzes"]; onOpen: Props["onOpen"] }) {
  const { chapter, children } = entry;
  const s = statusOf(chapter.id);
  const read = children.filter((g) => {
    const gs = statusOf(g.id);
    return gs && gs.status !== "new" && gs.status !== "started";
  }).length;
  const quiz = children.map((g) => gameQuizzes(g.id)).reduce((a, g) => ({ quizzes: a.quizzes + g.quizzes, solved: a.solved + g.solved }), { quizzes: 0, solved: 0 });
  const [open, setOpen] = useState(false);
  return (
    <li className="card-item">
      {children.length > 0 ? (
        <button
          className="card-toggle"
          aria-expanded={open}
          aria-label={t(open ? "Oyunları gizle" : "Oyunları göster")}
          title={t(open ? "Oyunları gizle" : "Oyunları göster")}
          onClick={() => setOpen(!open)}
        >
          {open ? <Minus size={14} /> : <Plus size={14} />}
        </button>
      ) : (
        <span className="card-toggle-space" />
      )}
      <button className="module-row card-row" onClick={() => onOpen(chapter.id)}>
        <span className="module-name">
          {chapter.locked && <Lock size={12} className="chip-lock" aria-label={t("Kilitli")} />}
          {chapter.code && <span className="nav-code">{chapter.code}</span>}
          <strong>
            <RichInline text={cardTitle(chapter.title)} />
          </strong>
        </span>
        <span className="module-meter">
          <i style={{ width: `${Math.round((s?.fraction ?? 0) * 100)}%` }} />
        </span>
        <span className="module-count">
          {children.length ? (read ? t("{read}/{n} oyun", { read, n: children.length }) : t("{n} oyun", { n: children.length })) : ""}
          {quiz.quizzes > 0 && (
            <small> · {quiz.solved ? t("{solved}/{quizzes} soru", { solved: quiz.solved, quizzes: quiz.quizzes }) : t("{n} soru", { n: quiz.quizzes })}</small>
          )}
        </span>
      </button>
      {open && (
        <div className="module-chapters">
          {children.map((g) => {
            const gs = statusOf(g.id);
            return (
              <button key={g.id} className="module-chip" title={g.title} onClick={() => onOpen(g.id)}>
                {g.locked ? <Lock size={11} className="chip-lock" aria-label={t("Kilitli")} /> : gs && <ProgressRing fraction={gs.fraction} status={gs.status} size={13} />}
                {gameName(g.title)}
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
