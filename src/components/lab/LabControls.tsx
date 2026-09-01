import type { Experiment } from "./lab-experiments";

/**
 * Run and Reset.
 *
 * Run is disabled only while a sequence is in flight, and the completion is
 * announced once through the workspace's single live region rather than on
 * every simulated stage. Reset is always available, so a visitor is never
 * stuck watching a sequence they no longer want.
 */
export default function LabControls({
  experiment,
  frameCount,
  label,
  running,
  dirty,
  onRun,
  onReset,
  status,
}: {
  experiment: Experiment;
  /** Frames in the ACTIVE variant, so the progress bar matches the real run. */
  frameCount: number;
  label: string;
  running: boolean;
  dirty: boolean;
  onRun: () => void;
  onReset: () => void;
  status: string;
}) {
  return (
    <div className="lab__controls">
      <button type="button" className="lab__run" onClick={onRun} disabled={running}>
        <span className="lab__run-label">{label}</span>
        <span className={`lab__run-track${running ? " is-running" : ""}`} aria-hidden="true">
          <span
            className="lab__run-fill"
            style={{ ["--run-ms" as string]: `${experiment.frameMs * frameCount}ms` }}
          />
        </span>
      </button>

      <button type="button" className="lab__reset" onClick={onReset} disabled={running || !dirty}>
        Reset
      </button>

      <p className="lab__status" aria-hidden="true">
        {status}
      </p>
    </div>
  );
}
