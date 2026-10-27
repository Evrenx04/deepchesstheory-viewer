import { getLang, L, t } from "../lib/i18n";
import { chapterOf, moveChances, onMainLine, readerIndices, readerTurn, simAt, simNext, type Graph, type Sim, type Weights } from "../lib/sim";
import { ref, type Ref } from "../lib/studyGraph";
import { moveLabel } from "./CommentPanel";
import { RichText } from "./RichText";
import { useNotation } from "../lib/notationContext";

interface Props {
  graph: Graph;
  sim: Sim;
  weights: Weights;
  /** Short name of the chapter a move belongs to (e.g. "A1b"). */
  chapterName: (r: Ref) => string;
  onReveal: () => void;
  /** After a detour: play this move of the recommended line instead. */
  onChoose: (r: Ref) => void;
  onRestart: () => void;
  onExit: () => void;
  onOpen: (r: Ref) => void;
  /** A run that ended where the study goes on in another chapter ("Yalnız bu bölüm", or a fixed run): its name. */
  goesOnIn?: string;
  onWiden: () => void;
  /**
   * The chapter's points to simulate (where the site recommends "Simüle et"): whether this run aims at one,
   * how many are done, and the next one not done yet.
   */
  points?: { here: boolean; done: number; total: number; onNext?: () => void };
}

// The first paragraph of a comment: why the move is played, without the rest of the line.
const firstParagraph = (text: string) => text.split(/\n\s*\n/)[0];

