import { t } from "../lib/i18n";
import type { MoveTree } from "../lib/pgnTree";
import { planProgress, type PlanMeta } from "../lib/plans";
import { formatSan } from "../lib/notation";
import { useNotation } from "../lib/notationContext";
import { RichInline } from "./RichText";

interface Props {
  tree: MoveTree;
  nodeId: string;
  plans: PlanMeta[];
}

/** Long plans, step by step: which parts are already on the board at this position. */
export function PlanTracker({ tree, nodeId, plans }: Props) {
  const notation = useNotation();
  if (!plans.length) return null;
  return (
    <section className="plan-tracker" aria-label={t("Planlar")}>
      <div className="plan-heading">{t("Planlar bu konumda")}</div>
      {plans.map((plan) => {
        const done = planProgress(tree, nodeId, plan);
        const complete = done.every(Boolean);
        return (
          <div key={plan.title} className={`plan${complete ? " complete" : ""}`}>
            <div className="plan-title">
              <span className={`plan-side ${plan.side}`}>{plan.side === "white" ? t("Beyaz") : t("Siyah")}</span>

              <RichInline text={plan.title} />
            </div>
            <ol className="plan-steps">
              {plan.steps.map((step, i) => (
                <li key={step} className={done[i] ? "done" : ""}>
                  <span aria-hidden="true">{done[i] ? "✓" : "○"}</span>
                  <span className="san">{(plan.side === "black" ? "…" : "") + formatSan(step, notation)}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </section>
  );
}
