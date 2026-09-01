import { publishableMetrics, type CaseStudy } from "@/content/case-studies";

/**
 * What was delivered, plus any metric that has been verified.
 *
 * Outcomes are allowed to be qualitative — "centralised workflow state in one
 * system" is a real result. An unverified metric is dropped here rather than
 * rendered with a caveat, because a caveat still puts the number on the page.
 */
export default function CaseResult({ study }: { study: CaseStudy }) {
  const metrics = publishableMetrics(study);

  return (
    <div className="wresult">
      <p className="wresult__title">RESULT</p>

      <ul className="wresult__list">
        {study.result.map((item) => (
          <li key={item} className="wresult__item">
            <span className="wresult__mark" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>

      {metrics.length > 0 && (
        <>
        {/* Labelled as evidence, not as an outcome claim. These are observed
            request counts; they are never restated as a percentage. */}
        <p className="wresult__evidence-title">TEST EVIDENCE</p>
        <dl className="wresult__metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className="wresult__metric">
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
        </>
      )}
    </div>
  );
}
