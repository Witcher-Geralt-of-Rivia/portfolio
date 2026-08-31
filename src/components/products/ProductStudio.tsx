"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AiAssistSurface from "./AiAssistSurface";
import MobileProductSurface from "./MobileProductSurface";
import ProductEventFlow from "./ProductEventFlow";
import ProductScenarioSelector from "./ProductScenarioSelector";
import WebProductSurface from "./WebProductSurface";
import {
  DEFAULT_SCENARIO_ID,
  PRODUCT_SCENARIOS,
  type ScenarioId,
} from "./product-scenarios";

/**
 * The Product Engineering Studio.
 *
 * The only client component in this section. It holds two pieces of state: the
 * selected scenario, and the position of the deterministic product flow.
 *
 * The flow is a local state machine stepping through the scenario's seven
 * stages. It performs no network request of any kind — no API, no backend, no
 * AI provider. The interval is cleared whenever the scenario changes, the flow
 * restarts, or the component unmounts, so a stale scenario can never receive a
 * late state update.
 */

type FlowState = "idle" | "running" | "complete";

const STEP_MS = 300;
const STEP_MS_REDUCED = 80;

export default function ProductStudio() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>(DEFAULT_SCENARIO_ID);
  const [flowState, setFlowState] = useState<FlowState>("idle");
  const [stepIndex, setStepIndex] = useState(-1);
  const [reducedMotion, setReducedMotion] = useState(false);
  const liveRef = useRef<HTMLParagraphElement>(null);

  const scenario = useMemo(
    () => PRODUCT_SCENARIOS.find((s) => s.id === scenarioId) ?? PRODUCT_SCENARIOS[0],
    [scenarioId]
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* Switching scenario abandons any run in progress. */
  const selectScenario = useCallback((id: ScenarioId) => {
    setScenarioId(id);
    setFlowState("idle");
    setStepIndex(-1);
  }, []);

  const runFlow = useCallback(() => {
    setStepIndex(0);
    setFlowState("running");
  }, []);

  /* The flow itself. Keyed on scenarioId as well as flowState so a scenario
     change tears the interval down rather than letting it finish against the
     wrong scenario. */
  useEffect(() => {
    if (flowState !== "running") return;

    const steps = scenario.flow;
    let i = 0;

    const id = window.setInterval(() => {
      i += 1;
      if (i >= steps.length) {
        window.clearInterval(id);
        setStepIndex(steps.length - 1);
        setFlowState("complete");
        return;
      }
      setStepIndex(i);
    }, reducedMotion ? STEP_MS_REDUCED : STEP_MS);

    return () => window.clearInterval(id);
  }, [flowState, scenarioId, scenario.flow, reducedMotion]);

  const step = stepIndex >= 0 ? scenario.flow[stepIndex] : null;
  const running = flowState === "running";
  const complete = flowState === "complete";

  const buttonLabel = running ? "Running…" : complete ? "Run again" : "Run product flow";

  return (
    <div className="pstudio surface-milk">
      <header className="pstudio__head">
        <div className="pstudio__identity">
          <span className="pstudio__title">PRODUCT ENGINEERING STUDIO</span>
          <span className="pstudio__subtitle">Cross-surface product simulation</span>
        </div>
        <ProductScenarioSelector
          scenarios={PRODUCT_SCENARIOS}
          activeId={scenario.id}
          onSelect={selectScenario}
        />
      </header>

      <div
        className="pstudio__body"
        id="pstudio-panel"
        role="tabpanel"
        aria-labelledby={`pscenario-tab-${scenario.id}`}
        tabIndex={0}
      >
        <p className="visually-hidden">{scenario.accessibleDescription}</p>

        <div className="pstudio__surfaces">
          <WebProductSurface scenario={scenario} active={step?.surface === "web"} />
          <div className="pstudio__aside">
            <MobileProductSurface
              scenario={scenario}
              active={step?.surface === "mobile"}
              syncStep={complete ? 1 : 0}
            />
            <AiAssistSurface
              scenario={scenario}
              active={step?.surface === "assistant"}
              resolved={complete}
            />
          </div>
        </div>

        <ProductEventFlow activeRail={step?.rail ?? null} running={running} complete={complete} />
      </div>

      <footer className="pstudio__foot">
        <button type="button" className="pstudio__run" onClick={runFlow} disabled={running}>
          <span className="pstudio__run-label">{buttonLabel}</span>
          <span className={`pstudio__run-track${running ? " is-running" : ""}`} aria-hidden="true">
            <span className="pstudio__run-fill" />
          </span>
        </button>

        <p className="pstudio__stage" aria-hidden="true">
          {step ? step.label : "Idle — no request is made when the flow runs."}
        </p>

        {/* Announced once, on completion. Never on every animation step. */}
        <p ref={liveRef} className="visually-hidden" aria-live="polite">
          {complete ? "Product flow complete." : ""}
        </p>
      </footer>
    </div>
  );
}
