import type { CaseDecision } from "@/content/case-studies";

/**
 * Key decisions, as an editorial sequence rather than a card row.
 *
 * The reason matters more than the decision, and the trade-off matters most of
 * all: a decision with no stated cost usually means the cost was not
 * considered. It renders only when the case actually recorded one.
 */
export default function CaseDecisionList({ decisions }: { decisions: CaseDecision[] }) {
  if (decisions.length === 0) return null;

  return (
    <div className="wdec">
      <p className="wdec__title">KEY DECISIONS</p>
      <ol className="wdec__list">
        {decisions.map((decision) => (
          <li key={decision.index} className="wdec__item">
            <span className="wdec__index">{decision.index}</span>
            <div className="wdec__body">
              <h4 className="wdec__heading">{decision.title}</h4>
              <p className="wdec__reason">
                <span className="wdec__label">Why:</span> {decision.reason}
              </p>
              {decision.tradeOff && (
                <p className="wdec__tradeoff">
                  <span className="wdec__label">Trade-off:</span> {decision.tradeOff}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
