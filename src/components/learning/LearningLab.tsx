"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import KnowledgeMap from "./KnowledgeMap";
import LearnerStatePanel from "./LearnerStatePanel";
import LearningJourney from "./LearningJourney";
import LearningScenarioSelector from "./LearningScenarioSelector";
import TutorPanel from "./TutorPanel";
import {
  ADAPT_STAGES,
  DEFAULT_SCENARIO_ID,
  LEARNING_SCENARIOS,
  NODE_STATES,
  type ScenarioId,
} from "./learning-scenarios";

/**
 * The Adaptive Learning Laboratory.
 *
 * The only client component in this section. It holds three things: the
 * selected scenario, which of that scenario's two deterministic variants is
 * showing, and the position of the adapt sequence.
 *
 * `Adapt` walks a five-stage local state machine and then swaps the variant.
 * It performs no request of any kind — no API, no backend, no model. Both
 * timers are torn down whenever the scenario changes, the sequence restarts or
 * the component unmounts, so a stale scenario can never receive a late update.
 */

/* 5 stages x 340ms = 1.70s end to end, inside the 1.5-2.0s the design calls
   for. Under reduced motion the same states are walked in short discrete
   steps instead, so the content still changes without the movement. */
const STAGE_MS = 340;
const STAGE_MS_REDUCED = 80;
const SETTLE_MS = 1400;
const SETTLE_MS_REDUCED = 420;

type Phase = "idle" | "running" | "done" | "settled";

type State = {
  scenarioId: ScenarioId;
  variantIndex: 0 | 1;
  phase: Phase;
  /** -1 while idle, otherwise an index into ADAPT_STAGES. */
  stageIndex: number;
};

type Action =
  | { type: "SELECT"; id: ScenarioId }
  | { type: "RUN" }
  | { type: "TICK" }
  | { type: "SETTLE" };

const initialState: State = {
  scenarioId: DEFAULT_SCENARIO_ID,
  variantIndex: 0,
  phase: "idle",
  stageIndex: -1,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    /* Changing scenario abandons any sequence in progress and returns that
       scenario to its first variant. Nothing carries across. */
    case "SELECT":
      if (action.id === state.scenarioId) return state;
      return { scenarioId: action.id, variantIndex: 0, phase: "idle", stageIndex: -1 };

    case "RUN":
      if (state.phase === "running") return state;
      return { ...state, phase: "running", stageIndex: 0 };

    case "TICK": {
      // Defensive: a queued tick must never advance a finished sequence.
      if (state.phase !== "running") return state;
      const next = state.stageIndex + 1;
      if (next >= ADAPT_STAGES.length) {
        return {
          ...state,
          phase: "done",
          stageIndex: ADAPT_STAGES.length - 1,
          variantIndex: state.variantIndex === 0 ? 1 : 0,
        };
      }
      return { ...state, stageIndex: next };
    }

    case "SETTLE":
      if (state.phase !== "done") return state;
      return { ...state, phase: "settled" };

    default:
      return state;
  }
}

export default function LearningLab() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [reducedMotion, setReducedMotion] = useState(false);

  const scenario = useMemo(
    () => LEARNING_SCENARIOS.find((s) => s.id === state.scenarioId) ?? LEARNING_SCENARIOS[0],
    [state.scenarioId]
  );
  const variant = scenario.variants[state.variantIndex];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* The sequence. Keyed on the scenario as well as the phase, so switching
     scenario tears the interval down rather than letting it finish against
     data that is no longer on screen. */
  useEffect(() => {
    if (state.phase !== "running") return;
    const id = window.setInterval(
      () => dispatch({ type: "TICK" }),
      reducedMotion ? STAGE_MS_REDUCED : STAGE_MS
    );
    return () => window.clearInterval(id);
  }, [state.phase, state.scenarioId, reducedMotion]);

  /* "Path updated" holds briefly, then the control returns to "Adapt again".
     Torn down on the same three exits as the interval above. */
  useEffect(() => {
    if (state.phase !== "done") return;
    const id = window.setTimeout(
      () => dispatch({ type: "SETTLE" }),
      reducedMotion ? SETTLE_MS_REDUCED : SETTLE_MS
    );
    return () => window.clearTimeout(id);
  }, [state.phase, state.scenarioId, reducedMotion]);

  const selectScenario = useCallback((id: ScenarioId) => dispatch({ type: "SELECT", id }), []);
  const runAdapt = useCallback(() => dispatch({ type: "RUN" }), []);

  const running = state.phase === "running";
  const complete = state.phase === "done" || state.phase === "settled";

  let label = scenario.action.idle;
  if (state.phase === "running") label = scenario.action.running;
  else if (state.phase === "done") label = scenario.action.done;
  else if (state.phase === "settled") label = scenario.action.again;

  const stage = state.stageIndex >= 0 ? ADAPT_STAGES[state.stageIndex] : null;

  return (
    <div className="llab surface-milk">
      <header className="llab__head">
        <div className="llab__identity">
          <span className="llab__title">ADAPTIVE LEARNING LABORATORY</span>
          <span className="llab__subtitle">LOCAL / DETERMINISTIC SIMULATION</span>
        </div>
        <LearningScenarioSelector
          scenarios={LEARNING_SCENARIOS}
          activeId={scenario.id}
          onSelect={selectScenario}
        />
      </header>

      <div
        className="llab__body"
        id="llab-panel"
        role="tabpanel"
        aria-labelledby={`lscenario-tab-${scenario.id}`}
        tabIndex={0}
      >
        {/* One sentence in place of eighteen unlabelled circles. */}
        <p className="visually-hidden">{variant.summary}</p>

        <div className="llab__surfaces">
          <LearnerStatePanel scenario={scenario} variant={variant} />

          <div className="llab__centre">
            <div className="llab__map-head">
              <span className="llab__map-title">{scenario.mapTitle}</span>
              <ul className="llegend">
                {NODE_STATES.map((s) => (
                  <li key={s.id} className={`llegend__item llegend__item--${s.id}`}>
                    <span className="llegend__mark" aria-hidden="true" />
                    <span className="llegend__text">{s.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <KnowledgeMap scenario={scenario} variant={variant} adapting={running} />

            {scenario.artifact && (
              <div className="lartifact">
                <span className="lartifact__title">{scenario.artifact.title}</span>
                <p className="lartifact__body">{scenario.artifact.body}</p>
                <span className="lartifact__tag">{scenario.artifact.tag}</span>
              </div>
            )}
          </div>

          <TutorPanel scenario={scenario} variant={variant} adapting={running} />
        </div>

        <LearningJourney steps={scenario.journey} current={variant.current} adapting={running} />
      </div>

      <footer className="llab__foot">
        <button type="button" className="llab__run" onClick={runAdapt} disabled={running}>
          <span className="llab__run-label">{label}</span>
          <span className={`llab__run-track${running ? " is-running" : ""}`} aria-hidden="true">
            <span className="llab__run-fill" />
          </span>
        </button>

        <p className="llab__stage" aria-hidden="true">
          {stage ? stage.label : "Idle — adapting runs entirely in the browser."}
        </p>

        {/* Announced once, on completion. Never on every intermediate stage. */}
        <p className="visually-hidden" aria-live="polite">
          {complete ? "Learning path updated." : ""}
        </p>
      </footer>
    </div>
  );
}
