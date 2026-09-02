import CaseArchitecture from "./CaseArchitecture";
import CaseDecisionList from "./CaseDecisionList";
import CaseResult from "./CaseResult";
import type { CaseStudy as CaseStudyData } from "@/content/case-studies";

/**
 * One case study, as a vertical editorial block rather than a project card.
 *
 * The order is fixed (overview, problem, architecture, challenge, decisions,
 * result, implementation) because it is the order the questions get asked in:
 * what was needed, what was hard, what was built, why that way, what came out.
 *
 * `index` drives the alternating composition on wide screens only; on a phone
 * every case reads top to bottom in the same order.
 */
export default function CaseStudy({
  study,
  index,
}: {
  study: CaseStudyData;
  index: number;
}) {
  const number = String(index + 1).padStart(2, "0");

  return (
    <article
      id={study.id}
      className={`wcase wcase--${study.accent}${index % 2 === 1 ? " wcase--alt" : ""}`}
      aria-labelledby={`${study.id}-title`}
    >
      <header className="wcase__head">
        <div className="wcase__marks">
          <p className="wcase__number">CASE / {number}</p>
          {/* Stated on the case itself, not in a caption: an internal project
              must never be able to read as delivered client work. */}
          <p className="wcase__disclosure">{study.disclosure}</p>
        </div>
        <h3 id={`${study.id}-title`} className="wcase__title">
          {study.title}
        </h3>
        <p className="wcase__category">{study.category}</p>
        <p className="wcase__summary">{study.summary}</p>
      </header>

      <div className="wcase__body">
        <section className="wcase__problem" aria-label="The problem">
          <p className="wcase__panel-title">THE PROBLEM</p>
          <ul className="wcase__problem-list">
            {study.problem.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="wcase__scope">
            <span className="wcase__label">Scope:</span> {study.scope}
          </p>
        </section>

        <div className="wcase__architecture">
          <CaseArchitecture
            summary={study.architecture.summary}
            nodes={study.architecture.nodes}
            connections={study.architecture.connections}
          />
        </div>

        <section className="wcase__challenge" aria-label="Engineering challenge">
          <p className="wcase__panel-title">ENGINEERING CHALLENGE</p>
          <h4 className="wcase__challenge-title">{study.challenge.title}</h4>
          <p className="wcase__challenge-body">{study.challenge.body}</p>
        </section>

        <CaseDecisionList decisions={study.decisions} />

        <CaseResult study={study} />

        <section className="wcase__impl" aria-label="Implementation">
          <p className="wcase__panel-title">IMPLEMENTATION</p>
          <ul className="wcase__impl-list">
            {study.technologies.map((tech) => (
              <li key={tech}>{tech}</li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  );
}
