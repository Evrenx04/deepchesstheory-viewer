import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { Tour } from "../components/Tour";
import { Welcome } from "../components/Welcome";
import { placeTip, scrollToShow, tourSteps, type TourStep } from "../lib/tour";
import { setLang } from "../lib/i18n";

afterEach(() => {
  setLang("tr");
  vi.useRealTimers();
});

describe("tour steps", () => {
  it("names each step once and points every step at something", () => {
    const steps = tourSteps();
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
    for (const s of steps) {
      expect(s.target.length, s.id).toBeGreaterThan(0);
      expect(s.title && s.text, s.id).toBeTruthy();
    }
  });

  it("makes the reader press the first chapter and ›, the rest go on with Anladım", () => {
    expect(tourSteps().filter((s) => s.action).map((s) => s.id)).toEqual(["chapter", "next"]);
    // › is pressed until "Simüle et" shows (at the chapter's first move there may be no move of the reader's yet).
    expect(tourSteps().find((s) => s.id === "next")!.until).toBe('[data-tour="sim"]');
  });

  it("shows the chapter's way in and the folded line of the new reading screen", () => {
    const ids = tourSteps().map((s) => s.id);
    expect(ids.indexOf("start")).toBeLessThan(ids.indexOf("next"));
    expect(tourSteps().find((s) => s.id === "start")!.target[0]).toBe('[data-tour="intro"]');
    expect(ids.indexOf("points")).toBeLessThan(ids.indexOf("fold"));
  });

  it("speaks English too", () => {
    setLang("en");
    expect(tourSteps().find((s) => s.id === "sim")!.title).toBe("Simulate");
  });
});

describe("where the bubble goes", () => {
  const view = { w: 375, h: 812 };
  const tip = { w: 300, h: 160 };

  it("below the element when it fits, centred and inside the screen", () => {
    const p = placeTip({ x: 20, y: 100, w: 60, h: 40 }, tip, view);
    expect(p.below).toBe(true);
    expect(p.top).toBe(166);
    expect(p.left).toBe(12);
  });

  it("above it near the bottom (the phone's › button)", () => {
    const p = placeTip({ x: 300, y: 760, w: 60, h: 44 }, tip, view);
    expect(p.below).toBe(false);
    expect(p.top + tip.h).toBeLessThanOrEqual(760);
    expect(p.left + tip.w).toBeLessThanOrEqual(view.w - 12);
  });

  it("stays on the screen when the element is taller than it", () => {
    const p = placeTip({ x: 0, y: 40, w: 375, h: 760 }, tip, view);
    expect(p.top).toBeGreaterThanOrEqual(12);
    expect(p.top + tip.h).toBeLessThanOrEqual(view.h - 12);
  });
});

describe("bringing an element into view", () => {
  const band = { top: 400, bottom: 740 }; // under a phone's sticky board, above the bottom bar

  it("does not scroll when the element is in the free band", () => {
    expect(scrollToShow({ x: 0, y: 450, w: 100, h: 100 }, band)).toBe(0);
  });

  it("scrolls an element hidden under the board down into the band", () => {
    const by = scrollToShow({ x: 0, y: 300, w: 100, h: 100 }, band);
    expect(300 - by).toBeGreaterThanOrEqual(band.top);
    expect(300 - by + 100).toBeLessThanOrEqual(band.bottom);
  });

  it("puts a tall element's top under the board", () => {
    expect(1000 - scrollToShow({ x: 0, y: 1000, w: 100, h: 500 }, band)).toBe(band.top + 8);
  });
});

describe("Tour", () => {
  const steps: TourStep[] = [
    { id: "a", target: ["#a"], title: "Bir", text: "Birinci adım" },
    { id: "b", target: ["#b"], title: "İki", text: "İkinci adım" },
  ];

  it("cannot be skipped on the first visit; reopened, it can", () => {
    const first = render(<Tour steps={steps} canSkip={false} onDone={() => {}} />);
    expect(first.queryByText("Turu geç")).toBeNull();
    first.unmount();
    const again = render(<Tour steps={steps} canSkip onDone={() => {}} />);
    expect(again.getByText("Turu geç")).toBeInTheDocument();
  });

  it("goes on with Anladım and Enter, and ends with Bitir", () => {
    const done = vi.fn();
    const tour = render(<Tour steps={steps} canSkip={false} onDone={done} />);
    expect(tour.getByText("Birinci adım")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(tour.getByText("İkinci adım")).toBeInTheDocument();
    fireEvent.click(tour.getByText("Bitir"));
    expect(done).toHaveBeenCalledOnce();
  });

  it("keeps Escape and the page's arrow keys from the page on the first visit", () => {
    const done = vi.fn();
    const page = vi.fn();
    window.addEventListener("keydown", page);
    render(<Tour steps={steps} canSkip={false} onDone={done} />);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    window.removeEventListener("keydown", page);
    expect(done).not.toHaveBeenCalled();
    expect(page).not.toHaveBeenCalled();
  });

  it("passes over a step whose element is not on this screen", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    // jsdom lays nothing out: no element is ever on screen, so both steps are passed over.
    render(<Tour steps={steps} canSkip={false} onDone={done} />);
    act(() => void vi.advanceTimersByTime(2500));
    expect(done).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(2500));
    expect(done).toHaveBeenCalledOnce();
  });
});

describe("Welcome", () => {
  it("has one way on: Başla, no close button", () => {
    const start = vi.fn();
    const w = render(<Welcome title="İtalyan Oyunu" lang="tr" onLang={() => {}} onStart={start} />);
    expect(w.queryByLabelText("Kapat")).toBeNull();
    fireEvent.click(w.getByText("Başla"));
    expect(start).toHaveBeenCalledOnce();
  });
});
