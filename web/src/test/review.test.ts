import { beforeEach, describe, expect, it } from "vitest";
import {
  addCards,
  answer,
  dueCards,
  emptyReview,
  forecast,
  loadReview,
  mastered,
  RETRY_MS,
  reviewKey,
  saveReview,
  stats,
} from "../lib/review";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const T = new Date(2026, 9, 19, 10).getTime();
const level = (s: ReturnType<typeof emptyReview>, id: string) => s.cards[id].level;

describe("addCards", () => {
  it("adds new cards due now and never duplicates", () => {
    let s = addCards(emptyReview(), ["c|0", "c|1"], "move", T, 5);
    s = answer(s, "c|0", true, T);
    const again = addCards(s, ["c|0", "c|2"], "quiz", T + DAY, 9);
    expect(Object.keys(again.cards)).toEqual(["c|0", "c|1", "c|2"]);
    expect(again.cards["c|0"]).toMatchObject({ level: 1, kind: "move", weight: 9 }); // progress kept, weight refreshed
    expect(again.cards["c|2"]).toMatchObject({ level: 0, due: T + DAY, kind: "quiz", lapses: 0 });
  });
});

describe("answer", () => {
  it("climbs the interval table", () => {
    let s = addCards(emptyReview(), ["a"], "move", T);
    let now = T;
    for (const days of [1, 3, 7, 14, 30, 90, 90]) {
      s = answer(s, "a", true, now);
      expect(s.cards.a.due).toBe(now + days * DAY);
      now = s.cards.a.due;
    }
    expect(level(s, "a")).toBe(6);
  });

  it("drops two levels, retries in 10 minutes and counts a lapse", () => {
    let s = addCards(emptyReview(), ["a"], "move", T);
    s.cards.a = { ...s.cards.a, level: 4, due: T, last: T - 14 * DAY };
    s = answer(s, "a", false, T);
    expect(s.cards.a).toMatchObject({ level: 2, due: T + RETRY_MS, lapses: 1, last: T });
    s = answer(s, "a", false, T + RETRY_MS);
    expect(level(s, "a")).toBe(0);
    s = answer(s, "a", false, T + 2 * RETRY_MS);
    expect(s.cards.a).toMatchObject({ level: 0, lapses: 2 });
  });

  it("does not count a lapse for a card that was never learned", () => {
    const s = answer(addCards(emptyReview(), ["a"], "move", T), "a", false, T);
    expect(s.cards.a).toMatchObject({ level: 0, lapses: 0 });
  });

  it("raises the level at most once per day when answered early", () => {
    let s = answer(addCards(emptyReview(), ["a"], "move", T), "a", true, T);
    const due = s.cards.a.due;
    s = answer(s, "a", true, T + 2 * 60 * MIN);
    expect(s.cards.a).toMatchObject({ level: 1, due, last: T + 2 * 60 * MIN });
    // Early on a later day it counts.
    s = answer(s, "a", true, due - 60 * MIN);
    expect(s.cards.a.level).toBe(2);
  });

  it("ignores unknown ids", () => {
    const s = emptyReview();
    expect(answer(s, "nope", true, T)).toBe(s);
  });

  it("does not mutate the old state", () => {
    const s = addCards(emptyReview(), ["a"], "move", T);
    answer(s, "a", true, T);
    expect(s.cards.a.level).toBe(0);
  });
});

describe("dueCards", () => {
  it("orders relearning first, then weight, then oldest due", () => {
    let s = addCards(emptyReview(), ["light", "heavy", "old", "lapsed"], "move", T - DAY);
    s.cards.light = { ...s.cards.light, level: 3, last: T - 8 * DAY, due: T - 3 * DAY, weight: 1 };
    s.cards.heavy = { ...s.cards.heavy, level: 3, last: T - 8 * DAY, due: T - 1 * DAY, weight: 50 };
    s.cards.old = { ...s.cards.old, level: 3, last: T - 8 * DAY, due: T - 5 * DAY, weight: 1 };
    s.cards.lapsed = { ...s.cards.lapsed, level: 1, last: T - 2 * DAY, due: T - 1, lapses: 1, weight: 0 };
    expect(dueCards(s, T).map((c) => c.id)).toEqual(["lapsed", "heavy", "old", "light"]);
  });

  it("leaves out cards that are not due yet", () => {
    const s = answer(addCards(emptyReview(), ["a", "b"], "move", T), "a", true, T);
    expect(dueCards(s, T).map((c) => c.id)).toEqual(["b"]);
    expect(dueCards(s, T + DAY).map((c) => c.id).sort()).toEqual(["a", "b"]);
  });

  it("caps never-shown cards by newLimit and the total by limit", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `n${i}`);
    let s = addCards(emptyReview(), ids, "move", T);
    expect(dueCards(s, T)).toHaveLength(15);
    expect(dueCards(s, T, { newLimit: 3 })).toHaveLength(3);
    expect(dueCards(s, T, { limit: 5 })).toHaveLength(5);
    // Cards already shown are not capped by newLimit.
    ids.forEach((id) => (s = answer(s, id, false, T)));
    expect(dueCards(s, T + RETRY_MS, { newLimit: 0 })).toHaveLength(20);
  });
});

describe("mastered, stats, forecast", () => {
  it("is mastered when every listed card is at level 4", () => {
    let s = addCards(emptyReview(), ["a", "b"], "move", T);
    s.cards.a = { ...s.cards.a, level: 4 };
    expect(mastered(s, ["a"])).toBe(true);
    expect(mastered(s, ["a", "b"])).toBe(false);
    expect(mastered(s, ["a", "missing"])).toBe(false);
    expect(mastered(s, [])).toBe(false);
  });

  it("counts due, learning, mature and total", () => {
    let s = addCards(emptyReview(), ["a", "b", "c"], "move", T);
    s = answer(s, "a", true, T);
    s.cards.c = { ...s.cards.c, level: 5, due: T + DAY };
    expect(stats(s, T)).toEqual({ due: 1, learning: 1, mature: 1, total: 3 });
  });

  it("forecasts the next local days, tomorrow first", () => {
    let s = addCards(emptyReview(), ["a", "b", "c", "d", "e"], "move", T);
    const day = (n: number, h: number) => new Date(2026, 9, 19 + n, h).getTime();
    s.cards.a = { ...s.cards.a, due: day(0, 18) }; // later today: not in the forecast
    s.cards.b = { ...s.cards.b, due: day(1, 0) };
    s.cards.c = { ...s.cards.c, due: day(1, 23) };
    s.cards.d = { ...s.cards.d, due: day(3, 9) };
    s.cards.e = { ...s.cards.e, due: day(40, 9) };
    expect(forecast(s, T)).toEqual([2, 0, 1, 0, 0, 0, 0]);
    expect(forecast(s, T, 3)).toEqual([2, 0, 1]);
  });
});

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips and recovers from bad data", () => {
    const s = addCards(emptyReview(), ["a"], "quiz", T, 3);
    saveReview(s, reviewKey("italian"));
    expect(loadReview("review:italian")).toEqual(s);
    localStorage.setItem("k", "nope");
    expect(loadReview("k")).toEqual(emptyReview());
    localStorage.setItem("k", JSON.stringify({ v: 9, cards: {} }));
    expect(loadReview("k")).toEqual(emptyReview());
    // Version 1 cards named tree paths: the deck starts over.
    localStorage.setItem("k", JSON.stringify({ v: 1, cards: { "a1|0.0": { id: "a1|0.0", kind: "move", level: 3, due: 1, lapses: 0 } } }));
    expect(loadReview("k")).toEqual(emptyReview());
  });
});
