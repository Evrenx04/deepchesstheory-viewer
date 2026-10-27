import { EN } from "./i18n-en";
import { readSettings } from "./settings";

/**
 * The interface language. Turkish is the source: every string in the code is written in Turkish and passed
 * through t(), which looks it up in the English dictionary (i18n-en.ts) when the reader chose English.
 * The language is read once when the page loads; changing it in ⚙ Ayarlar reloads the page.
 */
export type Lang = "tr" | "en";

let current: Lang = readSettings().lang;

export const getLang = (): Lang => current;

/** For tests: switch the language without reloading. */
export function setLang(lang: Lang) {
  current = lang;
}

export type Params = Record<string, string | number>;
/** An English entry: a template with {name} placeholders, or a function for plurals and word order. */
export type Entry = string | ((p: Params) => string);

const fill = (text: string, params?: Params) => (params ? text.replace(/\{(\w+)\}/g, (all, k: string) => (k in params ? String(params[k]) : all)) : text);

/** "Hızlı yol" → "Quick path" in English; the Turkish text itself in Turkish (and when an entry is missing). */
export function t(tr: string, params?: Params): string {
  if (current === "en") {
    const entry = EN[tr];
    if (entry !== undefined) return typeof entry === "function" ? entry(params ?? {}) : fill(entry, params);
  }
  return fill(tr, params);
}

/** For text with elements inside (a move, a button), where the two languages need different JSX: L(tr, en). */
export const L = <T,>(tr: T, en: T): T => (current === "en" ? en : tr);

/** "1 line" / "2 lines". */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
