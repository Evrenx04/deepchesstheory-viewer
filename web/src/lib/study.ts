import type { Weights } from "./sim";
import { mainlineAt, parseStudyPgn, urlCodes } from "./pgnTree";
import type { MoveTree } from "./pgnTree";
import type { PlanMeta } from "./plans";
import { parseProse, type Block } from "./prose";
import { getLang, t, type Lang } from "./i18n";

export type ChapterType = "line" | "game" | "prose";

export interface ChapterMeta {
  id: string;
  title: string;
  group: string;
  type: ChapterType;
  file: string;
  /** Variation code such as "A" or "A2"; its length sets the indent in the tree. */
  code?: string;
  summary?: string;
  /** "Bu bölümde öğreneceklerin": shown with the intro. */
  goals?: string[];
  /** "Aklında kalsın": shown at the end of the main line. */
  takeaways?: string[];
  /** Long plans tracked under the board. */
  plans?: PlanMeta[];
  /** In a translation: the chapter is not translated yet and is shown in the original (Turkish). */
  untranslated?: boolean;
  /** In the full version only: the published site lists it (title, goals) but does not ship its file (web/contentPlugin.ts). */
  locked?: boolean;
  /** A locked chapter's subject position, shown on the board with its preview. */
  previewFen?: string;
  /** A master game's questions ([%quiz]), counted when the index is built: the course panel shows them. */
  quizzes?: number;
}

/** What loadChapter throws for a locked chapter: the page shows its title, goals and the waiting list instead. */
export class LockedChapter extends Error {
  constructor(readonly meta: ChapterMeta) {
    super(t("Bu bölüm tam sürümde."));
  }
}

export interface StudyMeta {
  id: string;
  title: string;
  subtitle: string;
  eco?: string;
  orientation: "white" | "black";
  chapters: ChapterMeta[];
  /** "Başlamadan önce oku": the course's note to the reader, a few short pages shown in a box on the first visit. */
  beforeReading?: { title: string; text: string }[];
}

export type LoadedChapter =
  /** startId: where the chapter opens; focusId: where its subject begins ([Start]). Card games open at the initial position. */
  | { meta: ChapterMeta; type: "line" | "game"; tree: MoveTree; startId: string; focusId: string }
  | { meta: ChapterMeta; type: "prose"; blocks: Block[] };

export interface AnchorTarget {
  chapter: string;
  node: string;
}

/** One study in content/index.json (written by web/contentPlugin.ts). */
export interface StudyEntry {
  meta: StudyMeta;
  /** Every [%id name] in the study's move chapters, for [[name|text]] links. */
  anchors: Record<string, AnchorTarget>;
  /** Published file (relative to the study folder) → short content hash. */
  files: Record<string, string>;
  /** Translations by language: their folder, study.json and translated chapter files. */
  translations?: Partial<Record<Lang, { dir: string; meta: TranslationMeta; files: Record<string, string> }>>;
}

/** The study as the reader's language shows it: translated fields and chapters, the rest in the original. */
export function localizedMeta(entry: StudyEntry, lang: Lang): StudyMeta {
  const tr = entry.translations?.[lang];
  if (!tr) return entry.meta;
  const { meta: m, files } = tr;
  const chapters = new Map((m.chapters ?? []).map((c) => [c.id, c]));
  return {
    ...entry.meta,
    ...(m.title ? { title: m.title } : {}),
    ...(m.subtitle ? { subtitle: m.subtitle } : {}),
    ...(m.beforeReading ? { beforeReading: m.beforeReading } : {}),
    ...(m.sections ? { sections: m.sections } : {}),
    chapters: entry.meta.chapters.map((c) => {
      const { id: _id, file: _file, type: _type, code: _code, ...fields } = chapters.get(c.id) ?? { id: c.id };
      // A locked chapter ships no file in either language; its translated title and goals are in the index.
      const translated = c.file in files || !!c.locked;
      return {
        ...c,
        // Goals, takeaways and plans belong to the text: they follow the chapter's language.
        ...(translated ? fields : { ...(fields.title ? { title: fields.title } : {}) }),
        group: m.groups?.[c.group] ?? c.group,
        ...(translated ? {} : { untranslated: true }),
      };
    }),
  };
}

