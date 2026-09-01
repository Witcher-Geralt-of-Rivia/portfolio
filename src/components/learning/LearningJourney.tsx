import type { JourneyStep } from "./learning-scenarios";

/**
 * The horizontal progression beneath the map: how one adaptation moves from
 * the learner's context through to the next step. Compact technical nodes,
 * the same language as the Stage 05 execution flow, read as a learning loop
 * rather than a request pipeline.
 */
export default function LearningJourney({
  steps,
  current,
  adapting,
}: {
  steps: JourneyStep[];
  current: number;
  adapting: boolean;
}) {
  return (
    <div className="ljourney">
      <div className="ljourney__head">
        <span className="ljourney__title">LEARNING JOURNEY</span>
        <span className="ljourney__tag">
          {adapting ? "STATE / ADAPTING" : "STATE / SETTLED"}
        </span>
      </div>

      <ol className="ljourney__list">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={`ljstep${i === current ? " is-current" : ""}${
              i < current ? " is-passed" : ""
            }`}
          >
            <span className="ljstep__label">{step.label}</span>
            <span className="ljstep__code">{step.code}</span>
            {i < steps.length - 1 && <span className="ljstep__link" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  );
}
