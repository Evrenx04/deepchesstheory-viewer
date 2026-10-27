import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { mainlineAt, parseStudyPgn } from "./src/lib/pgnTree.ts";
import { diagrams, parseProse } from "./src/lib/prose.ts";
import type { ContentIndex, StudyEntry, TranslationMeta } from "./src/lib/study.ts";

// Study content lives next to web/, in ../content. It is served as separate files under content/,
// not bundled into the JS: the page fetches a chapter when it is opened.
export const CONTENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../content");

/** Files a study publishes: its chapter files (but a locked chapter's) and the games and weights indexes. */
function studyFiles(meta: StudyEntry["meta"]): string[] {
  return [...new Set([...meta.chapters.filter((c) => !c.locked).map((c) => c.file), "games.json", "weights.json"])];
}

/**
 * The free part of a course (study.json "ucretsiz": chapter ids): every other chapter is locked. A locked chapter
 * keeps its place, title, code and goals ("Bu bölümde öğreneceklerin") in the index; its file, takeaways and plans
 * are left out, so the published site does not carry what only the full version shows.
 */
function lockChapters<T extends { id: string; takeaways?: unknown; plans?: unknown }>(chapters: T[], free: Set<string>): T[] {
  return chapters.map((c) => {
    if (free.has(c.id)) return c;
    const { takeaways: _t, plans: _p, ...rest } = c;
    return { ...rest, locked: true } as unknown as T;
  });
}

/** Short content hashes of the files a study folder publishes (so a changed file is not served from the browser cache). */
function fileHashes(folder: string, files: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of files) {
    const full = path.join(folder, file);
    if (existsSync(full)) out[file] = contentHash(readFileSync(full));
  }
  return out;
}

const contentHash = (data: string | Buffer) => createHash("sha1").update(data).digest("hex").slice(0, 10);

/** The move weights (weights.json: {position key: {san: counts}}) of the given positions only. */
export function weightsOf(weights: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(weights).filter(([key]) => keys.has(key)));
}

/**
 * weights.json as a course publishes it. With locked chapters, only the positions of its open chapters: the
 * weights of the others would show which moves the full version covers. (Keys as positionKey in src/lib/study.ts.)
 */
function publishedWeights(dir: string, meta: StudyEntry["meta"]): string {
  const raw = readFileSync(path.join(dir, meta.id, "weights.json"), "utf8");
  if (!meta.chapters.some((c) => c.locked)) return raw;
  const keys = new Set<string>();
  for (const chapter of meta.chapters) {
    if (chapter.locked || chapter.type === "prose") continue;
    try {
      const tree = parseStudyPgn(readFileSync(path.join(dir, meta.id, chapter.file), "utf8"), chapter.file);
      for (const node of tree.nodes.values()) keys.add(node.fen.split(" ").slice(0, 4).join(" "));
    } catch {
      /* the chapter itself reports its error when opened */
    }
  }
  return JSON.stringify(weightsOf(JSON.parse(raw), keys));
}

/**
 * content/index.json: every study's study.json, the [%id name] anchors of its move chapters
 * (for [[name|text]] links, which may point into chapters not loaded yet) and a short hash
 * of each file it publishes (so a changed file is not served from the browser cache).
 *
 * A folder whose study.json says "translationOf": "<study>" is a translation of that study
 * (content/italian-en/ for English): same file layout, only the chapters translated so far.
 * It is listed under the study's `translations`, never as a study of its own.
 * A study whose study.json says "draft": true is left out unless `drafts` (the build passes TASLAK=1 for it).
 */