/**
 * content/<study>-<lang>/study.json: a translation of the study. Course fields replace the original's;
 * a chapter entry (by id) replaces its title, summary, goals, takeaways and plans; `groups` maps the
 * original group names. A chapter counts as translated once its file exists in the translation folder.
 */
export interface TranslationMeta {
  translationOf: string;
  lang: Lang;
  title?: string;
  subtitle?: string;
  beforeReading?: StudyMeta["beforeReading"];
  sections?: unknown[];
  groups?: Record<string, string>;
  chapters?: (Partial<ChapterMeta> & { id: string })[];
}

export interface ContentIndex {
  studies: StudyEntry[];
}

// The content is not bundled: it is fetched from content/ next to the page, a chapter when it is opened.
const contentRoot = `${import.meta.env.BASE_URL}content/`;
const entries = new Map<string, StudyEntry>();
/** Fetched files ("study/file") and the errors of failed ones. */
const texts = new Map<string, string | Error>();
const pending = new Map<string, Promise<void>>();

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

let indexLoad: Promise<StudyMeta[]> | undefined;

/** content/index.json: the studies with their chapter lists and link anchors. */
export function loadStudies(): Promise<StudyMeta[]> {
  indexLoad ??= fetch(`${contentRoot}index.json`, { cache: "no-cache" })
    .then((res) => {
      if (!res.ok) throw new Error(`İçerik dizini yüklenemedi (${res.status}).`);
      return res.json() as Promise<ContentIndex>;
    })
    .then((index) => {
      for (const entry of index.studies) entries.set(entry.meta.id, entry);
      return index.studies.map((e) => localizedMeta(e, getLang()));
    });
  indexLoad.catch(() => (indexLoad = undefined));
  return indexLoad;
}

/** Fetches a file of the study once; a failure is kept for its reader to report, and tried again on the next call. */
function fetchFile(studyId: string, file: string): Promise<void> {
  const key = `${studyId}/${file}`;
  if (typeof texts.get(key) === "string") return Promise.resolve();
  let load = pending.get(key);
  if (load) return load;
  // A chapter translated into the reader's language comes from the translation folder, under the same name.
  const entry = entries.get(studyId);
  const translation = entry?.translations?.[getLang()];
  const local = translation?.files[file];
  const hash = local ?? entry?.files[file];
  const url = `${local ? translation!.dir : studyId}/${file}`;
  load = (
    hash === undefined
      ? Promise.reject(new Error(`İçerik dosyası bulunamadı: ${key}`))
      : fetch(`${contentRoot}${url.split("/").map(encodeURIComponent).join("/")}?v=${hash}`).then((res) => {
          if (!res.ok) throw new Error(`İçerik dosyası yüklenemedi: ${key} (${res.status})`);
          return res.text();
        })
  )
    .then(
      (text) => void texts.set(key, text),
      (error) => void texts.set(key, toError(error)),
    )
    .finally(() => pending.delete(key));
  pending.set(key, load);
  return load;
}

function contentFile(studyId: string, file: string): string {
  const text = texts.get(`${studyId}/${file}`);
  if (text === undefined) throw new Error(`İçerik dosyası henüz yüklenmedi: ${studyId}/${file}`);
  if (text instanceof Error) throw text;
  return text;
}

/** Whether the chapter's file has been fetched. */
export const chapterReady = (study: StudyMeta, meta: ChapterMeta) => !!meta.locked || typeof texts.get(`${study.id}/${meta.file}`) === "string";

/** Fetches the chapter's file; never rejects, loadChapter reports a failure. */
export const fetchChapter = (study: StudyMeta, meta: ChapterMeta) => (meta.locked ? Promise.resolve() : fetchFile(study.id, meta.file));

/** Line chapters the simulation and the course trees use: the published ones. */
const openLines = (study: StudyMeta) => study.chapters.filter((c) => c.type === "line" && !c.locked);

