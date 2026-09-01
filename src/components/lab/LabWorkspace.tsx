"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import LabControls from "./LabControls";
import LabExperimentSelector from "./LabExperimentSelector";
import LabExperimentView from "./LabExperimentView";
import LabFlow from "./LabFlow";
import LabObservation from "./LabObservation";
import {
  DEFAULT_EXPERIMENT_ID,
  EXPERIMENTS,
  defaultVariantId,
  type Experiment,
  type ExperimentId,
} from "./lab-experiments";

/**
 * The Engineering Lab workspace.
 *
 * The only client component in this section. It holds three things: which
 * experiment is selected, which deterministic variant of it, and how far the
 * frame sequence has advanced.
 *
 * Running an experiment walks its precomputed frames on one interval. There is
 * no randomness and no generated timing, so the same click always produces the
 * same sequence. The interval is torn down whenever the experiment changes,
 * the variant changes, the sequence restarts, Reset is pressed or the
 * component unmounts — a stale experiment can never receive a late frame.
 */

/* Reduced motion walks the same frames in short discrete steps rather than
   removing them: the states still have to be visible, just not animated. */
const FRAME_MS_REDUCED = 60;

type Phase = "idle" | "running" | "done";

type State = {
  experimentId: ExperimentId;
  variantId: string;
  phase: Phase;
  /** -1 before a run, otherwise an index into the variant's frames. */
  frameIndex: number;
};

type Action =
  | { type: "SELECT_EXPERIMENT"; id: ExperimentId; variantId: string }
  | { type: "SELECT_VARIANT"; id: string }
  | { type: "RUN" }
  | { type: "TICK"; total: number }
  | { type: "RESET" };

const byId = (id: ExperimentId) => EXPERIMENTS.find((e) => e.id === id) ?? EXPERIMENTS[0];

const initialState: State = {
  experimentId: DEFAULT_EXPERIMENT_ID,
  variantId: defaultVariantId(byId(DEFAULT_EXPERIMENT_ID)),
  phase: "idle",
  frameIndex: -1,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    /* Switching experiment abandons whatever was running and starts the new
       one from its own initial state. Nothing carries across. */
    case "SELECT_EXPERIMENT":
      if (action.id === state.experimentId) return state;
      return { experimentId: action.id, variantId: action.variantId, phase: "idle", frameIndex: -1 };

    case "SELECT_VARIANT":
      if (action.id === state.variantId) return state;
      return { ...state, variantId: action.id, phase: "idle", frameIndex: -1 };

    case "RUN":
      if (state.phase === "running") return state;
      return { ...state, phase: "running", frameIndex: 0 };

    case "TICK": {
      // Defensive: a queued tick must never advance a finished sequence.
      if (state.phase !== "running") return state;
      const next = state.frameIndex + 1;
      if (next >= action.total) return { ...state, phase: "done", frameIndex: action.total - 1 };
      return { ...state, frameIndex: next };
    }

    case "RESET":
      return { ...state, phase: "idle", frameIndex: -1 };

    default:
      return state;
  }
}

