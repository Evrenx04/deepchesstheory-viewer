import type { ChapterMeta, StudyMeta } from "./study";

/** A chapter in the menu, with the master games that belong to it (a card's games). */
export interface ModuleEntry {
  chapter: ChapterMeta;
  children: ChapterMeta[];
}

/** A part of the course in the menu and on the course panel: the intro, one opening section, the cards, the endgames. */
export interface Module {
  key: string;
  title: string;
  /** The moves that lead into an opening section ("4.c3 Nf6 5.d3"). */
  moves?: string;
  entries: ModuleEntry[];
  /** Every chapter of the module, games included. */
  chapters: ChapterMeta[];
}

export interface Section {
  code: string;
  title: string;
  moves?: string;
}

/** study.json's "sections" (the opening sections A, B, C, D), read loosely. */
const sectionsOf = (study: StudyMeta): Section[] => ((study as StudyMeta & { sections?: Section[] }).sections ?? []);

/** The course split into modules: opening chapters by section code, cards and endgames with their games under them. */
export function courseModules(study: StudyMeta): Module[] {
  const modules: Module[] = [];
  const sections = sectionsOf(study);
  const byKey = new Map<string, Module>();
  const moduleFor = (key: string, title: string, moves?: string) => {
    let m = byKey.get(key);
    if (!m) {
      m = { key, title, moves, entries: [], chapters: [] };
      byKey.set(key, m);
      modules.push(m);
    }
    return m;
  };
  for (const chapter of study.chapters) {
    const section = chapter.type === "line" && chapter.code ? sections.find((s) => chapter.code!.startsWith(s.code)) : undefined;
    const module = section ? moduleFor(section.code, section.title, section.moves) : moduleFor(chapter.group, chapter.group);
    module.chapters.push(chapter);
    // A game coded like its card plus a letter ("P1a" under "P1") goes under that card.
    const parent =
      chapter.type === "game" && chapter.code
        ? module.entries.find((e) => e.chapter.type === "prose" && e.chapter.code && new RegExp(`^${e.chapter.code}[a-z]$`).test(chapter.code!))
        : undefined;
    if (parent) parent.children.push(chapter);
    else module.entries.push({ chapter, children: [] });
  }
  return modules;
}

/** The module and menu entry a chapter belongs to. */
export function moduleOf(modules: Module[], chapterId: string): { module: Module; entry: ModuleEntry } | undefined {
  for (const module of modules)
    for (const entry of module.entries)
      if (entry.chapter.id === chapterId || entry.children.some((c) => c.id === chapterId)) return { module, entry };
  return undefined;
}