/** The study's line chapters and the move weights: what the simulation graph is built from. */
export const fetchSimData = (study: StudyMeta) =>
  Promise.all([...openLines(study).map((c) => fetchChapter(study, c)), fetchFile(study.id, "weights.json")]).then(
    () => undefined,
  );

/** Whether fetchSimData has finished (a failed file is left out of the graph). */
export const simDataReady = (study: StudyMeta) =>
  [...openLines(study).map((c) => c.file), "weights.json"].every((file) => texts.has(`${study.id}/${file}`));

/** The chapter, once fetchChapter has fetched it. */
export function loadChapter(study: StudyMeta, meta: ChapterMeta): LoadedChapter {
  if (meta.locked) throw new LockedChapter(meta);
  const raw = contentFile(study.id, meta.file);
  if (meta.type === "prose") return { meta, type: "prose", blocks: parseProse(raw, meta.file) };
  const tree = parseStudyPgn(raw, meta.file);
  urlCodes(tree, meta.file); // two moves with one address code would stop the chapter here, not later in the page
  // [Start "7"] marks the subject after the 7th half-move: a line chapter opens there, a card game at the initial position.
  const focusId = mainlineAt(tree, Number(tree.headers.Start ?? 0));
  return { meta, type: meta.type, tree, startId: meta.type === "game" ? tree.root : focusId, focusId };
}

const anchorCache = new Map<string, Map<string, AnchorTarget>>();

/** Every [%id name] in the study's move chapters, for [[name|text]] links. */
export function anchorIndex(study: StudyMeta): Map<string, AnchorTarget> {
  let index = anchorCache.get(study.id);
  if (index) return index;
  index = new Map(Object.entries(entries.get(study.id)?.anchors ?? {}));
  anchorCache.set(study.id, index);
  return index;
}

export interface MasterGame {
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  date: string;
  event: string;
  result: string;
  fast: boolean;
  source: string;
  moves: string;
}

export interface GamesIndex {
  /** Position (FEN without move counters) → game ids, strongest first. */
  positions: Record<string, string[]>;
  games: Record<string, MasterGame>;
}

export const GAME_PREFIX = "oyun-";

const parsed = new Map<string, unknown>();
function jsonFile<T>(studyId: string, file: string): T | undefined {
  const key = `${studyId}/${file}`;
  if (!parsed.has(key)) {
    const raw = texts.get(key);
    if (typeof raw !== "string") return undefined;
    parsed.set(key, JSON.parse(raw));
  }
  return parsed.get(key) as T;
}

export const fetchGames = (study: StudyMeta) => fetchFile(study.id, "games.json");

/** content/<study>/games.json, written by tools/games_index.py; undefined until fetchGames has fetched it. */
export const gamesIndex = (study: StudyMeta) => jsonFile<GamesIndex>(study.id, "games.json");

/** content/<study>/weights.json, written by tools/sim_weights.py: how often the tree's moves are played. */
export const moveWeights = (study: StudyMeta): Weights => jsonFile<Weights>(study.id, "weights.json") ?? {};

/** FEN without the move counters, the key games.json uses. */
export const positionKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

/** A master game opened from the games box, shown like a chapter without comments. */
export function loadGameChapter(study: StudyMeta, chapterId: string): LoadedChapter {
  const id = chapterId.slice(GAME_PREFIX.length);
  const game = gamesIndex(study)?.games[id];
  if (!game) throw new Error(t("Oyun bulunamadı."));
  const headers = { White: game.white, Black: game.black, Event: game.event, Date: game.date, Result: game.result };
  const pgn = `${Object.entries(headers)
    .map(([k, v]) => `[${k} "${v}"]`)
    .join("\n")}\n\n${game.moves} ${game.result}`;
  const meta: ChapterMeta = { id: chapterId, title: `${game.white} – ${game.black}`, group: t("Usta oyunu"), type: "game", file: "" };
  return { meta, type: "game", tree: parseStudyPgn(pgn, meta.title), startId: "", focusId: "" };
}
