import type { LearningScenario, Variant } from "./learning-scenarios";

/**
 * The left panel: who the system thinks it is teaching.
 *
 * Everything here is synthetic and says so. "Maya" is a fixture, not a person,
 * and the percentages describe the shape of a learner model rather than any
 * measurement that was ever taken.
 */
export default function LearnerStatePanel({
  scenario,
  variant,
}: {
  scenario: LearningScenario;
  variant: Variant;
}) {
  const { learner } = scenario;
  return (
    <section className="lpanel lpanel--learner" aria-labelledby="learner-state-title">
      <header className="lpanel__head">
        <h3 className="lpanel__title" id="learner-state-title">
          LEARNER STATE
        </h3>
        <span className="lpanel__badge">SIMULATED LEARNER</span>
      </header>

      <dl className="lprofile">
        <div className="lprofile__row">
          <dt>Learner</dt>
          <dd>{learner.name}</dd>
        </div>
        <div className="lprofile__row">
          <dt>Level</dt>
          <dd>{learner.level}</dd>
        </div>
        <div className="lprofile__row">
          <dt>Goal</dt>
          <dd>{learner.goal}</dd>
        </div>
        <div className="lprofile__row">
          <dt>Confidence</dt>
          <dd>
            <span className="lprofile__confidence">
              <span
                className="lprofile__confidence-fill"
                style={{ width: `${variant.confidence}%` }}
              />
            </span>
            {variant.confidence}%
          </dd>
        </div>
      </dl>

      <div className="lmeters">
        <p className="lpanel__label">{scenario.metersTitle}</p>
        <ul className="lmeters__list">
          {variant.meters.map((meter) => (
            <li key={meter.label} className="lmeter">
              <span className="lmeter__label">{meter.label}</span>
              <span className="lmeter__track">
                <span className="lmeter__fill" style={{ width: `${meter.value}%` }} />
              </span>
              <span className="lmeter__value">{meter.value}%</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="lgaps">
        <p className="lpanel__label">{scenario.gapsTitle}</p>
        <ul className="lgaps__list">
          {variant.gaps.map((gap) => (
            <li key={gap} className="lgap">
              <span className="lgap__mark" aria-hidden="true" />
              <span className="lgap__text">{gap}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
