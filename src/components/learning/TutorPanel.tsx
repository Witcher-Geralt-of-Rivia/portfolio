import type { LearningScenario, Variant } from "./learning-scenarios";

/**
 * The right panel.
 *
 * Deliberately not a chat window: context, a brief, a focus and one next
 * action. There is no input, no transcript, no model and no request. The
 * content is a fixed pair of strings per scenario, swapped by the adapt
 * sequence, which is why it can be labelled a local simulation honestly.
 */
export default function TutorPanel({
  scenario,
  variant,
  adapting,
}: {
  scenario: LearningScenario;
  variant: Variant;
  adapting: boolean;
}) {
  const { tutor } = variant;
  return (
    <section
      className={`lpanel lpanel--tutor${adapting ? " is-adapting" : ""}`}
      aria-labelledby="tutor-title"
    >
      <header className="lpanel__head">
        <h3 className="lpanel__title" id="tutor-title">
          AI TUTOR
        </h3>
        <span className="lpanel__badge lpanel__badge--sim">LOCAL SIMULATION</span>
      </header>

      <div className="ltutor__body" key={`${scenario.id}-${tutor.brief}`}>
        <p className="ltutor__brief">{tutor.brief}</p>

        <p className="ltutor__focus">
          <span className="ltutor__focus-label">{tutor.focusLabel}</span>
          <span className="ltutor__focus-text">{tutor.focus}</span>
        </p>

        <span className="ltutor__action">{tutor.action}</span>
      </div>

      <footer className="lpanel__foot">
        <span className="lpanel__dot" aria-hidden="true" />
        <span>context: {scenario.label.toLowerCase()}</span>
      </footer>
    </section>
  );
}