/** The side panel while the reader plays through a line: no comments (they would give the moves away). */
export function SimCard({ graph, sim, weights, chapterName, onReveal, onChoose, onRestart, onExit, onOpen, goesOnIn, onWiden, points }: Props) {
  const notation = useNotation();
  const label = (r: Ref) => moveLabel(graph.node(r), notation);
  const finished = !simNext(sim);
  const myTurn = readerTurn(graph, sim);
  const mine = readerIndices(graph, sim);
  const mineDone = mine.filter((i) => i < sim.done).length;
  const played = sim.path.slice(0, sim.done);
  // Reader's moves found at the first try since the last miss.
  let streak = 0;
  for (const i of [...mine].reverse()) {
    if (i >= sim.done) continue;
    if (sim.missed.includes(i)) break;
    streak++;
  }
  // The reader just missed a move (it is on the board now): its idea, from the move's own comment.
  const lastMissed = sim.missed.filter((i) => i < sim.done).at(-1);
  const missedNote =
    lastMissed !== undefined && lastMissed >= sim.done - 2 && graph.node(sim.path[lastMissed]).comment
      ? firstParagraph(graph.node(sim.path[lastMissed]).comment)
      : undefined;
  const last = simAt(sim);
  const lastNode = graph.node(last);
  const here = chapterName(last);
  const startChapter = chapterName(sim.start);
  // Where the reader's move stands among the moves the study covers there, most played first.
  let standing = "";
  if (sim.detour) {
    const from = sim.detour.index ? sim.path[sim.detour.index - 1] : sim.start;
    const chances = [...moveChances(graph, from, weights).entries()].sort((x, y) => y[1] - x[1]);
    const rank = chances.findIndex(([m]) => graph.node(m).san === graph.node(sim.detour!.played).san);
    const even = chances.every(([, p]) => p === chances[0][1]);
    if (rank >= 0)
      standing = even
        ? " " + t("Çalışma bu konumda {n} hamle inceliyor, seninki onlardan biri.", { n: chances.length })
        : " " + t("Çalışma bu konumda {n} hamle inceliyor; seninki sıklıkta {rank}. sırada ({share}).", { n: chances.length, rank: rank + 1, share: t("%{n}", { n: Math.round(chances[rank][1] * 100) }) });
  }
  // The line went on at the same position elsewhere: the places passed in the last moves, said from the
  // chapter the run started in (another chapter "geçtik", back in it "döndük").
  const joinNotes = (sim.joins ?? [])
    .filter((j) => j < sim.done && j >= sim.done - 3 && j + 1 < sim.path.length)
    .map((j) => {
      const next = sim.path[j + 1];
      const main = onMainLine(graph, next);
      const other = chapterOf(next) !== chapterOf(sim.start);
      if (getLang() === "en") {
        const where = other ? `${main ? "the main line" : "a side line"} of ${chapterName(next)}` : main ? "the main line" : "a side line";
        return `${label(sim.path[j])}: ${other ? "we have moved into" : "we are back in"} ${where} (same position, different move order). We go on along ${main ? "the main line" : "that line"}.`;
      }
      const where = other ? `${chapterName(next)} bölümünün ${main ? "ana hattındaki" : "bir varyantındaki"}` : main ? "ana hattaki" : "bir varyanttaki";
      return `${label(sim.path[j])}: ${where} konuma ${other ? "geçtik" : "döndük"} (aynı konum, başka hamle sırası). ${main ? "Ana hat" : "O varyant"} boyunca devam ediyoruz.`;
    });
  // On the quick path the run went on where the quick path has no more moves.
  const fullTree = graph.inQuick && graph.inQuick(sim.start) && sim.done > 0 && !graph.inQuick(last);
  const placeOf = (r: Ref) => ref(chapterOf(r), graph.node(r).parent!);
  const goOn = goesOnIn && (
    <div className="sim-detour">
      <p>
        {sim.random
          ? t('"Yalnız bu bölüm" seçili olduğu için burada durdu; çalışma bu konumdan {goesOnIn} bölümünde devam ediyor.', { goesOnIn })
          : t("Simülasyon {here} bölümünde burada bitiyor; çalışma bu konumdan {goesOnIn} bölümünde sürüyor", { here, goesOnIn }) +
            (sim.onward ? " " + t("(oradaki {move} sonrası konum).", { move: label(placeOf(sim.onward)) }) : ".")}
      </p>
      <div className="sim-detour-options">
        <button onClick={onWiden}>{t("{name} bölümünde devam et", { name: goesOnIn })}</button>
      </div>
    </div>
  );
  const detour = sim.detour && (
    <div className="sim-detour">
      <p className="sim-detour-move">
        {L(
          <>
            Önerilen hamle <span className="san">{label(sim.detour.expected)}</span>; sen <span className="san">{label(sim.detour.played)}</span>{" "}
            oynadın.
          </>,
          <>
            The recommended move is <span className="san">{label(sim.detour.expected)}</span>; you played{" "}
            <span className="san">{label(sim.detour.played)}</span>.
          </>,
        )}
        {standing}
      </p>
      <p>
        {chapterOf(sim.detour.played) !== chapterOf(sim.detour.expected)
          ? t("Oynadığın hamle {expected} varyantında değil; {played} bölümünden devam ediyoruz.", { expected: chapterName(sim.detour.expected), played: chapterName(sim.detour.played) })
          : t("{expected} bölümü bu hamleyi başka bir varyantta inceliyor; o varyanttan devam ediyoruz.", { expected: chapterName(sim.detour.expected) })}
      </p>
      {sim.detour.options.length > 0 && (
        <div className="sim-detour-options">
          <span>
            {chapterOf(sim.detour.played) !== chapterOf(sim.detour.expected)
              ? t("{name} bölümünde kalmak istersen:", { name: chapterName(sim.detour.expected) })
              : t("Önerilen varyanta dönmek istersen:")}
          </span>
          {sim.detour.options.map((o) => (
            <button key={o} className="san" onClick={() => onChoose(o)}>
              {label(o)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
  return (
    <div className={`sim-card${finished && !sim.missed.length && mine.length ? " clean" : ""}`} role="region" aria-label={t("Simülasyon")}>
      <div className="quiz-label">
        {t("Simülasyon")} · {sim.color === "white" ? t("Beyazı sen oynuyorsun") : t("Siyahı sen oynuyorsun")}
        {streak >= 3 && <span className="sim-streak">{t("Üst üste {n} doğru", { n: streak })}</span>}
      </div>
      {sim.random ? (
        <p className="sim-goal">
          {t("Rakip, çalışmadaki varyantlardan gerçek oyunlardaki sıklığa göre seçiyor;")}{" "}
          {sim.scope
            ? t('"Yalnız bu bölüm" seçili: ikiniz de {name} bölümünün varyantlarında kalırsınız.', { name: startChapter })
            : t("varyant başka bir bölümde sürüyorsa oradan devam eder.")}
          {here !== startChapter && (
            <>
              {" "}
              {t("Şu an:")} <strong>{here}</strong>.
            </>
          )}
        </p>
      ) : (
        <>
          <p className="sim-goal">
            {t("Hedef:")} {L("", "the position after ")}
            <span className="san">{label(sim.target!)}</span>
            {sim.end && (
              <>
                {" "}
                → {sim.joins?.length && onMainLine(graph, sim.path[sim.joins[0] + 1]) ? t("ana hatta") + " " : ""}
                <span className="san">{label(sim.end)}</span>
              </>
            )}
            {L(" sonrası konum", "")}
          </p>
          <div className="sim-progress" aria-label={t("İlerleme")}>
            <div className="sim-bar" style={{ width: `${mine.length ? (mineDone / mine.length) * 100 : 100}%` }} />
          </div>
        </>
      )}
      <p className="sim-count">
        {t("Senin hamlelerin:")} {mineDone}
        {sim.random ? "" : ` / ${mine.length}`}
      </p>
      {!finished && (
        <>
          <p className="quiz-question">{myTurn ? t("Sıra sende.") : t("Rakip düşünüyor…")}</p>
          {myTurn && <p className="quiz-hint">{t("Hamleni tahtada yap: taşı sürükle ya da tıkla.")}</p>}
          {sim.feedback && <p className={`quiz-feedback ${sim.feedback.kind}`}>{sim.feedback.text}</p>}
          {missedNote && (
            <div className="sim-end-note sim-why">
              <div className="key-title">{t("Neden {move}?", { move: label(sim.path[lastMissed!]) })}</div>
              <RichText text={missedNote} />
            </div>
          )}
          {joinNotes.map((note) => (
            <p key={note} className="sim-goal">
              {note}
            </p>
          ))}
          {fullTree && <p className="sim-goal">{t("Hızlı yolda bu varyant yok; tam ağaçtan devam ediyoruz.")}</p>}
          {detour}
          <div className="sim-actions">
            {myTurn && (
              <button className="quiz-reveal" onClick={onReveal}>
                {t("Hamleyi göster")}
              </button>
            )}
            <button className="quiz-reveal" onClick={onRestart}>
              {t("Baştan")}
            </button>
            <button className="quiz-reveal" onClick={onExit}>
              {t("Çık")}
            </button>
          </div>
        </>
      )}
      {finished && (
        <>
          {sim.random && (
            <div className="sim-end">
              <p className="sim-goal">
                {sim.repeated ? t("Konum tekrarlandı:") : t("Varyant burada bitiyor:")} <span className="san">{label(last)}</span> (
                {t("{name} bölümünde", { name: here })}).
              </p>
              {lastNode.comment && (
                <div className="sim-end-note">
                  <RichText text={lastNode.comment} />
                </div>
              )}
              {goOn}
              <a className="sim-lichess" href={`https://lichess.org/?fen=${encodeURIComponent(lastNode.fen)}#ai`} target="_blank" rel="noopener noreferrer">
                {t("Bu konumdan Lichess'te bilgisayara karşı devam et")} ↗
              </a>
            </div>
          )}
          {!sim.random && goOn}
          {detour}
          <p className={`quiz-feedback ${sim.missed.length ? "other" : "right"}`}>
            {mine.length === 0
              ? t("Bu varyantta sana hamle düşmedi.")
              : sim.missed.length
                ? `${sim.random ? t("Varyant tamam.") : t("Yol tamam.")} ${t("{total} hamlenin {found} tanesini ilk denemede buldun.", { total: mine.length, found: mine.length - sim.missed.length })}`
                : `✓ ${sim.random ? t("Varyant tamam:") : t("Yol tamam:")} ${t("{total} hamlenin hepsini ilk denemede buldun.", { total: mine.length })}`}
          </p>
          {sim.missed.length > 0 && (
            <div className="sim-missed">
              <div className="key-title">{t("Bulamadıkların (tıkla, açıklamasını oku)")}</div>
              <ul>
                {sim.missed.map((i) => (
                  <li key={i}>
                    <button className="box-jump san" onClick={() => onOpen(sim.path[i])}>
                      {label(sim.path[i])}
                    </button>
                    {chapterName(sim.path[i]) !== startChapter && ` (${chapterName(sim.path[i])})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {points?.here && !sim.random && (
            <p className={`sim-goal sim-point-result${!sim.missed.length && mine.length ? " done" : ""}`}>
              {!sim.missed.length && mine.length ? `✓ ${t("Bu nokta tamamlandı.")} ` : `${t("Bu noktayı hatasız geçersen yeşil tik alır.")} `}
              {t("Bölümde tamamlanan noktalar:")} {points.done} / {points.total}
              {points.done === points.total ? ` · ${t("bölüm tamam!")}` : ""}
            </p>
          )}
          <div className="sim-actions">
            {points?.onNext && !sim.random && (
              <button className="quiz-reveal primary" onClick={points.onNext}>
                {t("Sıradaki nokta")} →
              </button>
            )}
            <button className="quiz-reveal" onClick={onRestart}>
              {sim.random ? t("Yeniden (başka varyant gelebilir)") : t("Tekrar oyna")}
            </button>
            <button className={`quiz-reveal${points?.onNext && !sim.random ? "" : " primary"}`} onClick={onExit}>
              {sim.random ? t("Bu varyantı aç, açıklamayı oku") : t("Konuma dön, açıklamayı oku")}

            </button>
          </div>
        </>
      )}
      {played.length > 0 && (
        <p className="sim-moves">
          {played.map((r, i) => {
            const n = graph.node(r);
            const text = label(r);
            // Black moves after a White move are written without the number.
            const short = n.ply % 2 === 0 && i > 0 ? text.replace(/^\d+…/, "") : text;
            return (
              <span key={i} className={`san${sim.missed.includes(i) ? " missed" : ""}`}>
                {short}{" "}
              </span>
            );
          })}
        </p>
      )}
    </div>
  );
}
