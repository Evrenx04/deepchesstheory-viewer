import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, ListTree, RotateCw, Shuffle, X } from "lucide-react";
import { Board, type BoardState } from "./components/Board";
import { StudyNav } from "./components/StudyNav";
import { MoveList } from "./components/MoveList";
import { CommentPanel, moveLabel } from "./components/CommentPanel";
import { ProseView } from "./components/ProseView";
import { RichInline } from "./components/RichText";
import { NextMoves, moveText } from "./components/NextMoves";
import { LinePath } from "./components/LinePath";
import { QuizCard } from "./components/QuizCard";
import { QuizIntro } from "./components/QuizIntro";
import { PositionFold } from "./components/ChapterGuide";
import { SimCard } from "./components/SimCard";
import { onMainLine, readerIndices, readerMoves, readerTurn, simAdvance, simAt, simChoose, simGoOn, simNext, simRecommended, simReveal, simTry, simWiden, startRandom, startSim, type Sim } from "./lib/sim";
import { QuickGraph, ref, splitRef, StudyGraph, type Graph, type Ref } from "./lib/studyGraph";
import { legalDests, sanOf } from "./lib/quiz";
import {
  anchorIndex,
  chapterReady,
  fetchChapter,
  fetchGames,
  fetchSimData,
  GAME_PREFIX,
  gamesIndex,
  loadStudies,
  loadChapter,
  moveWeights,
  loadGameChapter,
  LockedChapter,
  positionKey,
  simDataReady,
  type LoadedChapter,
  type StudyMeta,
} from "./lib/study";
import { GamesBox } from "./components/GamesBox";
import { LockedView } from "./components/LockedView";
import { Home } from "./components/Home";
import { BeforeReading } from "./components/BeforeReading";
import { Welcome } from "./components/Welcome";
import { Tour } from "./components/Tour";
import { tourSteps } from "./lib/tour";
import { PrivacyPage } from "./components/PrivacyPage";
import { SourcesPage } from "./components/SourcesPage";
import { PRIVACY_ROUTE } from "./lib/privacy";
import { SOURCES_ROUTE } from "./lib/sources";
import { BoxPage, boxLabel } from "./components/BoxPage";
import { boxOf, chapterBoxes, hasBoxes, inBox, nextInBox, onWayTo, otherBoxesAt } from "./lib/boxes";
import { LinkContext } from "./lib/linkContext";
import { lineEnd, nearestIn, nodeFromUrl, quickTree, resolveNode, urlCode, type MoveNode } from "./lib/pgnTree";
import { diagrams } from "./lib/prose";
import type { Notation } from "./lib/notation";
import { NotationContext } from "./lib/notationContext";
import { useSettings } from "./lib/settings";
import { L, t, type Lang } from "./lib/i18n";
import { SettingsMenu } from "./components/SettingsMenu";
import { CoursePanel, type ModuleCount } from "./components/CoursePanel";
import { CourseMapView } from "./components/CourseMapView";
import { SearchBox } from "./components/SearchBox";
import { MiniBoard } from "./components/MiniBoard";
import { PointsList, PointsMenu } from "./components/SimPoints";
import { ReviewCard, type ItemState } from "./components/ReviewCard";
import { sounds } from "./lib/sound";
import { addCards, answer, dueCards, forecast, loadReview, MASTERED_LEVEL, reviewKey, saveReview, stats, type ReviewState } from "./lib/review";
import type { NavStatus } from "./components/StudyNav";
import { courseModules, type Module } from "./lib/modules";
import { buildCourseMap, sideLines } from "./lib/courseMap";
import type { SearchChapter } from "./lib/search";
import { chapterStarts, continuing, simPoints } from "./lib/simPoints";
import {
  chapterStatus,
  loadProgress,
  markDone,
  markDrilled,
  markQuiz,
  progressKey,
  saveProgress,
  visit,
  visitLine,
  lineEnds,
  nodeKey,
  type Progress,
} from "./lib/progress";

const EMPTY_FEN = "8/8/8/8/8/8/8/8 w - - 0 1";

interface Route {
  study?: string;
  chapter?: string;
  /** Move node's address code (pgnTree.urlCode) in line chapters, diagram number in prose chapters. */
  spot?: string;
}

// The root move node has the empty id; it is spelled "root" in the URL.
const readRoute = (): Route => {
  const [study, chapter, spot] = window.location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  return { study, chapter, spot: spot === "root" ? "" : spot || undefined };
};

/** The course map's address: #/<study>/harita. The course panel is #/<study> alone. */
const MAP_ROUTE = "harita";
const REVIEW_ROUTE = "tekrar";

/** Where the reader came from: kept in the history entry of the place a jump led to. */
export interface BackTarget {
  chapter: string;
  spot?: string;
  /** The spot as the address spells it. */
  url?: string;
  label: string;
}

const routeHash = (route: Route) => {
  const spot = route.spot === "" ? "root" : route.spot;
  return "#/" + [route.study, route.chapter, spot].filter((p) => p !== undefined).map(encodeURIComponent).join("/");
};

// Moves inside a chapter replace the address; a jump (another chapter, a link) adds a history entry that
// remembers where it came from, so the browser's back button and the "← dön" strip lead back there.
// Only a jump from a chapter has a place to go back to: from the panel or the map the entry carries none.
const writeRoute = (route: Route, jump: boolean, back?: BackTarget) => {
  const hash = routeHash(route);
  if (jump) window.history.pushState({ back }, "", hash);
  else if (window.location.hash !== hash) window.history.replaceState(window.history.state, "", hash);
};

const historyBack = (): BackTarget | undefined => (window.history.state as { back?: BackTarget } | null)?.back;

function useStoredNotation() {
  const [value, setValue] = useState<Notation>(() => {
    try {
      const stored = localStorage.getItem("notation");
      return stored === "tr" || stored === "en" ? stored : "figurine";
    } catch {
      return "figurine";
    }
  });
  const update = (next: Notation) => {
    setValue(next);
    try {
      localStorage.setItem("notation", next);
    } catch {
      /* storage unavailable: keep the in-memory value */
    }
  };
  return [value, update] as const;
}

function useStoredFlag(key: string, initial: boolean) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === "1";
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* storage unavailable: keep the in-memory value */
      }
    },
    [key],
  );
  const toggle = useCallback(() => {
    setValue((v) => {
      try {
        localStorage.setItem(key, v ? "0" : "1");
      } catch {
        /* storage unavailable: keep the in-memory value */
      }
      return !v;
    });
  }, [key]);
  return [value, toggle, set] as const;
}

// Best run through each position ("chapter:side:node" -> moves not found at the first try), kept in this browser only.
function useSimScores() {
  const [scores, setScores] = useState<Record<string, number>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("simScores") ?? "{}") as Record<string, number>;
      // Keys of tree-path node ids ("a1|0.0.1", before docs/dugum-kimligi.md) name nothing now.
      return Object.fromEntries(Object.entries(stored).filter(([key]) => !/\|\d+(\.\d+)*$/.test(key)));
    } catch {
      return {};
    }
  });
  const record = useCallback((key: string, missed: number) => {
    setScores((old) => {
      if (old[key] !== undefined && old[key] <= missed) return old;
      const next = { ...old, [key]: missed };
      try {
        localStorage.setItem("simScores", JSON.stringify(next));
      } catch {
        /* storage unavailable: keep the in-memory value */
      }
      return next;
    });
  }, []);
  return [scores, record] as const;
}

