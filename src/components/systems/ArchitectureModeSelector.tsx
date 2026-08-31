"use client";

import { useRef } from "react";

import type { ArchitectureMode } from "./architecture-data";

/**
 * The four architecture modes, as a real ARIA tablist.
 *
 * Full tab semantics are implemented rather than approximated: roving
 * tabindex, arrow-key movement, Home and End. If that behaviour were not
 * present these would be plain buttons instead — an incomplete tablist is
 * worse than none.
 */
export default function ArchitectureModeSelector({
  modes,
  activeId,
  onSelect,
}: {
  modes: ArchitectureMode[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (index: number) => {
    const next = (index + modes.length) % modes.length;
    onSelect(modes[next].id);
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
        move(modes.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="arch-modes" role="tablist" aria-label="Architecture mode">
      {modes.map((mode, index) => {
        const selected = mode.id === activeId;
        return (
          <button
            key={mode.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`arch-tab-${mode.id}`}
            aria-selected={selected}
            aria-controls="arch-panel"
            tabIndex={selected ? 0 : -1}
            className={`arch-mode${selected ? " is-active" : ""}`}
            onClick={() => onSelect(mode.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
