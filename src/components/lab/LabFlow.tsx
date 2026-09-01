import type { FlowStage } from "./lab-experiments";

/**
 * The system flow shared by every experiment: the stages a unit of work
 * passes through. One stage is lit at a time, and a stage that failed is
 * marked so the flow visibly stops there rather than quietly continuing.
 */
export default function LabFlow({
  stages,
  active,
  failed,
  running,
}: {
  stages: FlowStage[];
  active: number;
  failed?: number;
  running: boolean;
}) {
  return (
    <div className="lflow">
      <div className="lflow__head">
        <span className="lflow__title">SYSTEM FLOW</span>
        <span className="lflow__tag">{running ? "STATE / RUNNING" : "STATE / IDLE"}</span>
      </div>

      <ol className="lflow__list">
        {stages.map((stage, i) => (
          <li
            key={stage.id}
            className={`lstage${i === active ? " is-active" : ""}${
              failed === i ? " is-failed" : ""
            }${active > i || (active === stages.length - 1 && i < active) ? " is-passed" : ""}`}
          >
            <span className="lstage__label">{stage.label}</span>
            <span className="lstage__code">{stage.code}</span>
            {i < stages.length - 1 && <span className="lstage__link" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  );
}
