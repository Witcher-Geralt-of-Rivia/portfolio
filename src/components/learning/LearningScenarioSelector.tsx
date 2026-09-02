"use client";

import { useRef } from "react";

import type { LearningScenario, ScenarioId } from "./learning-scenarios";

/**
 * The three learning scenarios, as a real ARIA tablist.
 *
 * Same rule as the Stage 05 and Stage 06 selectors: full tab semantics
 * (roving tabindex, arrow keys, Home and End) or plain buttons. A
 * half-implemented tablist is worse than none. This component owns no state;
 * the selection lives in the lab above it.
 */
export default function LearningScenarioSelector({
  scenarios,
  activeId,
  onSelect,
}: {
  scenarios: LearningScenario[];
  activeId: ScenarioId;
  onSelect: (id: ScenarioId) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (index: number) => {
    const next = (index + scenarios.length) % scenarios.length;
    onSelect(scenarios[next].id);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        move(index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        move(index - 1);
        break;
      case "Home":
        event.preventDefault();
        move(0);
        break;
      case "End":
        event.preventDefault();
        move(scenarios.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="lscenarios" role="tablist" aria-label="Learning scenario">
      {scenarios.map((scenario, index) => {
        const selected = scenario.id === activeId;
        return (
          <button
            key={scenario.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`lscenario-tab-${scenario.id}`}
            aria-selected={selected}
            aria-controls="llab-panel"
            tabIndex={selected ? 0 : -1}
            className={`lscenario${selected ? " is-active" : ""}`}
            onClick={() => onSelect(scenario.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {scenario.label}
          </button>
        );
      })}
    </div>
  );
}