export default function LabWorkspace() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [reducedMotion, setReducedMotion] = useState(false);

  const experiment: Experiment = useMemo(() => byId(state.experimentId), [state.experimentId]);
  const frames = experiment.frames[state.variantId] ?? experiment.frames[defaultVariantId(experiment)];
  const frame = state.frameIndex >= 0 ? frames[state.frameIndex] : null;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* The sequence. Keyed on the experiment and variant as well as the phase, so
     switching either tears the interval down instead of letting it finish
     against data that is no longer on screen. */
  useEffect(() => {
    if (state.phase !== "running") return;
    const total = frames.length;
    const id = window.setInterval(
      () => dispatch({ type: "TICK", total }),
      reducedMotion ? FRAME_MS_REDUCED : experiment.frameMs
    );
    return () => window.clearInterval(id);
  }, [state.phase, state.experimentId, state.variantId, frames.length, experiment.frameMs, reducedMotion]);

  const selectExperiment = useCallback((id: ExperimentId) => {
    dispatch({ type: "SELECT_EXPERIMENT", id, variantId: defaultVariantId(byId(id)) });
  }, []);
  const selectVariant = useCallback((id: string) => dispatch({ type: "SELECT_VARIANT", id }), []);
  const run = useCallback(() => dispatch({ type: "RUN" }), []);
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  const running = state.phase === "running";
  const complete = state.phase === "done";
  const idle = state.phase === "idle";

  const label = running
    ? experiment.action.running
    : complete
      ? experiment.action.done
      : experiment.action.run;

  const status = frame
    ? `${experiment.flow[Math.max(0, frame.stage)]?.label ?? "Complete"} — ${frame.state.toLowerCase()}`
    : "Idle — every experiment runs entirely in the browser.";

  return (
    <>
    <div className="lab__workspace surface-milk">
      <header className="lab__head">
        <div className="lab__identity">
          <span className="lab__title">ENGINEERING LAB</span>
          <span className="lab__subtitle">LOCAL / DETERMINISTIC EXPERIMENT</span>
        </div>
        <span className="lab__ident">LAB / {experiment.index}</span>
      </header>

      <div className="lab__selector-row">
        <LabExperimentSelector
          experiments={EXPERIMENTS}
          activeId={experiment.id}
          onSelect={selectExperiment}
        />
      </div>

      <div
        className={`lab__body lab__body--${experiment.tone}`}
        id="lab-panel"
        role="tabpanel"
        aria-labelledby={`lexp-tab-${experiment.id}`}
        tabIndex={0}
      >
        <section className="lpanel lpanel--input" aria-labelledby="lab-input-title">
          <header className="lpanel__head">
            <h3 className="lpanel__title" id="lab-input-title">
              {experiment.inputTitle}
            </h3>
            <span className="lpanel__badge">{experiment.annotations[0] ?? "INPUT"}</span>
          </header>

          <dl className="linput">
            {experiment.inputs.map((row) => (
              <div key={row.label} className="linput__row">
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>

          {experiment.inputBody && <pre className="linput__body">{experiment.inputBody}</pre>}

          {experiment.variants.length > 0 && (
            <div className="lvariants" role="group" aria-label="Request variant">
              {experiment.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  className={`lvariant${variant.id === state.variantId ? " is-active" : ""}`}
                  aria-pressed={variant.id === state.variantId}
                  onClick={() => selectVariant(variant.id)}
                  disabled={running}
                >
                  {variant.label}
                </button>
              ))}
            </div>
          )}
        </section>

        <div className="lab__centre">
          <LabFlow
            stages={experiment.flow}
            active={frame ? frame.stage : -1}
            failed={frame?.failed}
            running={running}
          />
          <LabExperimentView view={frame ? frame.view : experiment.initial} />
        </div>

        <LabObservation experiment={experiment} frame={frame} idle={idle} />
      </div>

      <footer className="lab__foot">
        <LabControls
          experiment={experiment}
          frameCount={frames.length}
          label={label}
          running={running}
          dirty={!idle}
          onRun={run}
          onReset={reset}
          status={status}
        />

        {/* Announced once, on completion. Never on every simulated stage. */}
        <p className="visually-hidden" aria-live="polite">
          {complete && frame ? `Experiment complete: ${frame.event}.` : ""}
        </p>
      </footer>
    </div>

    {/* Sits below the workspace, above the pattern rail: what the experiment
        is actually demonstrating, in two or three sentences. */}
    <article className="lab__explanation">
      <div className="lab__explanation-head">
        <span className="lab__explanation-title">What this demonstrates</span>
        <span className="lab__explanation-tag">{experiment.tag}</span>
      </div>
      <p className="lab__explanation-body">{experiment.explanation}</p>
    </article>
    </>
  );
}
