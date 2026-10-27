import { ArrowRight, BookOpen } from "lucide-react";
import type { StudyMeta } from "../lib/study";
import { loadProgress, progressKey } from "../lib/progress";
import { Chess } from "chessops/chess";
import { parseSan } from "chessops/san";
import { makeFen } from "chessops/fen";
import { MiniBoard } from "./MiniBoard";
import { t } from "../lib/i18n";
import { SourcesLink } from "./SourcesPage";

/** The position after the course's moves ("1.e4 e5 2.Nf3 …"), for the card's cover. */
function coverFen(moves: string): string {
  const pos = Chess.default();
  for (const token of moves.split(/\s+/)) {
    const san = token.replace(/^\d+\.+/, "");
    if (!san) continue;
    const move = parseSan(pos, san);
    if (!move) break;
    pos.play(move);
  }
  return makeFen(pos.toSetup());
}

const SIDE = { white: "Beyaz ile", black: "Siyah ile" } as const;
const side = (s: keyof typeof SIDE) => t(SIDE[s]);

/** The site's front page: one card per course; a click opens the course. */
export function Home({ studies, onOpen }: { studies: StudyMeta[]; onOpen: (study: StudyMeta) => void }) {
  return (
    <div className="home">
      <header className="topbar">
        <div className="brand">
          <BookOpen size={18} />
          <span>{t("Açılış Çalışması")}</span>
        </div>
      </header>
      <main className="home-main">
        <h1>{t("Açılış kursları")}</h1>
        <p className="home-lead">{t("Çalışmak istediğin kursu seç.")}</p>
        <div className="course-grid">
          {studies.map((study) => {
            const lines = study.chapters.filter((c) => c.type === "line").length;
            const cards = study.chapters.filter((c) => c.type === "prose").length;
            const games = study.chapters.filter((c) => c.type === "game").length;
            // Where the reader stopped in this course, from this browser.
            const progress = loadProgress(progressKey(study.id));
            const last = progress.last && study.chapters.find((c) => c.id === progress.last!.chapter);
            return (
              <button key={study.id} className="course-card" onClick={() => onOpen(study)}>
                <MiniBoard fen={coverFen(study.subtitle)} orientation={study.orientation} />
                <span className="course-card-text">
                <strong>{study.title}</strong>
                <span className="course-moves">
                  {side(study.orientation)} · {study.subtitle}
                </span>
                <span className="course-size">
                  {t("{lines} açılış bölümü · {cards} plan ve oyun sonu kartı · {games} açıklamalı usta oyunu", { lines, cards, games })}
                </span>
                {last && (
                  <span className="course-last">
                    {t("Kaldığın yer:")} {last.code ?? ""} {last.title.replace(/[*_]/g, "")}
                  </span>
                )}
                <span className="course-enter">
                  {last ? t("Devam et") : t("Kursa gir")} <ArrowRight size={16} />

                </span>
                </span>
              </button>
            );
          })}
        </div>
      </main>
      <SourcesLink />
    </div>
  );
}
