"use client";

import { useRef } from "react";

import type { ProductScenario, ScenarioId } from "./product-scenarios";

/**
 * Scenario selector, implemented as a real ARIA tablist with roving tabindex
 * and arrow-key movement. Same rule as the Stage 05 mode selector: full tab
 * semantics or plain buttons, never a half-implemented tablist.
 */
export default function ProductScenarioSelector({
  scenarios,
  activeId,
  onSelect,
}: {
  scenarios: ProductScenario[];
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
    <div className="pscenarios" role="tablist" aria-label="Product scenario">
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
            id={`pscenario-tab-${scenario.id}`}
            aria-selected={selected}
            aria-controls="pstudio-panel"
            tabIndex={selected ? 0 : -1}
            className={`pscenario${selected ? " is-active" : ""}`}
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