export default function App() {
  // No study in the address: the front page with the course cards.
  const [route, setRoute] = useState(readRoute);
  const [studies, setStudies] = useState<StudyMeta[] | Error>();
  // The open course, once its first chapter (and the games index if that is a master game) is in.
  const [open, setOpen] = useState<{ study: StudyMeta; initial: Route }>();
  useEffect(() => {
    loadStudies()
      .then(setStudies)
      .catch((error) => setStudies(error instanceof Error ? error : new Error(String(error))));
  }, []);
  useEffect(() => {
    if (!Array.isArray(studies)) return;
    const study = studies.find((s) => s.id === route.study);
    if (!study) return setOpen(undefined);
    let current = true;
    const games = fetchGames(study);
    const meta = study.chapters.find((c) => c.id === route.chapter) ?? study.chapters[0];
    Promise.all([fetchChapter(study, meta), route.chapter?.startsWith(GAME_PREFIX) && games])
      .then(() => current && setOpen({ study, initial: route }))
      .catch((error) => current && setStudies(error instanceof Error ? error : new Error(String(error))));
    return () => {
      current = false;
    };
  }, [studies, route]);
  // Back to the front page, or into another course, by the address; moves inside a course stay with it.
  useEffect(() => {
    const follow = () => {
      const next = readRoute();
      setRoute((old) => (next.study === old.study ? old : next));
    };
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);
  if (route.study === SOURCES_ROUTE) return <SourcesPage />;
  if (route.study === PRIVACY_ROUTE) return <PrivacyPage />;
  if (!studies) return <main className="empty-state">{t("Yükleniyor…")}</main>;
  if (studies instanceof Error) return <main className="empty-state">{t("Çalışma yüklenemedi:")} {studies.message}</main>;
  if (!studies.length) return <main className="empty-state">{t("Henüz yayımlanmış bir çalışma yok.")}</main>;
  if (!route.study || !studies.some((s) => s.id === route.study))
    return <Home studies={studies} onOpen={(study) => (window.location.hash = `#/${study.id}`)} />;
  if (!open || open.study.id !== route.study) return <main className="empty-state">{t("Yükleniyor…")}</main>;
  return <StudyView key={open.study.id} study={open.study} initial={open.initial} />;
}

function StudyView({ study, initial }: { study: StudyMeta; initial: Route }) {
  const isChapter = (id?: string) =>
    !!id && (study.chapters.some((c) => c.id === id) || (id.startsWith(GAME_PREFIX) && !!gamesIndex(study)?.games[id.slice(GAME_PREFIX.length)]));
  const [chapterId, setChapterId] = useState(() => (isChapter(initial.chapter) ? initial.chapter! : study.chapters[0].id));
  // The course panel (#/<study>), the course map, or a chapter.
  const [view, setView] = useState<"panel" | "map" | "chapter" | "review">(() =>
    initial.chapter === MAP_ROUTE ? "map" : isChapter(initial.chapter) ? "chapter" : "panel",
  );
  // Where the reader came from by a jump (see writeRoute); shown as a strip above the chapter.
  const [back, setBack] = useState<BackTarget | undefined>(historyBack);
  // The next address written is a jump (a link click inside a chapter); a chapter change always is.
  const pushNext = useRef(false);
  // The address was changed by the browser (back/forward): follow it, write nothing new.
  const fromHistory = useRef(false);
  const lastPlace = useRef<BackTarget>(undefined);
  // Spaced repetition of the reader's moves and questions (lib/review.ts).
  const [review, setReview] = useState<ReviewState>(() => loadReview(reviewKey(study.id)));
  const updateReview = useCallback(
    (change: (r: ReviewState) => ReviewState) =>
      setReview((old) => {
        const next = change(old);
        if (next !== old) saveReview(next, reviewKey(study.id));
        return next;
      }),
    [study.id],
  );
  // A review session: the due cards when it started, the one on the board, the answers so far.
  const [session, setSession] = useState<{ queue: string[]; index: number; item?: ItemState; right: number; wrong: number }>();
  // The list of the chapter's points to simulate, opened from the bar above the board or the bottom bar.
  const [pointsOpen, setPointsOpen] = useState(false);
  // On a phone: the course menu as a drawer.
  const [drawer, setDrawer] = useState(false);
  const [settings, updateSettings] = useSettings();
  // What the reader has done in this course, kept in this browser (lib/progress.ts).
  const [progress, setProgress] = useState<Progress>(() => loadProgress(progressKey(study.id)));
  const updateProgress = useCallback(
    (change: (p: Progress) => Progress) =>
      setProgress((old) => {
        const next = change(old);
        if (next !== old) saveProgress(next, progressKey(study.id));
        return next;
      }),
    [study.id],
  );
  const [spot, setSpot] = useState<string | undefined>(initial.spot);
  const [orientation, setOrientation] = useState(study.orientation);
  const [showDeep, toggleDeep] = useStoredFlag("showDeep", false);
  const [notation, setNotation] = useStoredNotation();
  // Quick path: the main line, the marked side lines and the key moments; the full tree on request.
  const [quick, , setQuick] = useStoredFlag("quickPath", true);
  // Quiz moves the reader has found or seen, as "chapter:node".
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [attempt, setAttempt] = useState(0);
  const [feedback, setFeedback] = useState<{ node: string; kind: "right" | "wrong" | "other"; text: string }>();
  // Questions the reader got wrong at least once (the first answer decides "first try").
  const quizMissed = useRef(new Set<string>());
  // Playing through the moves from the chapter start to a position ("Simüle et").
  const [sim, setSim] = useState<Sim>();
  const [simScores, recordSim] = useSimScores();
  // "Başlamadan önce oku" opens from ⚙ Ayarlar. Its flag also tells a reader who met the course before the welcome screen.
  const [beforeReadingHidden, , setBeforeReadingHidden] = useStoredFlag(`beforeReadingHidden:${study.id}`, false);
  const [beforeReading, setBeforeReading] = useState(false);
  // The first visit opens on the welcome screen, also when the reader came in by a link to a chapter. A reader who has
  // already been in the course (the old "Başlamadan önce oku" closed, or any progress) is not stopped.
  const [welcomed, , setWelcomed] = useStoredFlag(`welcomed:${study.id}`, false);
  const [welcome, setWelcome] = useState(() => !welcomed && !beforeReadingHidden && !progress.last);
  // The tour after "Başla" (first: it cannot be skipped) or from ⚙ Ayarlar. `back`: the chapter the reader was in when
  // it began (it starts on the course panel); the tour ends there. Begun on the panel, it ends where it led.
  const [tour, setTour] = useState<{ first: boolean; back?: string }>();
  const steps = useMemo(() => tourSteps(), []);
  // Content fetched in the background (the games index, the simulation data) shows on the next render.
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    fetchGames(study).then(refresh);
  }, [study]);
  // The simulation runs through all line chapters: they are fetched on its first use.
  const simReady = simDataReady(study);
  const withSimData = useCallback(
    (run: () => void) => {
      if (simDataReady(study)) run();
      else fetchSimData(study).then(() => (refresh(), run()));
    },
    [study],
  );
  const weights = useMemo(() => moveWeights(study), [study, simReady]);
  // Every line chapter, parsed once the course's chapters are fetched: for the menu's rings, the panel, the map, search.
  useEffect(() => {
    fetchSimData(study).then(refresh);
  }, [study]);
  const courseTrees = useMemo(() => {
    const trees = new Map<string, SearchChapter>();
    for (const meta of study.chapters) {
      if (meta.type !== "line" || !chapterReady(study, meta)) continue;
      try {
        const c = loadChapter(study, meta);
        if (c.type === "line") trees.set(meta.id, { meta, tree: c.tree, quick: quickTree(c.tree), startId: c.startId });
      } catch {
        /* a chapter that failed to load reports its error when opened */
      }
    }
    return trees;
  }, [study, simReady]);
  // Where chapters begin and where the study plays on: what makes a line end a point to simulate (lib/simPoints.ts).
  const course = useMemo(() => ({ starts: chapterStarts(courseTrees.values()), continuing: continuing(courseTrees.values()) }), [courseTrees]);
  // All line chapters joined by position, built on first use (quick path and full tree apart).
  // "Yalnız bu bölüm": a run against the opponent keeps to the chapter it starts in.
  const [chapterOnly, toggleChapterOnly] = useStoredFlag("simChapterOnly", false);
  // "Bu konumda" / "Hamle listesi": closed whenever a chapter opens (user, 2026-10-26: "default kapalı gelsin");
  // once opened it stays open from move to move within the chapter.
  const [foldOpen, setFoldOpen] = useState(false);
  const toggleFold = useCallback(() => setFoldOpen((o) => !o), []);
  const graphs = useRef(new Map<string, Graph>());
  const graphFor = useCallback(
    (quickPath: boolean, scope?: string): Graph => {
      const build = (quickTrees: boolean) => {
        const cacheKey = `${quickTrees}|${scope ?? ""}`;
        let graph = graphs.current.get(cacheKey) as StudyGraph | undefined;
        if (!graph) {
          const chapters = study.chapters.filter((c) => c.type === "line" && (!scope || c.id === scope)).flatMap((c) => {
            // A chapter that failed to load is left out; it reports its error when opened.
            let loaded: LoadedChapter;
            try {
              loaded = loadChapter(study, c);
            } catch {
              return [];
            }
            if (loaded.type !== "line") return [];
            return [{ id: c.id, tree: (quickTrees && quickTree(loaded.tree)) || loaded.tree }];
          });
          graph = new StudyGraph(chapters);
          graphs.current.set(cacheKey, graph);
        }
        return graph;
      };
      // On the quick path a run goes on in the full tree where the quick path has nothing more.
      if (!quickPath) return build(false);
      const cacheKey = `both|${scope ?? ""}`;
      let graph = graphs.current.get(cacheKey);
      if (!graph) graphs.current.set(cacheKey, (graph = new QuickGraph(build(true), build(false))));
      return graph;
    },
    [study],
  );

  // A chapter is opened once its file is fetched (whenFetched); until then the page shows the previous one.
  const fetchSeq = useRef(0);
  const [fetching, setFetching] = useState(false);
  const whenFetched = useCallback(
    (id: string, open: () => void) => {
      const seq = ++fetchSeq.current;
      const meta = study.chapters.find((c) => c.id === id);
      if (!meta || chapterReady(study, meta)) {
        setFetching(false);
        open();
        return;
      }
      setFetching(true);
      fetchChapter(study, meta).then(() => {
        if (seq !== fetchSeq.current) return;
        setFetching(false);
        open();
      });
    },
    [study],
  );
  useEffect(() => setFoldOpen(false), [chapterId]);
  const chapterMetaOf = study.chapters.find((c) => c.id === chapterId);
  const fetched = !chapterMetaOf || chapterReady(study, chapterMetaOf);
  const full = useMemo((): LoadedChapter | Error => {
    try {
      if (chapterId.startsWith(GAME_PREFIX)) return loadGameChapter(study, chapterId);
      return loadChapter(study, chapterMetaOf!);
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }, [study, chapterId, chapterMetaOf, fetched]);
  const fullTree = !(full instanceof Error) && full.type === "line" ? full.tree : undefined;
  const quickVersion = useMemo(() => (fullTree ? quickTree(fullTree) : undefined), [fullTree]);
  // A link or a move list click can lead into a line the quick path leaves out: show the full tree there.
  // The address names a move by its code; a link, the history or a click gives its id.
  const spotTree = !(full instanceof Error) && full.type !== "prose" ? full.tree : undefined;
  const at = spot !== undefined && spotTree ? nodeFromUrl(spotTree, spot) : spot;
  const spotHidden = !!quickVersion && at !== undefined && !quickVersion.nodes.has(at) && !!fullTree?.nodes.has(at);
  const usingQuick = quick && !!quickVersion && !spotHidden;
  const loaded = useMemo(
    () => (usingQuick && !(full instanceof Error) && full.type === "line" ? { ...full, tree: quickVersion! } : full),
    [usingQuick, full, quickVersion],
  );
  useEffect(() => {
    if (quick && spotHidden) setQuick(false);
  }, [quick, spotHidden, setQuick]);
  const choosePath = (next: boolean) => {
    if (next && quickVersion && fullTree && at !== undefined && !quickVersion.nodes.has(at)) setSpot(nearestIn(quickVersion, fullTree, at));
    setQuick(next);
  };

  const selectChapter = (id: string) =>
    whenFetched(id, () => {
      setDrawer(false);
      setView("chapter");
      setSim(undefined);
      setChapterId(id);
      setSpot(undefined);
      window.scrollTo({ top: 0 });
    });

  // Resolve the spot against the loaded chapter: a move taken out since goes to the nearest one before it, anything else to the start.
  const nodeId =
    !(loaded instanceof Error) && loaded.type !== "prose"
      ? at !== undefined
        ? resolveNode(loaded.tree, at, loaded.startId)
        : loaded.startId
      : undefined;
  const diagramList = !(loaded instanceof Error) && loaded.type === "prose" ? diagrams(loaded.blocks) : [];
  const diagramIndex = diagramList.some((d) => String(d.index) === spot) ? Number(spot) : diagramList[0]?.index ?? 0;

  const lineNode = !(loaded instanceof Error) && loaded.type !== "prose" ? loaded.tree.nodes.get(nodeId!) : undefined;

  // Chapters split into boxes open on their box page; a position then belongs to the box the reader is in.
  // The box stays while the reader moves inside it (or back along the way to its start).
  const boxed = !(loaded instanceof Error) && loaded.type === "line" && hasBoxes(loaded.tree);
  const showBoxes = boxed && spot === undefined;
  const boxRef = useRef<{ chapter: string; box: string }>(undefined);
  let box: string | undefined;
  // The box page forgets the box: what is opened from there (or from a link) starts afresh.
  if (showBoxes) boxRef.current = undefined;
  if (boxed && lineNode && !showBoxes) {
    const tree = (loaded as Extract<LoadedChapter, { tree: unknown }>).tree;
    const kept = boxRef.current?.chapter === chapterId ? boxRef.current.box : undefined;
    box = kept !== undefined && inBox(tree, kept, lineNode.id) ? kept : boxOf(tree, lineNode.id);
    boxRef.current = { chapter: chapterId, box };
  }
  const quizKey = (id: string) => `${chapterId}:${id}`;

  // Reaching a quiz move by any route (arrow keys, move list, links) counts as seeing it.
  useEffect(() => {
    if (lineNode?.quiz !== undefined) setRevealed((r) => (r.has(quizKey(lineNode.id)) ? r : new Set(r).add(quizKey(lineNode.id))));
  });

  const quiz = useMemo(() => {
    if (!lineNode || loaded instanceof Error || loaded.type === "prose") return undefined;
    const child = lineNode.children.map((id) => loaded.tree.nodes.get(id)!).find((c) => c.quiz !== undefined && !revealed.has(quizKey(c.id)));
    if (!child) return undefined;
    const color: "white" | "black" = lineNode.fen.split(" ")[1] === "w" ? "white" : "black";
    return { node: lineNode, child, color, dests: legalDests(lineNode.fen) };
  }, [loaded, lineNode, revealed]);

  const onQuizMove = useCallback(
    (orig: string, dest: string) => {
      if (!quiz || loaded instanceof Error || loaded.type === "prose") return;
      const san = sanOf(quiz.node.fen, orig, dest);
      if (san === quiz.child.san) {
        const firstTry = !quizMissed.current.has(quizKey(quiz.child.id));
        updateProgress((p) => markQuiz(p, chapterId, quiz.child.id, firstTry, Date.now()));
        // Questions of the opening chapters go into the review deck (master games are not fetched for reviews).
        const card = `${chapterId}|${quiz.child.id}`;
        if (chapterMetaOf?.type === "line")
          updateReview((r) => (r.cards[card] ? r : answer(addCards(r, [card], "quiz", Date.now()), card, firstTry, Date.now())));
        if (settings.sound) sounds.right();
        setRevealed((r) => new Set(r).add(quizKey(quiz.child.id)));
        setFeedback({ node: quiz.child.id, kind: "right", text: t("Doğru! Bu hamlenin fikri aşağıda.") });
        setSpot(quiz.child.id);
        return;
      }
      const other = quiz.node.children.some((id) => loaded.tree.nodes.get(id)!.san === san);
      setFeedback(
        other
          ? { node: quiz.node.id, kind: "other", text: t("Çalışma bu hamleyi de inceliyor, ama burada başka bir hamle aranıyor. Tekrar dene.") }
          : { node: quiz.node.id, kind: "wrong", text: t("Bu değil. Tekrar dene ya da cevabı gör.") },
      );
      quizMissed.current.add(quizKey(quiz.child.id));
      if (settings.sound) sounds.wrong();
      setAttempt((n) => n + 1);
    },
    [quiz, loaded, chapterId, updateProgress, updateReview, settings.sound],
  );

  const play = useMemo(
    () => (quiz ? { color: quiz.color, dests: quiz.dests, onMove: onQuizMove, attempt } : undefined),
    [quiz, onQuizMove, attempt],
  );

  const lineTree = !(loaded instanceof Error) && loaded.type === "line" ? loaded : undefined;
  // Other chapters follow the reader's choice of quick path or full tree (this one may be shown in full for a link).
  const graphQuick = quickVersion ? usingQuick : quick;
  // The chapter's points to simulate (where "Simüle et" is recommended) and those done without a miss.
  const pointsHere = useMemo(
    () => (lineTree && fullTree ? simPoints(chapterId, quickVersion ?? fullTree, lineTree.startId, orientation, course) : []),
    [lineTree, fullTree, quickVersion, chapterId, orientation, course],
  );
  const doneHere = progress.chapters[chapterId]?.drilled ?? [];
  const pointsDone = pointsHere.filter((id) => doneHere.includes(id)).length;
  // The next point not done yet, in the chapter's order, after the one just played.
  const nextPoint = (after?: string) => {
    const from = after ? pointsHere.indexOf(after) + 1 : 0;
    return [...pointsHere.slice(from), ...pointsHere.slice(0, from)].find((id) => id !== after && !doneHere.includes(id));
  };
  const graph = sim && lineTree && simReady ? graphFor(graphQuick, sim.scope) : undefined;
  const simActive = !!sim && !!graph && graph.has(sim.start) && sim.path.every((r) => graph.has(r));
  const simNextRef = simActive ? simNext(sim!) : undefined;
  const simReaderTurn = simActive && readerTurn(graph!, sim!);
  const nameOf = useCallback((n: MoveNode) => moveLabel(n, notation), [notation]);

  // The site plays its move after a short pause.
  useEffect(() => {
    if (!simActive || !simNextRef || simReaderTurn) return;
    const timer = window.setTimeout(() => setSim((s) => s && simAdvance(graph!, s, weights)), sim!.done ? 650 : 400);
    return () => window.clearTimeout(timer);
  }, [simActive, simNextRef, simReaderTurn, sim, graph, weights]);

  // A finished run along a fixed path is remembered with its number of misses.
  useEffect(() => {
    if (!simActive || simNextRef || sim!.random) return;
    const end = sim!.target!;
    recordSim(`${sim!.color}:${end}`, sim!.missed.length);
    // A clean run to a position counts it as done: a point to simulate gets its green tick.
    if (!sim!.missed.length) {
      const { chapter, id } = splitRef(end);
      updateProgress((p) => markDrilled(p, chapter, id, Date.now()));
      if (settings.sound) sounds.done();
    }
    // The reader's moves go into the review deck, each with how it went this time.
    const now = Date.now();
    const mine = readerIndices(graph!, sim!);
    updateReview((r) =>
      mine.reduce((acc, i) => {
        const card = sim!.path[i];
        const node = graph!.node(card);
        const parent = node.parent !== null ? graph!.node(ref(splitRef(card).chapter, node.parent)) : undefined;
        const w = parent ? weights[positionKey(parent.fen)]?.[node.san] : undefined;
        const fresh = !acc.cards[card];
        const added = addCards(acc, [card], "move", now, w ? w[0] + w[1] : undefined);
        // A move seen again in a later run is answered only when it was new or missed: no double credit on one day.
        return fresh || sim!.missed.includes(i) ? answer(added, card, !sim!.missed.includes(i), now) : added;
      }, r),
    );
  }, [simActive, simNextRef, sim, recordSim, updateProgress]);

  const onSimMove = useCallback(
    (orig: string, dest: string) => {
      if (!sim || !graph) return;
      const fen = graph.node(simAt(sim)).fen;
      const next = simTry(graph, sim, sanOf(fen, orig, dest), weights);
      if (settings.sound && next.feedback) (next.feedback.kind === "right" ? sounds.right : sounds.wrong)();
      setSim(next);
    },
    [sim, graph, weights, settings.sound],
  );
  const simFen = simActive ? graph!.node(simAt(sim!)).fen : undefined;
  const simPlay = useMemo(
    () => (simActive && simReaderTurn ? { color: sim!.color, dests: legalDests(simFen!), onMove: onSimMove, attempt: sim!.attempt } : undefined),
    [simActive, simReaderTurn, simFen, sim?.color, sim?.attempt, onSimMove],
  );

  const placeSpot =
    view !== "chapter" ? undefined : ((showBoxes ? undefined : nodeId) ?? (diagramIndex ? String(diagramIndex) : undefined));
  const placeUrl = placeSpot !== undefined && placeSpot === nodeId ? urlCode(placeSpot) : placeSpot;
  // The address names the panel as no chapter at all, the map as "harita".
  const placeChapter = view === "chapter" ? chapterId : view === "map" ? MAP_ROUTE : view === "review" ? REVIEW_ROUTE : "";
  useEffect(() => {
    const prev = lastPlace.current;
    const jump = !fromHistory.current && !!prev && (pushNext.current || prev.chapter !== placeChapter);
    writeRoute({ study: study.id, chapter: placeChapter || undefined, spot: placeUrl }, jump, jump && isChapter(prev.chapter) ? prev : undefined);
    pushNext.current = false;
    fromHistory.current = false;
    setBack(historyBack());
    if (view === "chapter") updateProgress((p) => visit(p, chapterId, placeSpot, Date.now()));
  }, [study.id, placeChapter, placeSpot]);

  // Back/forward change the hash; follow them. Links inside the course are caught on click and become jumps.
  useEffect(() => {
    const follow = () => {
      const route = readRoute();
      if (route.study !== study.id) return;
      // Coming back to the place already shown changes nothing, so nothing would reset the flag.
      if (lastPlace.current?.chapter !== (route.chapter ?? "") || lastPlace.current?.url !== route.spot) fromHistory.current = true;
      setBack(historyBack());
      if (!isChapter(route.chapter)) {
        setSim(undefined);
        setView(route.chapter === MAP_ROUTE ? "map" : route.chapter === REVIEW_ROUTE && session ? "review" : "panel");
        return;
      }
      const go = () => {
        setView("chapter");
        boxRef.current = undefined;
        if (isChapter(route.chapter)) setChapterId(route.chapter!);
        setSim(undefined);
        setSpot(route.spot);
      };
      if (isChapter(route.chapter)) whenFetched(route.chapter!, go);
      else go();
    };
    window.addEventListener("hashchange", follow);
    const click = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href^='#/']");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const href = link.getAttribute("href")!;
      const [studyId, chapter, spotPart] = href.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
      if (studyId !== study.id || !isChapter(chapter)) return;
      event.preventDefault();
      whenFetched(chapter, () => {
        pushNext.current = true;
        boxRef.current = undefined;
        setSim(undefined);
        setDrawer(false);
        setView("chapter");
        setChapterId(chapter);
        setSpot(spotPart === "root" ? "" : spotPart);
        window.scrollTo({ top: 0 });
      });
    };
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("hashchange", follow);
      document.removeEventListener("click", click);
    };
  }, [study, whenFetched]);

  // Open a master game at the position the reader is looking at.
  const openGame = (id: string, fen: string) => {
    const chapter = loadGameChapter(study, GAME_PREFIX + id);
    if (chapter.type === "prose") return;
    const match = [...chapter.tree.nodes.values()].find((n) => positionKey(n.fen) === positionKey(fen));
    setChapterId(GAME_PREFIX + id);
    setSpot(match?.id ?? "");
  };

  const resolveLink = useCallback(
    (name: string) => {
      const target = anchorIndex(study).get(name);
      return target && `#/${study.id}/${target.chapter}/${target.node === "" ? "root" : urlCode(target.node)}`;
    },
    [study],
  );

  const activateDiagram = useCallback((index: number) => setSpot(String(index)), []);

  let board: BoardState = { fen: EMPTY_FEN };
  let nav: Parameters<typeof Board>[0]["nav"];
  let side;
  let caption: string | undefined;
  let foldSummary = "";
  const chapterMeta = loaded instanceof Error ? study.chapters.find((c) => c.id === chapterId)! : loaded.meta;
  const games = gamesIndex(study);

  if (loaded instanceof LockedChapter) {
    if (loaded.meta.previewFen) board = { fen: loaded.meta.previewFen };
    side = <LockedView study={study} meta={loaded.meta} onSelect={selectChapter} />;
  } else if (loaded instanceof Error) {
    side = (
      <div className="error-message" role="alert">
        {t("Bu bölüm yüklenemedi:")} {loaded.message}
      </div>
    );
  } else if (loaded.type === "prose") {
    const diagram = diagramList.find((d) => d.index === diagramIndex);
    if (diagram) board = { fen: diagram.fen, shapes: diagram.shapes, lastMove: diagram.lastMove };
    caption = diagram ? t("Diyagram {n}", { n: diagram.index }) : undefined;
    // A card's games, right under its summary (user, 2026-10-26: from the card the games were hard to find).
    const cardGames = chapterMeta.code
      ? study.chapters.filter((c) => c.type === "game" && c.code && new RegExp(`^${chapterMeta.code}[a-z]$`).test(c.code))
      : [];
    side = (
      <>
        <ProseView blocks={loaded.blocks} active={diagramIndex} showDeep={showDeep} onActivate={activateDiagram} />
        {cardGames.length > 0 && (
          <nav className="card-games" aria-label={t("Bu kartın oyunları")}>
            <div className="key-title">{t("Bu kartın oyunları")}</div>
            <ul>
              {cardGames.map((g) => {
                const solved = Object.keys(progress.quiz).filter((key) => key.startsWith(`${g.id}|`)).length;
                return (
                  <li key={g.id}>
                    <a href={`#/${study.id}/${g.id}`}>
                      <span className="nav-code">{g.code}</span>
                      <span className="card-game-title">
                        <RichInline text={g.title} />
                      </span>
                      {!!g.quizzes && (
                        <small>{solved ? t("{solved}/{quizzes} soru", { solved: Math.min(solved, g.quizzes), quizzes: g.quizzes }) : t("{n} soru", { n: g.quizzes })}</small>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </>
    );
  } else {
    const { tree, startId, focusId } = loaded;
    const node = tree.nodes.get(nodeId!)!;
    const focus = tree.nodes.get(focusId)!;
    // Moves up to the subject are shown as context in the move list.
    const startPly = focus.ply;
    const atStart = node.id === startId || node.id === tree.root;
    // The intro's arrows belong to the subject's position, which a card game reaches only after its opening.
    const atFocus = focusId === startId ? atStart : node.id === focusId;
    // A card game's intro is shown where it opens and again at the subject, the position it talks about.
    const atIntro = atStart || atFocus;
    board = { fen: node.fen, lastMove: node.lastMove, check: node.check, shapes: atFocus && !node.shapes.length ? tree.introShapes : node.shapes };
    caption = moveLabel(node, notation);
    const go = (id: string | null | undefined) => id !== undefined && id !== null && setSpot(id);
    nav = {
      first: () => go(startId),
      prev: () => go(node.parent),
      // The next move is always the game's (or main line's) move, even at an open question whose answer
      // lies off it: the played move then says a question was skipped (Soruya dön / Cevabı gör).
      next: () => go(box !== undefined ? nextInBox(tree, box, node.id) : node.children[0]),
      last: () => go(lineEnd(tree, box && !inBox(tree, box, node.children[0] ?? node.id) ? box : node.id)),
      canPrev: node.parent !== null,
      canNext: node.children.length > 0,
    };
    // In a boxed chapter: the moves on the way to the box are context only, and moves that open another
    // box are not offered as choices; a note under the comment names those boxes instead.
    const boxInfo = box !== undefined ? chapterBoxes(tree).find((b) => b.id === box) : undefined;
    const onWay = box !== undefined && onWayTo(tree, box, node.id);
    const others = box !== undefined && !onWay ? otherBoxesAt(tree, box, node.id) : [];
    const exclude = new Set(others);
    // Single lines first, a group of short ones last (as on the box page).
    const groupSize = (id: string) => chapterBoxes(tree).find((b) => b.id === id)?.members.length ?? 1;
    const otherBoxes = [...new Set(others.map((id) => boxOf(tree, id)))].sort((a, b) => groupSize(a) - groupSize(b));
    const showChoices = !quiz && !onWay;
    const hiddenQuiz = new Set(
      [...tree.nodes.values()].filter((n) => n.quiz !== undefined && !revealed.has(quizKey(n.id))).map((n) => n.id),
    );
    // A question whose answer is not the move played is flagged on both moves, so that stepping through
    // the main line never passes the played move off as the answer.
    const isGame = loaded.type === "game";
    const parentNode = node.parent !== null ? tree.nodes.get(node.parent) : undefined;
    const mainMove = parentNode ? tree.nodes.get(parentNode.children[0]) : undefined;
    const offAnswer = node.quiz !== undefined && mainMove && mainMove.id !== node.id ? mainMove : undefined;
    const skipped =
      parentNode && mainMove?.id === node.id
        ? parentNode.children.map((id) => tree.nodes.get(id)!).find((c) => c.quiz !== undefined && c.id !== node.id)
        : undefined;
    // At a chapter's start a phone shows the way in first; the long lists below fold to one line each.
    const foldStart = loaded.type === "line" && atStart && !boxed;
    // What else this position has (the other moves, master games, plans, the move list): one line, opened on request.
    const gameCount = loaded.type === "line" && games ? (games.positions[positionKey(node.fen)]?.length ?? 0) : 0;
    foldSummary = [
      gameCount > 0 && t("{n} usta oyunu", { n: gameCount }),
      atIntro && loaded.type === "line" && pointsHere.length > 0 && t("{n} simülasyon yeri", { n: pointsHere.length }),
    ]
      .filter(Boolean)
      .join(" · ");
    // The chapter's first move from where it starts (its start may lie a few moves into the game).
    const startNode = tree.nodes.get(startId) ?? node;
    const firstMove = startNode.children.length ? tree.nodes.get(startNode.children[0]) : undefined;
    // A master game's questions, in the order they come: named under the players (QuizIntro).
    const gameQuestions = isGame ? [...tree.nodes.values()].filter((n) => n.quiz !== undefined).sort((a, b) => a.ply - b.ply) : [];
    // The moves from here (and the ones instead of this move): right under the note, before the key moments, where a long
    // note cannot bury them (user, 2026-10-26).
    const choices = (
      <>
        {showChoices && (
          <NextMoves
            tree={tree}
            node={node}
            onSelect={setSpot}
            // An unseen answer is not named among the alternatives: the warning above leads to it.
            exclude={skipped && hiddenQuiz.has(skipped.id) ? new Set([...exclude, skipped.id]) : exclude}
          />
        )}
        {usingQuick && node.cut && (
          <p className="box-note-line">
            {t("Bu varyant tam ağaçta devam ediyor.")}{" "}
            <button className="box-jump" onClick={() => choosePath(false)}>
              {t("Tam ağaca geç")}
            </button>
          </p>
        )}
        {usingQuick && !!node.hidden && (
          <p className="box-note-line">
            {t("Tam ağaçta burada {n} varyant daha var.", { n: node.hidden })}{" "}
            <button className="box-jump" onClick={() => choosePath(false)}>
              {t("Tam ağaca geç")}
            </button>
          </p>
        )}
      </>
    );
    const players = loaded.type === "game" && tree.headers.White ? `${tree.headers.White} – ${tree.headers.Black}` : null;
    side = (
      <>
        {players && (
          <div className="game-header">
            <strong>{players}</strong>
            <span>
              {[tree.headers.Event, tree.headers.Date?.slice(0, 4), tree.headers.Result].filter((x) => x && x !== "?" && x !== "????").join(" · ")}
            </span>
            {gameQuestions.length > 0 && (
              <QuizIntro
                questions={gameQuestions}
                solved={(id) => revealed.has(quizKey(id)) || !!progress.quiz[nodeKey(chapterId, id)]}
                onOpen={setSpot}
              />
            )}
          </div>
        )}
        <LinePath tree={tree} current={node.id} onSelect={setSpot} />
        {quiz && (
          <QuizCard
            question={quiz.child.quiz || (quiz.color === "white" ? t("Beyaz burada ne oynamalı?") : t("Siyah burada ne oynamalı?"))}
            feedback={feedback?.node === node.id ? feedback : undefined}
            onReveal={() => setSpot(quiz.child.id)}
          />
        )}
        {offAnswer && (
          <p className="quiz-aside">
            {t("Sorunun cevabı bu hamle.")}{" "}
            {L(
              <>
                {isGame ? "Oyunda ise " : "Ana hat ise "}
                <span className="san">{moveText(offAnswer, notation)}</span> {isGame ? "oynandı. " : "ile devam ediyor. "}
              </>,
              <>
                {isGame ? "In the game, " : "The main line continues with "}
                <span className="san">{moveText(offAnswer, notation)}</span>
                {isGame ? " was played. " : ". "}
              </>,
            )}
            <button className="box-jump" onClick={() => setSpot(offAnswer.id)}>
              {isGame ? t("Oyuna dön") : t("Ana hatta dön")}
            </button>
          </p>
        )}
        {skipped &&
          (hiddenQuiz.has(skipped.id) ? (
            <p className="quiz-aside warn">
              {isGame
                ? t("Bu konumda bir soru vardı; oyunda oynanan hamle cevap değil.")
                : t("Bu konumda bir soru vardı; ana hattaki hamle cevap değil.")}{" "}
              <button className="box-jump" onClick={() => setSpot(parentNode!.id)}>
                {t("Soruya dön")}
              </button>
              {" · "}
              <button className="box-jump" onClick={() => setSpot(skipped.id)}>
                {t("Cevabı gör")}
              </button>
            </p>
          ) : (
            <p className="quiz-aside">
              {t("Bu konumdaki sorunun cevabı bu hamle değildi:")}{" "}
              <button className="box-jump" onClick={() => setSpot(skipped.id)}>
                {moveText(skipped, notation)}
              </button>
            </p>
          ))}
        {node.critical !== undefined && <div className="critical-badge">{t("Kritik an")}{node.critical ? `: ${node.critical}` : ""}</div>}
        {/* A point to simulate, said above the note too (on a phone the "Simüle et" bar sits under it). */}
        {!quiz && pointsHere.includes(node.id) && (
          <div className={`point-strip${doneHere.includes(node.id) ? " done" : ""}`}>
            {doneHere.includes(node.id)
              ? `✓ ${t("Simülasyon noktası {n} / {total}: tamamladın", { n: pointsHere.indexOf(node.id) + 1, total: pointsHere.length })}`
              : t("Simülasyon noktası {n} / {total}: Simüle et ile dene", { n: pointsHere.indexOf(node.id) + 1, total: pointsHere.length })}
          </div>
        )}
        <CommentPanel
          node={node}
          intro={atIntro && !boxed ? tree.intro : undefined}
          introDeep={atIntro && !boxed ? tree.introDeep : undefined}
          showDeep={showDeep}
          onToggleDeep={toggleDeep}
          goals={atIntro && !boxed ? chapterMeta.goals : undefined}
          takeaways={node.id === lineEnd(tree, tree.root) ? chapterMeta.takeaways : undefined}
          banner={feedback?.node === node.id && feedback.kind === "right" ? feedback.text : undefined}
          question={!!quiz}
          reveal={
            foldStart
              ? {
                  firstMove: firstMove && moveText(firstMove, notation),
                  onStart: () => firstMove && setSpot(firstMove.id),
                }
              : undefined
          }
        />
        {choices}
        {otherBoxes.length > 0 && (
          <p className="box-note-line">
            {L(
              <>
                <span className="san">{moveText(tree.nodes.get(node.children[0])!, notation)}</span> yerine:
              </>,
              <>
                Instead of <span className="san">{moveText(tree.nodes.get(node.children[0])!, notation)}</span>:
              </>,
            )}{" "}
            {otherBoxes.map((id, i) => (
              <span key={id}>
                {i > 0 && ", "}
                <button className="box-jump" onClick={() => setSpot(id)}>
                  {boxLabel(tree, id, startId, notation, true)}
                </button>
              </span>
            ))}{" "}
            {otherBoxes.length > 1 ? t("ayrı kutularda.") : t("ayrı kutuda.")}
          </p>
        )}
        {atStart && focusId !== startId && (
          <p className="box-note-line">
            <button className="box-jump" onClick={() => setSpot(focusId)}>
              {t("Konuya geç:")} <span className="san">{moveLabel(focus, notation)}</span>
            </button>
          </p>
        )}
        {/* No list of key moments at the start: the notes tell them as the line goes (user, 2026-10-26). */}
        <PositionFold summary={foldSummary} open={foldOpen} onToggle={toggleFold}>
        {/* No plan list here: the notes tell the plans, and the fold is for the move list (user, 2026-10-26). */}
        {loaded.type === "line" && games && (
            <GamesBox
              games={(games.positions[positionKey(node.fen)] ?? []).map((id) => [id, games.games[id]])}
              onOpen={(id) => openGame(id, node.fen)}
            />
        )}
        {atIntro && loaded.type === "line" && pointsHere.length > 0 && (
          <div className="key-points sim-points">
            <div className="key-title">
              {t("Simüle edilecek yerler")} · {pointsDone} / {pointsHere.length}
            </div>
            <p className="sim-points-note">{t('Hatasız simüle ettiğin yer yeşil tik alır; hepsi tiklenince bölüm tamamlanır. Listeyi her konumda üst çubuktaki ◎ sayacıyla da açabilirsin.')}</p>
            <PointsList tree={fullTree ?? tree} points={pointsHere} done={doneHere} current={node.id} onOpen={setSpot} />
          </div>
        )}
        {[...hiddenQuiz].some((id) => tree.nodes.get(id)!.ply > startPly) && (
          <p className="move-list-legend">
            <span className="quiz-mark">?</span> {t("soru: o konuma gelince hamleyi önce sen bulursun.")}
          </p>
        )}
        <MoveList
          tree={tree}
          current={node.id}
          startPly={startPly}
          onSelect={setSpot}
          hidden={hiddenQuiz}
          box={box}
          members={boxInfo?.members}
          points={new Map(pointsHere.map((id) => [id, doneHere.includes(id)]))}
        />
        </PositionFold>
      </>
    );
  }

  // Short name of the chapter a move belongs to (e.g. "A1b").
  const chapterCode = (r: Ref) => {
    const meta = study.chapters.find((c) => c.id === splitRef(r).chapter);
    return meta?.code ?? meta?.group ?? "";
  };
  let simLaunch = null;
  // A card's diagrams can be picked above the board even while the long text holding them is closed.
  if (!(loaded instanceof Error) && loaded.type === "prose" && diagramList.length > 1) {
    const diagram = diagramList.find((d) => d.index === diagramIndex);
    simLaunch = (
      <div className="sim-launch diagram-picker">
        <span className="diagram-picker-label">{t("Diyagram")}</span>
        {diagramList.map((d) => (
          <button key={d.index} className={d.index === diagramIndex ? "active" : ""} aria-pressed={d.index === diagramIndex} onClick={() => activateDiagram(d.index)}>
            {d.index}
          </button>
        ))}
        {diagram?.caption && (
          <span onMouseEnter={(e) => (e.currentTarget.title = e.currentTarget.textContent ?? "")}>
            <RichInline text={diagram.caption} />
          </span>
        )}
      </div>
    );
  }
  // At a line end the launch bar says where the study goes on, which needs the simulation data.
  let needSimData = false;
  if (lineTree && simActive) {
    const g = graph!;
    const at = simAt(sim!);
    const node = g.node(at);
    board = { fen: node.fen, lastMove: node.lastMove, check: node.check };
    nav = undefined;
    caption = node.ply ? moveLabel(node, notation) : t("Başlangıç");
    // Leaving the run opens a position, in whichever chapter it is.
    const open = (r: Ref) => {
      const { chapter, id } = splitRef(r);
      setSim(undefined);
      if (chapter !== chapterId) setChapterId(chapter);
      setSpot(id);
    };
    // A random run ends where it got to; a fixed one at the position it aimed at, or past it once it got there.
    const home = sim!.random || !simNext(sim!) ? at : sim!.target!;
    const from = g.node(sim!.start);
    simLaunch = (
      <div className="sim-launch recommended running">
        <button onClick={() => open(home)}>✕ {t("Çık")}</button>
        <span onMouseEnter={(e) => (e.currentTarget.title = e.currentTarget.textContent ?? "")}>
          {sim!.random ? (
            <>
              {t("Rakibe karşı:")}{" "}
              <span className="san">{from.ply ? t("{move} sonrasından", { move: moveLabel(from, notation) }) : t("başlangıçtan")}</span>
              {sim!.scope ? t(", yalnız bu bölüm.") : t(", bütün çalışma.")}
            </>
          ) : L(
            <>
              Simülasyon: bölüm başından <span className="san">{moveLabel(g.node(sim!.target!), notation)}</span> sonrasına kadar.
            </>,
            <>
              Simulation: from the start of the chapter to the position after <span className="san">{moveLabel(g.node(sim!.target!), notation)}</span>.
            </>,
          )}
        </span>
      </div>
    );
    // A run kept to this chapter that stopped where the whole study goes on.
    const wide = sim!.scope && !simNext(sim!) ? graphFor(graphQuick) : undefined;
    // A fixed run stops where another chapter takes the line on.
    const onward = sim!.random ? wide?.moves(at).find((m) => splitRef(m).chapter !== sim!.scope) : !simNext(sim!) ? sim!.onward : undefined;
    side = (
      <SimCard
        graph={g}
        weights={weights}
        goesOnIn={onward && chapterCode(onward)}
        onWiden={() => setSim((s) => s && (s.random ? simWiden(wide!, s, weights) : simGoOn(g, s)))}
        sim={sim!}
        chapterName={chapterCode}
        onReveal={() => setSim((s) => s && simReveal(g, s, nameOf, weights))}
        onChoose={(option) => setSim((s) => s && simChoose(g, s, option, weights))}
        onRestart={() =>
          setSim(
            (s) =>
              s &&
              (s.random
                ? startRandom(g, s.start, s.color, weights, Math.random, s.scope)
                : { ...s, done: 0, missed: [], feedback: undefined, attempt: s.attempt + 1 }),
          )
        }
        onExit={() => open(home)}
        onOpen={open}
        points={(() => {
          if (sim!.random || !sim!.target || splitRef(sim!.target).chapter !== chapterId || !pointsHere.length) return undefined;
          const target = splitRef(sim!.target).id;
          const next = nextPoint(target);
          return {
            here: pointsHere.includes(target),
            done: pointsDone,
            total: pointsHere.length,
            onNext: next
              ? () => {
                  setSim(undefined);
                  setSpot(next);
                  window.scrollTo({ top: 0 });
                }
              : undefined,
          };
        })()}
      />
    );
  } else if (lineTree && lineNode && !showBoxes) {
    const { tree, startId } = lineTree;
    const count = readerMoves(tree, startId, lineNode.id, orientation);
    const canRandom = lineNode.children.length > 0;
    // At a line end the study may carry the position on elsewhere: the run goes on past it.
    const atLeaf = count > 0 && !canRandom;
    needSimData = atLeaf;
    const leafGraph = atLeaf && simReady ? graphFor(graphQuick) : undefined;
    const fixed = leafGraph && startSim(chapterId, tree, startId, lineNode.id, orientation, leafGraph);
    const total = fixed ? readerIndices(leafGraph!, fixed).length : count;
    // Until then the bar stays empty rather than leave out where the study goes on.
    if ((count > 0 || canRandom) && !(atLeaf && !simReady)) {
      // Recommended exactly where the chapter's points to simulate are (lib/simPoints.ts).
      const recommended = pointsHere.includes(lineNode.id);
      const pointDone = recommended && doneHere.includes(lineNode.id);
      const score = simScores[`${orientation}:${ref(chapterId, lineNode.id)}`];
      const white = orientation === "white";
      simLaunch = (
        <div className={`sim-launch${recommended ? " recommended" : ""}${pointDone ? " point-done" : ""}`}>
          {pointDone && (
            <span className="point-done-badge" title={t("Bu noktayı hatasız simüle ettin")}>
              ✓ {t("Tamamlandı")}
            </span>
          )}
          {count > 0 && (
            <button
              className="mode-button"
              data-tour="sim"
              title={t(white ? "Bölüm başından bu konuma kadar Beyazı sen oyna ({n} hamle)" : "Bölüm başından bu konuma kadar Siyahı sen oyna ({n} hamle)", { n: total })}
              onClick={() => withSimData(() => (setSim(fixed ?? startSim(chapterId, tree, startId, lineNode.id, orientation)), window.scrollTo({ top: 0 })))}
            >
              <span className="mode-name">▶ {pointDone ? t("Tekrar simüle et") : t("Simüle et")}</span>
              <span className="mode-sub">
                {recommended ? t("nokta {n} / {total}", { n: pointsHere.indexOf(lineNode.id) + 1, total: pointsHere.length }) : t("buraya giden yol")} ·{" "}
                {t("{n} hamle", { n: total })}
              </span>
            </button>
          )}
          {canRandom && (
            <button
              className="mode-button"
              data-tour="opponent"
              title={t(
                white
                  ? "Buradan sonrasını Beyazı sen oyna; rakip çalışmadaki varyantlar arasından gerçek oyunlardaki sıklığa göre seçer"
                  : "Buradan sonrasını Siyahı sen oyna; rakip çalışmadaki varyantlar arasından gerçek oyunlardaki sıklığa göre seçer",
              )}
              onClick={() => {
                const scope = chapterOnly ? chapterId : undefined;
                withSimData(() => {
                  setSim(startRandom(graphFor(graphQuick, scope), ref(chapterId, lineNode.id), orientation, moveWeights(study), Math.random, scope));
                  window.scrollTo({ top: 0 });
                });
              }}
            >
              <span className="mode-name">
                <Shuffle size={13} /> {t("Rakibe karşı")}
              </span>
              <span className="mode-sub">{t("buradan sonrası")}</span>
            </button>
          )}
          <span className="sim-note" onMouseEnter={(e) => (e.currentTarget.title = e.currentTarget.textContent ?? "")}>
            {fixed?.end &&
              L(
                <>
                  Simüle et: bölüm başından buraya, sonra {onMainLine(leafGraph!, fixed.path[fixed.joins![0] + 1]) ? "ana hat" : "devam eden varyant"} boyunca{" "}
                  <span className="san">{moveLabel(leafGraph!.node(fixed.end), notation)}</span> sonrasına kadar ({total} hamle, {count} tanesi buraya kadar).
                </>,
                <>
                  Simulate: from the start of the chapter to here, then along the {onMainLine(leafGraph!, fixed.path[fixed.joins![0] + 1]) ? "main line" : "continuing line"} to
                  the position after <span className="san">{moveLabel(leafGraph!.node(fixed.end), notation)}</span> ({total} moves, {count} of them up to here).
                </>,
              )}
            {fixed?.onward && !fixed.end ? " " + t("Çalışma bu konumdan {name} bölümünde sürüyor.", { name: chapterCode(fixed.onward) }) : ""}
          </span>
          {!pointDone && score !== undefined && (
            <span className={`sim-score${score ? "" : " clean"}`} title={t("Bu konuma kadar en iyi denemen")}>
              {score ? t("En iyi denemen: {n} hata", { n: score }) : "✓"}
            </span>
          )}
        </div>
      );
    }
  }

  useEffect(() => {
    if (needSimData && !simReady) fetchSimData(study).then(refresh);
  }, [needSimData, simReady, study]);

  // What a jump from here is called on the "← dön" strip.
  const hereLabel = [chapterMeta.code ?? chapterMeta.title, caption].filter(Boolean).join(" · ");
  useEffect(() => {
    // The panel, the map and the review are places too ("" / "harita" / "tekrar"), not the chapter left open behind them.
    lastPlace.current = { chapter: placeChapter, spot: placeSpot, url: placeUrl, label: hereLabel };
  });
  const showBack = !!back && !simActive && (back.chapter !== chapterId || back.spot !== placeSpot);
  const dropBack = () => {
    window.history.replaceState({ ...(window.history.state ?? {}), back: undefined }, "", window.location.hash);
    setBack(undefined);
  };
  // The chapter after this one in the course order (a card's games follow the card).
  const chapterIndex = study.chapters.findIndex((c) => c.id === chapterId);
  const nextChapter = chapterIndex >= 0 ? study.chapters[chapterIndex + 1] : undefined;
  const atEnd = !simActive && (nav ? !nav.canNext : loaded instanceof Error || loaded.type !== "prose" || diagramIndex === (diagramList.at(-1)?.index ?? 0));
  // On a phone the arrows sit in the bottom bar; in a card they step through the diagrams.
  const step = (dir: 1 | -1) => {
    if (nav) return dir > 0 ? nav.next() : nav.prev();
    const i = diagramList.findIndex((d) => d.index === diagramIndex);
    const d = diagramList[i + dir];
    if (d) activateDiagram(d.index);
  };
  const canStep = (dir: 1 | -1) => {
    if (nav) return dir > 0 ? nav.canNext : nav.canPrev;
    const i = diagramList.findIndex((d) => d.index === diagramIndex);
    return i >= 0 && !!diagramList[i + dir];
  };
  // A chapter is mastered when every card of its moves in the review deck has reached a long interval.
  const masteredChapters = useMemo(() => {
    const levels = new Map<string, boolean>();
    for (const card of Object.values(review.cards)) {
      const chapter = splitRef(card.id).chapter;
      levels.set(chapter, (levels.get(chapter) ?? true) && card.level >= MASTERED_LEVEL);
    }
    return levels;
  }, [review]);
  const statusFor = useCallback(
    (meta: StudyMeta["chapters"][number]) => {
      const t = courseTrees.get(meta.id);
      const tree = t ? (t.quick ?? t.tree) : undefined;
      const points = t && tree ? simPoints(meta.id, tree, t.startId!, study.orientation, course) : undefined;
      return chapterStatus(meta, tree, progress, masteredChapters.get(meta.id) ?? false, points);
    },
    [courseTrees, progress, masteredChapters, course, study.orientation],
  );
  const statusOf = useCallback(
    (id: string): NavStatus | undefined => {
      const meta = study.chapters.find((c) => c.id === id);
      if (!meta || meta.locked || (meta.type === "line" && !courseTrees.has(id))) return undefined;
      return statusFor(meta);
    },
    [study, courseTrees, statusFor],
  );
  const modules = useMemo(() => courseModules(study), [study]);
  const countOf = (module: Module): ModuleCount => {
    const all = module.entries.map((e) => statusFor(e.chapter));
    const done = all.filter((s) => s.status !== "new" && s.status !== "started").length;
    const quizzes = all.reduce((n, s) => n + s.quizzes, 0);
    return {
      done,
      total: all.length,
      share: all.length ? all.reduce((n, s) => n + s.fraction, 0) / all.length : 0,
      ...(quizzes ? { quizzes, solved: all.reduce((n, s) => n + s.solved, 0) } : {}),
    };
  };

  // Reading to the end of a quick-path line counts the line as read; a card or a game read to its end counts as finished.
  const leaves = useMemo(() => new Set(fullTree ? lineEnds(quickVersion ?? fullTree) : []), [fullTree, quickVersion]);
  useEffect(() => {
    if (view !== "chapter" || simActive || nodeId === undefined) return;
    if (leaves.has(nodeId)) updateProgress((p) => (p.chapters[chapterId]?.leaves.includes(nodeId) ? p : visitLine(p, chapterId, nodeId, Date.now())));
    if (!(loaded instanceof Error) && loaded.type === "game" && !chapterId.startsWith(GAME_PREFIX) && nodeId === lineEnd(loaded.tree, loaded.tree.root))
      updateProgress((p) => (p.chapters[chapterId]?.done ? p : markDone(p, chapterId, Date.now())));
  }, [view, nodeId, chapterId, leaves, simActive]);
  // A card counts as read once the reader has scrolled to the end of what is shown.
  const proseEnd = useRef<HTMLDivElement>(null);
  const isProse = !(loaded instanceof Error) && loaded.type === "prose";
  useEffect(() => {
    const el = proseEnd.current;
    if (!el || !isProse || view !== "chapter" || progress.chapters[chapterId]?.done) return;
    const seen = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) updateProgress((p) => (p.chapters[chapterId]?.done ? p : markDone(p, chapterId, Date.now())));
    });
    seen.observe(el);
    return () => seen.disconnect();
  }, [isProse, chapterId, view]);

  const openAt = (chapter: string, node?: string) =>
    whenFetched(chapter, () => {
      setDrawer(false);
      setSim(undefined);
      boxRef.current = undefined;
      setView("chapter");
      setChapterId(chapter);
      setSpot(node);
      window.scrollTo({ top: 0 });
    });
  const showPanel = () => (setDrawer(false), setSim(undefined), setView("panel"), window.scrollTo({ top: 0 }));
  const startTour = (first: boolean) => {
    setTour({ first, back: view === "chapter" ? window.location.hash : undefined });
    setBeforeReading(false);
    showPanel();
  };
  const chooseLang = (lang: Lang) => {
    if (lang === settings.lang) return;
    updateSettings({ lang });
    // As in ⚙ Ayarlar: the interface and the content are read once, in the chosen language.
    window.setTimeout(() => window.location.reload(), 0);
  };
  const showMap = () => (setDrawer(false), setSim(undefined), setView("map"), window.scrollTo({ top: 0 }));
  const searchData = courseTrees.size ? { chapters: [...courseTrees.values()], study, games: games ?? undefined } : undefined;
  const searchBox = <SearchBox data={searchData} onOpen={openAt} />;
  const courseMap = useMemo(
    () =>
      buildCourseMap(
        [...courseTrees.values()].map((t) => ({ meta: t.meta, tree: t.tree, startId: t.startId! })),
      ),
    [courseTrees],
  );
  // The course panel's "Kaldığın yerden devam" and totals.
  const lastInfo = (() => {
    const last = progress.last;
    const meta = last && study.chapters.find((c) => c.id === last.chapter);
    if (!last || !meta) return undefined;
    const ct = courseTrees.get(meta.id);
    const node = ct && last.spot !== undefined ? ct.tree.nodes.get(last.spot) : undefined;
    const where = node ? (node.ply ? moveLabel(node, notation) : t("Başlangıç")) : meta.type === "prose" && last.spot ? t("Diyagram {n}", { n: last.spot }) : undefined;
    return {
      chapter: meta.id,
      title: meta.title,
      code: meta.code,
      spot: last.spot,
      where,
      board: node ? <MiniBoard fen={node.fen} lastMove={node.lastMove} orientation={study.orientation} /> : undefined,
    };
  })();
  // A master game's questions: counted in the index (ChapterMeta.quizzes), solved ones from the progress record.
  const gameQuizzes = useCallback(
    (id: string) => {
      const meta = study.chapters.find((c) => c.id === id);
      const quizzes = meta?.type === "game" ? (meta.quizzes ?? 0) : 0;
      const solved = Object.keys(progress.quiz).filter((key) => key.startsWith(`${id}|`)).length;
      return { quizzes, solved: Math.min(solved, quizzes) };
    },
    [study, progress],
  );
  const totals = (() => {
    const entries = modules.flatMap((m) => m.entries.map((e) => e.chapter));
    const all = entries.map(statusFor);
    const games = study.chapters.filter((c) => c.type === "game").map((c) => gameQuizzes(c.id));
    return {
      done: all.filter((s) => s.status !== "new" && s.status !== "started").length,
      chapters: all.length,
      quizzes: all.reduce((n, s) => n + s.quizzes, 0),
      solved: all.reduce((n, s) => n + s.solved, 0),
      gameQuizzes: games.reduce((n, g) => n + g.quizzes, 0),
      gameSolved: games.reduce((n, g) => n + g.solved, 0),
      loading: !simReady,
    };
  })();
  // A review session: due cards of the opening chapters, one position at a time.
  const itemOf = (id: string | undefined): ItemState | undefined => {
    if (!id) return undefined;
    const { chapter, id: nodeId } = splitRef(id);
    const ct = courseTrees.get(chapter);
    const node = ct?.tree.nodes.get(nodeId);
    if (!ct || !node || node.parent === null) return undefined;
    return { id, kind: review.cards[id]?.kind ?? "move", meta: ct.meta, node, parent: ct.tree.nodes.get(node.parent)!, tries: 0 };
  };
  const now = Date.now();
  const reviewStats = stats(review, now);
  const startReview = () => {
    const queue = dueCards(review, Date.now())
      .map((c) => c.id)
      .filter((id) => itemOf(id));
    setSession({ queue, index: 0, item: itemOf(queue[0]), right: 0, wrong: 0 });
    setDrawer(false);
    setSim(undefined);
    setView("review");
    window.scrollTo({ top: 0 });
  };
  const reviewItem = view === "review" ? session?.item : undefined;
  const settle = (correct: boolean) => updateReview((r) => answer(r, reviewItem!.id, correct, Date.now()));
  const onReviewMove = (orig: string, dest: string) => {
    if (!reviewItem || reviewItem.result) return;
    const san = sanOf(reviewItem.parent.fen, orig, dest);
    if (san === reviewItem.node.san) {
      if (!reviewItem.tries) settle(true);
      if (settings.sound) sounds.right();
      setSession((s) => s && { ...s, right: s.right + (reviewItem.tries ? 0 : 1), item: { ...reviewItem, result: "right", feedback: t("Doğru.") } });
      return;
    }
    if (!reviewItem.tries) settle(false);
    if (settings.sound) sounds.wrong();
    const other = reviewItem.parent.children.some((c) => courseTrees.get(reviewItem.meta.id)?.tree.nodes.get(c)?.san === san);
    setSession(
      (s) =>
        s && {
          ...s,
          wrong: s.wrong + (reviewItem.tries ? 0 : 1),
          item: {
            ...reviewItem,
            tries: reviewItem.tries + 1,
            feedback: other ? t("Bu hamle de çalışmada var, ama burada sorulan başka. Tekrar dene.") : t("Bu değil. Tekrar dene ya da cevabı gör."),
          },
        },
    );
  };
  const revealReview = () => {
    if (!reviewItem || reviewItem.result) return;
    if (!reviewItem.tries) settle(false);
    setSession(
      (s) =>
        s && {
          ...s,
          wrong: s.wrong + (reviewItem.tries ? 0 : 1),
          item: { ...reviewItem, result: "revealed", feedback: t("Hamle: {move}.", { move: moveLabel(reviewItem.node, notation) }) },
        },
    );
  };
  const nextReview = () =>
    setSession((s) => {
      if (!s) return s;
      const index = s.index + 1;
      const item = itemOf(s.queue[index]);
      if (!item && settings.sound && !s.wrong && s.queue.length) sounds.done();
      return { ...s, index, item };
    });
  const reviewBoard: BoardState | undefined = reviewItem
    ? reviewItem.result
      ? { fen: reviewItem.node.fen, lastMove: reviewItem.node.lastMove, check: reviewItem.node.check }
      : { fen: reviewItem.parent.fen, lastMove: reviewItem.parent.lastMove, check: reviewItem.parent.check }
    : undefined;
  const reviewPlay =
    reviewItem && !reviewItem.result
      ? {
          color: (reviewItem.parent.fen.split(" ")[1] === "w" ? "white" : "black") as "white" | "black",
          dests: legalDests(reviewItem.parent.fen),
          onMove: onReviewMove,
          attempt: reviewItem.tries,
        }
      : undefined;

  // On a phone the board is fixed under the top bar and shrinks as the notes are scrolled, down to half its
  // size: the notes' top stays right under it. It grows back on the way up. Not while moves are played on it.
  const [compact, setCompact] = useState(false);
  // A whole simulation counts, not only the reader's turns: the board keeps its size between the moves.
  const playing = simActive || !!play;
  useEffect(() => {
    const phone = window.matchMedia?.("(max-width: 760px)");
    const root = document.documentElement;
    const apply = (shrink: number) => {
      root.style.setProperty("--board-shrink", String(shrink));
      setCompact(shrink >= 1);
    };
    if (!phone || view === "panel" || view === "map" || playing) {
      apply(0);
      return;
    }
    let frame = 0;
    const check = () => {
      frame = 0;
      const space = parseFloat(root.style.getPropertyValue("--board-space")) || 0;
      if (!phone.matches || !space) return apply(0);
      apply(Math.min(1, Math.max(0, window.scrollY / ((space - 10) * 0.5))));
    };
    const onScroll = () => (frame ||= requestAnimationFrame(check));
    window.addEventListener("scroll", onScroll, { passive: true });
    phone.addEventListener?.("change", check);
    check();
    return () => {
      window.removeEventListener("scroll", onScroll);
      phone.removeEventListener?.("change", check);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [view, playing]);
  // The space the full board takes on a phone, kept while it is smaller so the notes never jump.
  useEffect(() => {
    const frame = document.querySelector<HTMLElement>(".board-column .board-frame");
    if (!frame) return;
    const root = document.documentElement;
    const set = () => {
      if (!(parseFloat(root.style.getPropertyValue("--board-shrink")) > 0)) root.style.setProperty("--board-space", `${frame.offsetHeight + 10}px`);
    };
    set();
    const watch = new ResizeObserver(set);
    watch.observe(frame);
    return () => watch.disconnect();
  }, [view, settings.board]);
  // With the small board, a new move brings its note up under the board.
  useEffect(() => {
    if (!compact) return;
    const note = document.querySelector<HTMLElement>(".side-panel .comment-panel");
    const board = document.querySelector<HTMLElement>(".board-column");
    if (!note || !board) return;
    const top = note.getBoundingClientRect().top;
    const below = board.getBoundingClientRect().bottom + 8;
    if (top < below || top > window.innerHeight * 0.6) window.scrollBy({ top: top - below });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, diagramIndex]);
  // On a wider screen the board column is sticky but often taller than the window, so a new move with a
  // shorter note (a shorter page) pushed it up. The page scrolls up by as much: the board stays put. (It is
  // never scrolled down: a board coming back down to its place is fine, and the new note starts in view.)
  const frameTop = () => document.querySelector(".board-area .board-frame")?.getBoundingClientRect().top;
  const shownNode = useRef(nodeId);
  const topBefore = useRef<number | undefined>(undefined);
  if (shownNode.current !== nodeId) {
    shownNode.current = nodeId;
    topBefore.current = frameTop();
  }
  useLayoutEffect(() => {
    const before = topBefore.current;
    topBefore.current = undefined;
    const after = frameTop();
    if (before === undefined || after === undefined || window.matchMedia?.("(max-width: 760px)").matches) return;
    if (after < before - 1) window.scrollBy(0, after - before);
  }, [nodeId]);

  const menu = (
    <StudyNav
      study={study}
      current={view === "chapter" ? chapterId : ""}
      onSelect={selectChapter}
      statusOf={statusOf}
      onMap={showMap}
      onPanel={showPanel}
      search={searchBox}
    />
  );

  return (
    <NotationContext.Provider value={notation}>
      <LinkContext.Provider value={resolveLink}>
        <div className={`app${fetching ? " fetching" : ""}${compact ? " board-compact" : ""}`} aria-busy={fetching || undefined}>
          <header className="topbar">
            <a className="brand" href="#/" title={t("Kurslar")}>
              <BookOpen size={18} />
              <span>{t("Açılış Çalışması")}</span>
            </a>
            {(view === "chapter" || view === "review") && (
              <button className="topbar-menu" onClick={() => setDrawer(true)} aria-label={t("Bölümler")}>
                <ListTree size={17} /> <span>{t("Bölümler")}</span>
              </button>
            )}
            <button className="study-title" onClick={showPanel} title={t("Kurs paneli")}>
              <strong>{study.title}</strong>
              <span>{study.subtitle}</span>
            </button>
            <button className="topbar-chapter" onClick={view === "chapter" ? () => setDrawer(true) : showPanel}>
              {view === "chapter" ? (
                <>
                  {chapterMeta.code && <span className="nav-code">{chapterMeta.code}</span>}
                  {/* One flex item: the title's moves are spans of their own and were squeezed one by one ("…exd4 c ve d5"). */}
                  <span>
                    <RichInline text={chapterMeta.title} />
                  </span>
                </>
              ) : (
                study.title
              )}
            </button>
            {quickVersion && view === "chapter" && (
              <div className="path-switch" role="group" aria-label={t("Görünüm")}>
                <button className={usingQuick ? "active" : ""} aria-pressed={usingQuick} onClick={() => choosePath(true)}>
                  {t("Hızlı yol")}
                </button>
                <button className={!usingQuick ? "active" : ""} aria-pressed={!usingQuick} onClick={() => choosePath(false)}>
                  {t("Tam ağaç")}
                </button>
              </div>
            )}
            {view === "chapter" && !simActive && pointsHere.length > 0 && (
              <button
                className="topbar-points points-toggle"
                data-tour="points"
                aria-label={t("Simüle edilecek yerler")}
                title={t("Bu bölümde simüle edilecek yerler ve nerede oldukları")}
                onClick={() => setPointsOpen((o) => !o)}
              >
                ◎ {pointsDone} / {pointsHere.length}
              </button>
            )}
            <SettingsMenu
              settings={settings}
              onChange={updateSettings}
              notation={notation}
              onNotation={setNotation}
              path={quickVersion ? { quick: usingQuick, onChoose: choosePath } : undefined}
              showDeep={showDeep}
              onToggleDeep={toggleDeep}
              onBeforeReading={study.beforeReading?.length ? () => setBeforeReading(true) : undefined}
              onTour={() => startTour(false)}
              chapterOnly={{ on: chapterOnly, onToggle: toggleChapterOnly }}
            />
          </header>
          {welcome && (
            <Welcome
              title={study.title}
              lang={settings.lang}
              onLang={chooseLang}
              onStart={() => {
                setWelcome(false);
                startTour(true);
              }}
            />
          )}
          {tour && (
            <Tour
              steps={steps}
              canSkip={!tour.first}
              onDone={() => {
                const back = tour.back;
                setTour(undefined);
                // Welcomed only once the tour is over: a reader who reloads in the middle meets it again.
                setWelcomed(true);
                if (back && window.location.hash !== back) window.location.hash = back;
              }}
            />
          )}
          {beforeReading && !!study.beforeReading?.length && (
            <BeforeReading
              pages={study.beforeReading}
              lang={settings.lang}
              onLang={chooseLang}
              onClose={() => {
                setBeforeReading(false);
                setBeforeReadingHidden(true);
              }}
            />
          )}
          {view === "panel" && (
            <CoursePanel
              study={study}
              modules={modules}
              statusOf={statusOf}
              countOf={countOf}
              gameQuizzes={gameQuizzes}
              last={lastInfo}
              totals={totals}
              onOpen={openAt}
              onMap={showMap}
              review={{ due: reviewStats.due, total: reviewStats.total, tomorrow: forecast(review, now)[0] ?? 0 }}
              onReview={startReview}
              search={searchBox}
            />
          )}
          {view === "review" && session && (
            <div className="layout review-layout">
              <aside className="sidebar">{menu}</aside>
              <main className="board-area">
                <Board
                  state={reviewBoard ?? { fen: EMPTY_FEN }}
                  orientation={reviewItem ? (reviewItem.parent.fen.split(" ")[1] === "w" ? "white" : "black") : study.orientation}
                  onFlip={() => undefined}
                  caption={reviewItem ? reviewItem.meta.code : undefined}
                  play={reviewPlay}
                />
              </main>
              <section className="side-panel" aria-label={t("Tekrar")}>
                <ReviewCard
                  item={session.item}
                  index={session.index}
                  total={session.queue.length}
                  right={session.right}
                  wrong={session.wrong}
                  tomorrow={forecast(review, now)[0] ?? 0}
                  onReveal={revealReview}
                  onNext={nextReview}
                  onOpen={openAt}
                  onExit={showPanel}
                />
              </section>
            </div>
          )}
          {view === "map" && (
            <CourseMapView
              root={courseMap}
              chapterOf={(id) => study.chapters.find((c) => c.id === id)}
              statusOf={statusOf}
              sideLinesOf={(id) => {
                const t = courseTrees.get(id);
                return t ? sideLines(t.tree, t.quick, t.startId!) : [];
              }}
              onOpen={openAt}
              onClose={() => window.history.back()}
            />
          )}
          {view === "chapter" && (
          <div className="layout">
            <aside className="sidebar">{menu}</aside>
            {showBoxes && !(loaded instanceof Error) && loaded.type === "line" ? (
              <BoxPage
                tree={loaded.tree}
                meta={chapterMeta}
                startId={loaded.startId}
                showDeep={showDeep}
                onToggleDeep={toggleDeep}
                onOpen={(id) => {
                  boxRef.current = { chapter: chapterId, box: boxOf(loaded.tree, id) };
                  setSpot(id);
                  window.scrollTo({ top: 0 });
                }}
                orientation={orientation}
              />
            ) : (
            <>
            <main className="board-area">
              {simLaunch ?? <div className="sim-launch" aria-hidden />}
              <Board
                state={board}
                orientation={orientation}
                onFlip={() => setOrientation((o) => (o === "white" ? "black" : "white"))}
                nav={nav}
                caption={caption}
                play={simActive ? simPlay : play}
                onTap={simActive ? undefined : (dir) => canStep(dir) && step(dir)}
              />
            </main>
            <section className="side-panel" aria-label={t("Bölüm içeriği")}>
              <div className="chapter-head">
                {showBack && (
                  <div className="back-strip">
                    <button className="back-strip-go" onClick={() => window.history.back()}>
                      <ArrowLeft size={15} /> <span>{t("Geldiğin yere dön:")}</span> <span className="san">{back!.label}</span>
                    </button>
                    <button className="icon-button" aria-label={t("Şeridi kapat")} title={t("Kapat")} onClick={dropBack}>
                      <X size={15} />
                    </button>
                  </div>
                )}
                <span className="chapter-group">
                  {chapterMeta.group}
                  {chapterMeta.code ? ` · ${chapterMeta.code}` : ""}
                  {box !== undefined && !(loaded instanceof Error) && loaded.type === "line" && (
                    <>
                      {" · "}
                      <span className="san">{t("{name} kutusu", { name: boxLabel(loaded.tree, box, loaded.startId, notation) })}</span>
                      <button className="box-back" onClick={() => setSpot(undefined)}>
                        ← {t("Bütün kutular")}
                      </button>
                    </>
                  )}
                </span>
                <h1>
                  <RichInline text={chapterMeta.title} />
                </h1>
                {chapterMeta.untranslated && <p className="untranslated-note">{t("Bu bölüm henüz çevrilmedi; Türkçe aslı gösteriliyor.")}</p>}
              </div>
              {side}
              {isProse && <div ref={proseEnd} className="prose-end" aria-hidden />}
            </section>
            </>
            )}
          </div>
          )}
          <nav className={`mobile-bar${view === "chapter" ? "" : " outside"}`} aria-label={t("Gezinme")}>
            <button className="mobile-menu" onClick={() => setDrawer(true)}>
              <ListTree size={18} /> <span className="bar-label">{t("Bölümler")}</span>
            </button>
            <button className="icon-button bar-flip" aria-label={t("Tahtayı çevir")} onClick={() => setOrientation((o) => (o === "white" ? "black" : "white"))}>
              <RotateCw size={17} />
            </button>
            {atEnd && nextChapter ? (
              <button className="mobile-next" onClick={() => selectChapter(nextChapter.id)}>
                <span className="bar-label">{t("Sonraki")}</span> {nextChapter.code ?? t("bölüm")} <ChevronRight size={16} />
              </button>
            ) : (
              <span className="mobile-spacer" />
            )}
            <button className="mobile-arrow" aria-label={t("Geri")} disabled={simActive || !canStep(-1)} onClick={() => step(-1)}>
              <ChevronLeft size={22} />
            </button>
            <button className="mobile-arrow" data-tour="next" aria-label={t("İleri")} disabled={simActive || !canStep(1)} onClick={() => step(1)}>
              <ChevronRight size={22} />
            </button>
          </nav>
          {view === "chapter" && fullTree && (
            <PointsMenu
              open={pointsOpen}
              onToggle={setPointsOpen}
              tree={fullTree}
              points={pointsHere}
              done={doneHere}
              current={nodeId}
              next={nextPoint()}
              onOpen={(id) => {
                setSim(undefined);
                setSpot(id);
                window.scrollTo({ top: 0 });
              }}
            />
          )}
          {drawer && (
            <div className="nav-drawer" role="dialog" aria-label={t("Bölümler")} onClick={(e) => e.target === e.currentTarget && setDrawer(false)}>
              <div className="nav-drawer-panel">
                <div className="nav-drawer-head">
                  <strong>{study.title}</strong>
                  <button className="icon-button" aria-label={t("Kapat")} onClick={() => setDrawer(false)}>

                    <X size={18} />
                  </button>
                </div>
                {menu}
              </div>
            </div>
          )}
        </div>
      </LinkContext.Provider>
    </NotationContext.Provider>
  );
}
