import type { Experiment, Frame } from "./lab-experiments";

/**
 * The observation panel: what the experiment is doing, what just happened,
 * and the pattern it demonstrates.
 *
 * Three lines rather than a log. A screen reader should be able to take the
 * current state from one short region instead of walking decorative rows, so
 * the keys are marked up as a description list and nothing here scrolls.
 */
export default function LabObservation({
  experiment,
  frame,
  idle,
}: {
  experiment: Experiment;
  frame: Frame | null;
  idle: boolean;
}) {
  const state = idle || !frame ? "READY" : frame.state;
  const event = idle || !frame ? "No experiment has been run yet." : frame.event;

  return (
    <section className="lpanel lpanel--observation" aria-labelledby="lab-observation-title">
      <header className="lpanel__head">
        <h3 className="lpanel__title" id="lab-observation-title">
          OBSERVATION
        </h3>
        <span className="lpanel__badge">{experiment.annotations[1] ?? "STATE"}</span>
      </header>

      <dl className="lobs">
        <div className="lobs__row">
          <dt>STATE</dt>
          <dd className={`lobs__state lobs__state--${state.toLowerCase().replace(/[^a-z]/g, "")}`}>
            {state}
          </dd>
        </div>
        <div className="lobs__row lobs__row--stacked">
          <dt>LAST EVENT</dt>
          <dd className="lobs__event">{event}</dd>
        </div>
        <div className="lobs__row lobs__row--stacked">
          <dt>PATTERN</dt>
          <dd className="lobs__pattern">{experiment.pattern}</dd>
        </div>
      </dl>
    </section>
  );
}
