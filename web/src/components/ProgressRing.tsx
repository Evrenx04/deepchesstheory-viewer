import { t } from "../lib/i18n";
import type { NavStatus } from "./StudyNav";

const LABEL: Record<NavStatus["status"], string> = {
  new: "Başlanmadı",
  started: "Başlandı",
  read: "Okundu",
  drilled: "Simülasyonlar tamam",
  mastered: "Ustalaşıldı",
};

/** A chapter's state in the menu: an empty ring, a ring filling up, a tick, a star. */
export function ProgressRing({ fraction, status, size = 15 }: NavStatus & { size?: number }) {
  const r = size / 2 - 1.75;
  const c = 2 * Math.PI * r;
  const title = `${t(LABEL[status])}${status === "started" ? ` (${t("%{n}", { n: Math.round(fraction * 100) })})` : ""}`;

  if (status === "mastered")
    return (
      <span className="ring star" title={title} aria-label={title} style={{ width: size, height: size }}>
        ★
      </span>
    );
  if (status === "read" || status === "drilled")
    return (
      <span className={`ring done ${status}`} title={title} aria-label={title} style={{ width: size, height: size }}>
        ✓
      </span>
    );
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
      <title>{title}</title>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-track" />
      {fraction > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="ring-fill"
          strokeDasharray={`${c * Math.min(fraction, 1)} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
    </svg>
  );
}
