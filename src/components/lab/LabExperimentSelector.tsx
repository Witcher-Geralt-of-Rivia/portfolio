"use client";

import { useRef } from "react";

import type { Experiment, ExperimentId } from "./lab-experiments";

/**
 * The five experiments, as a real ARIA tablist styled like an instrument
 * index: a mono number beside each name.
 *
 * Same rule as every selector in this project — full tab semantics (roving
 * tabindex, arrow keys, Home, End) or plain buttons. This component owns no
 * state; the selection lives in the workspace above it.
 */
export default function LabExperimentSelector({
  experiments,
  activeId,
  onSelect,
}: {
  experiments: Experiment[];
  activeId: ExperimentId;
  onSelect: (id: ExperimentId) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (index: number) => {
    const next = (index + experiments.length) % experiments.length;
    onSelect(experiments[next].id);
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
        move(experiments.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="lexps" role="tablist" aria-label="Engineering experiment">
      {experiments.map((experiment, index) => {
        const selected = experiment.id === activeId;
        return (
          <button
            key={experiment.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`lexp-tab-${experiment.id}`}
            aria-selected={selected}
            aria-controls="lab-panel"
            tabIndex={selected ? 0 : -1}
            className={`lexp${selected ? " is-active" : ""}`}
            onClick={() => onSelect(experiment.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className="lexp__index">{experiment.index}</span>
            <span className="lexp__label">{experiment.label}</span>
          </button>
        );
      })}
    </div>
  );
}
