import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
export type TextSize = "s" | "m" | "l";
export type BoardSize = "l" | "m" | "s";

export interface Settings {
  /** Interface and content language; changing it reloads the page (lib/i18n.ts). */
  lang: "tr" | "en";
  theme: Theme;
  /** Size of the notes' text. */
  text: TextSize;
  /** On a phone: how much of the screen width the board takes. */
  board: BoardSize;
  /** Short sounds for right and wrong moves while training. */
  sound: boolean;
}

/** A first visit picks the language from the browser: Turkish for a Turkish browser, English for every other. */
export function browserLang(): Settings["lang"] {
  const langs = typeof navigator === "undefined" ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs.some((l) => l?.toLowerCase().startsWith("tr")) ? "tr" : "en";
}

const DEFAULTS: Settings = { lang: browserLang(), theme: "dark", text: "m", board: "l", sound: true };
const KEY = "settings";

/** The stored settings; index.html reads the same key before the first paint, so the page never flashes light. */
export function readSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Settings>;
    return {
      lang: stored.lang === "en" || stored.lang === "tr" ? stored.lang : DEFAULTS.lang,
      theme: stored.theme === "light" ? "light" : "dark",
      text: stored.text === "s" || stored.text === "l" ? stored.text : "m",
      board: stored.board === "m" || stored.board === "s" ? stored.board : "l",
      sound: stored.sound !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

const apply = (s: Settings) => {
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.text = s.text;
  root.dataset.board = s.board;
  root.lang = s.lang;
};

export function useSettings() {
  const [settings, setSettings] = useState(readSettings);
  useEffect(() => apply(settings), [settings]);
  const update = useCallback((change: Partial<Settings>) => {
    setSettings((old) => {
      const next = { ...old, ...change };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep the in-memory value */
      }
      return next;
    });
  }, []);
  return [settings, update] as const;
}