export function buildIndex(dir = CONTENT_DIR, { drafts = true, lock = false } = {}): ContentIndex {
  const studies: StudyEntry[] = [];
  const translations: { dir: string; meta: TranslationMeta }[] = [];
  for (const id of readdirSync(dir).sort()) {
    const studyJson = path.join(dir, id, "study.json");
    if (!existsSync(studyJson)) continue;
    const raw = JSON.parse(readFileSync(studyJson, "utf8"));
    if (raw.translationOf) {
      translations.push({ dir: id, meta: raw as TranslationMeta });
      continue;
    }
    // A study still being written ("draft": true) is served by the dev server but left out of the build.
    if (raw.draft && !drafts) continue;
    const free: string[] | undefined = raw.ucretsiz;
    delete raw.ucretsiz;
    if (lock && free) raw.chapters = lockChapters(raw.chapters, new Set(free));
    const meta = raw as StudyEntry["meta"];
    const anchors: StudyEntry["anchors"] = {};
    const files = fileHashes(path.join(dir, id), studyFiles(meta));
    if (files["weights.json"]) files["weights.json"] = contentHash(publishedWeights(dir, meta));
    for (const chapter of meta.chapters) {
      // A locked chapter shows a position on the board: a move chapter its subject, a card its first diagram.
      if (chapter.locked) {
        try {
          const raw = readFileSync(path.join(dir, id, chapter.file), "utf8");
          if (chapter.type === "prose") chapter.previewFen = diagrams(parseProse(raw, chapter.file))[0]?.fen;
          else {
            const tree = parseStudyPgn(raw, chapter.file);
            chapter.previewFen = tree.nodes.get(mainlineAt(tree, Number(tree.headers.Start ?? 0)))!.fen;
          }
        } catch {
          /* no preview */
        }
      }
      if (chapter.type === "prose" || chapter.locked || !files[chapter.file]) continue;
      try {
        const tree = parseStudyPgn(readFileSync(path.join(dir, id, chapter.file), "utf8"), chapter.file);
        if (chapter.type === "game") chapter.quizzes = [...tree.nodes.values()].filter((n) => n.quiz !== undefined).length;
        // A link to a card game's subject ([Start]) opens the game from its first move, like the game itself.
        const focus = chapter.type === "game" ? mainlineAt(tree, Number(tree.headers.Start ?? 0)) : undefined;
        for (const node of tree.nodes.values())
          for (const name of node.anchors) anchors[name] = { chapter: chapter.id, node: node.id === focus ? tree.root : node.id };
      } catch {
        /* the chapter itself reports its error when opened */
      }
    }
    studies.push({ meta, anchors, files });
  }
  for (const { dir: folder, meta } of translations) {
    const entry = studies.find((s) => s.meta.id === meta.translationOf);
    if (!entry) continue;
    const locked = new Set(entry.meta.chapters.filter((c) => c.locked).map((c) => c.id));
    if (locked.size && meta.chapters) meta.chapters = lockChapters(meta.chapters, new Set(meta.chapters.map((c) => c.id).filter((id) => !locked.has(id))));
    // Only the chapter files: games.json and weights.json have no words in them.
    const files = fileHashes(path.join(dir, folder), [...new Set(entry.meta.chapters.filter((c) => !c.locked).map((c) => c.file))]);
    (entry.translations ??= {})[meta.lang] = { dir: folder, meta, files };
  }
  return { studies };
}

/** The files the index publishes, as "folder/file": a study's own and its translations'. */
function publishedFiles(index: ContentIndex): string[] {
  return index.studies.flatMap((s) => [
    ...Object.keys(s.files).map((f) => `${s.meta.id}/${f}`),
    ...Object.values(s.translations ?? {}).flatMap((tr) => Object.keys(tr.files).map((f) => `${tr.dir}/${f}`)),
  ]);
}

/** A published file ("folder/file") as it goes out: read from disk, a study's weights.json as publishedWeights gives it. */
export function publishedFile(index: ContentIndex, file: string, dir = CONTENT_DIR): string | Buffer {
  const study = index.studies.find((s) => file === `${s.meta.id}/weights.json`);
  return study ? publishedWeights(dir, study.meta) : readFileSync(path.join(dir, file));
}

const contentType = (file: string) => (file.endsWith(".json") ? "application/json; charset=utf-8" : "text/plain; charset=utf-8");

export function contentPlugin(dir = CONTENT_DIR): Plugin {
  return {
    name: "study-content",
    // Development: content/index.json is rebuilt after a content change, the files are read from ../content.
    configureServer(server) {
      server.watcher.add(dir);
      let cached: ContentIndex | undefined;
      const reload = (file: string) => {
        if (!file.startsWith(dir)) return;
        cached = undefined;
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("change", reload);
      server.watcher.on("add", reload);
      server.watcher.on("unlink", reload);
      server.middlewares.use((req, res, next) => {
        const prefix = `${server.config.base}content/`;
        const url = decodeURIComponent((req.url ?? "").split("?")[0]);
        if (!url.startsWith(prefix)) return next();
        const rest = url.slice(prefix.length);
        try {
          // KILIT=1 npm run dev: the site as published, with the locked chapters.
          const index = (cached ??= buildIndex(dir, { lock: process.env.KILIT === "1" }));
          let body: string | undefined;
          if (rest === "index.json") body = JSON.stringify(index);
          else {
            // Only the files the index publishes, as in the build.
            if (publishedFiles(index).includes(rest)) body = publishedFile(index, rest, dir).toString();
          }
          if (body === undefined) {
            res.statusCode = 404;
            res.end("Not found");
            return;
          }
          res.setHeader("Content-Type", contentType(rest));
          res.setHeader("Cache-Control", "no-cache");
          res.end(body);
        } catch (error) {
          next(error);
        }
      });
    },
    // Build: the same files are copied to dist/content/.
    generateBundle() {
      // The published site carries only the free part of a course that names one (KILIT=0 builds the full version).
      const index = buildIndex(dir, { drafts: process.env.TASLAK === "1", lock: process.env.KILIT !== "0" });
      this.emitFile({ type: "asset", fileName: "content/index.json", source: JSON.stringify(index) });
      for (const file of publishedFiles(index))
        this.emitFile({ type: "asset", fileName: `content/${file}`, source: publishedFile(index, file, dir) });
    },
  };
}
