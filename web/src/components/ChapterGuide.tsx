import type { ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { t } from "../lib/i18n";

/**
 * "Bu konumda: 3 seçenek · 8 usta oyunu · 4 plan": what a position has besides its note, on one line under it.
 * Closed until the reader opens it; the choice is kept from move to move (and between visits).
 */
export function PositionFold({
  summary,
  open,
  onToggle,
  children,
}: {
  /** What is folded; empty when the position has nothing but the move list. */
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className={`position-fold${open ? " open" : ""}`} data-tour="fold">
      <button className="position-fold-head" onClick={onToggle} aria-expanded={open}>
        <span>
          {summary ? (
            <>
              <b>{t("Bu konumda")}:</b> {summary} · {t("hamle listesi")}
            </>
          ) : (
            <b>{t("Hamle listesi")}</b>
          )}
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && <div className="position-fold-body">{children}</div>}
    </div>
  );
}
