import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { placeTip, scrollToShow, type Box, type TourStep } from "../lib/tour";
import { t } from "../lib/i18n";

/** The first element matching one of the selectors that is on screen (not display:none, not zero-sized). */
export function findTarget(selectors: string[], root: ParentNode = document): HTMLElement | undefined {
  for (const selector of selectors)
    for (const el of root.querySelectorAll<HTMLElement>(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
    }
  return undefined;
}

/** In a bar that stays put (sticky or fixed): scrolling the page does not move it. */
const pinned = (el: HTMLElement) => {
  for (let e: HTMLElement | null = el; e; e = e.parentElement) {
    const p = getComputedStyle(e).position;
    if (p === "fixed" || p === "sticky") return true;
  }
  return false;
};

/** The part of the screen the page scrolls under: below the sticky top bar and board, above the phone's bottom bar. */
const freeBand = () => {
  let top = 0;
  let bottom = window.innerHeight;
  for (const el of document.querySelectorAll<HTMLElement>(".topbar, .board-area, .board-column")) {
    const p = getComputedStyle(el).position;
    const r = el.getBoundingClientRect();
    // Stacked: the board sticks under the top bar.
    if ((p === "sticky" || p === "fixed") && r.height > 0 && r.top <= top + 1) top = Math.max(top, r.bottom);
  }
  const bar = document.querySelector<HTMLElement>(".mobile-bar");
  if (bar && getComputedStyle(bar).position === "fixed" && bar.getBoundingClientRect().height > 0) bottom = Math.min(bottom, bar.getBoundingClientRect().top);
  return { top, bottom };
};

const boxOf = (el: HTMLElement): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

/** How long a step waits for its element before it is passed over. */
const MISSING_MS = 1800;

/**
 * The tour: the screen darkens, one control is lit, a bubble with an arrow says what it is. On the first visit it
 * cannot be skipped (`canSkip` false); reopened from ⚙ Ayarlar it can. Steps without an action go on with "Anladım",
 * Enter or →; an action step goes on when the reader presses the lit control (the click goes through to the page).
 */
export function Tour({ steps, canSkip, onDone }: { steps: TourStep[]; canSkip: boolean; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box>();
  const [tipSize, setTipSize] = useState({ w: 300, h: 160 });
  const target = useRef<HTMLElement | undefined>(undefined);
  const tip = useRef<HTMLDivElement>(null);
  const step = steps[index];
  // Ending runs once, whatever ends it (the last step, a skip, a timer that fires once more).
  const ended = useRef(false);
  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    onDone();
  }, [onDone]);
  const next = useCallback(() => (index + 1 < steps.length ? setIndex(index + 1) : finish()), [index, steps.length, finish]);

  // Follow the step's element: find it, bring it into view, keep the light on it while the page moves.
  useEffect(() => {
    if (!step) return;
    target.current = undefined;
    setBox(undefined);
    const began = Date.now();
    let scrolls = 0;
    let moved = false;
    const go = () => {
      moved = true;
      next();
    };
    const tick = () => {
      if (moved) return;
      if (step.until && findTarget([step.until])) return go();
      const el = findTarget(step.target);
      if (!el) {
        if (Date.now() - began > MISSING_MS) go();
        return;
      }
      target.current = el;
      if (!pinned(el) && scrolls < 4) {
        const by = scrollToShow(boxOf(el), freeBand());
        if (Math.abs(by) > 2) {
          scrolls++;
          window.scrollBy({ top: by });
        }
      }
      setBox((old) => {
        const b = boxOf(el);
        return old && Math.abs(old.x - b.x) < 1 && Math.abs(old.y - b.y) < 1 && Math.abs(old.w - b.w) < 1 && Math.abs(old.h - b.h) < 1 ? old : b;
      });
    };
    tick();
    const timer = window.setInterval(tick, 150);
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
    };
  }, [step, next]);

  // An action step: the press on the lit control reaches the page, then the tour goes on (or waits for `until`).
  useEffect(() => {
    if (!step?.action) return;
    const onClick = (event: MouseEvent) => {
      if (!target.current?.contains(event.target as Node)) return;
      if (!step.until) window.setTimeout(next, 0);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [step, next]);

  // The keyboard belongs to the tour while it runs: the page's arrow keys would move the board under it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") return;
      event.stopPropagation();
      event.preventDefault();
      if ((event.key === "Enter" || event.key === "ArrowRight") && step && !step.action) next();
      else if (event.key === "Escape" && canSkip) finish();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [step, next, canSkip, finish]);

  useLayoutEffect(() => {
    const el = tip.current;
    if (el && (Math.abs(el.offsetWidth - tipSize.w) > 1 || Math.abs(el.offsetHeight - tipSize.h) > 1)) setTipSize({ w: el.offsetWidth, h: el.offsetHeight });
  });

  if (!step) return null;
  const view = { w: window.innerWidth, h: window.innerHeight };
  const pad = 6;
  const lit = box && { x: box.x - pad, y: box.y - pad, w: box.w + 2 * pad, h: box.h + 2 * pad };
  const place = lit ? placeTip(lit, tipSize, view) : { left: (view.w - tipSize.w) / 2, top: (view.h - tipSize.h) / 2, below: true };
  // The shade takes every click; on an action step it has a hole over the lit control.
  const hole =
    lit && step.action
      ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 ${lit.y}px, ${lit.x}px ${lit.y}px, ${lit.x}px ${lit.y + lit.h}px, ${lit.x + lit.w}px ${lit.y + lit.h}px, ${lit.x + lit.w}px ${lit.y}px, 0 ${lit.y}px)`
      : undefined;
  const from = { x: Math.min(Math.max(place.left + 28, lit ? lit.x + lit.w / 2 : 0), place.left + tipSize.w - 28), y: place.below ? place.top : place.top + tipSize.h };
  const to = lit && { x: lit.x + lit.w / 2, y: place.below ? lit.y + lit.h + 4 : lit.y - 4 };
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div className="tour-shade" style={{ clipPath: hole, background: lit ? "transparent" : undefined }} />
      {lit && <div className="tour-spot" style={{ left: lit.x, top: lit.y, width: lit.w, height: lit.h }} />}
      {to && (
        <svg className="tour-arrow" width={view.w} height={view.h} aria-hidden>
          <defs>
            <marker id="tour-head" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" />
            </marker>
          </defs>
          <path d={`M${from.x},${from.y} Q${(from.x + to.x) / 2 + 24},${(from.y + to.y) / 2} ${to.x},${to.y}`} markerEnd="url(#tour-head)" />
        </svg>
      )}
      <div ref={tip} className="tour-tip" style={{ left: place.left, top: place.top }} aria-live="polite">
        <strong id="tour-title">{step.title}</strong>
        <p>{step.text}</p>
        {step.action && <p className="tour-do">→ {step.action}</p>}
        <div className="tour-foot">
          <span className="tour-count">{t("{n} / {total}", { n: index + 1, total: steps.length })}</span>
          {canSkip && index + 1 < steps.length && (
            <button className="tour-skip" onClick={finish}>
              {t("Turu geç")}
            </button>
          )}
          {!step.action && (
            <button className="tour-next" autoFocus onClick={next}>
              {index + 1 < steps.length ? t("Anladım") : t("Bitir")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
