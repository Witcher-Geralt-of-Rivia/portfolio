"use client";

import { useCallback, useMemo, useState } from "react";

import ArchitectureCanvas from "./ArchitectureCanvas";
import ArchitectureModeSelector from "./ArchitectureModeSelector";
import ExecutionTrace from "./ExecutionTrace";
import { ARCHITECTURE_MODES, DEFAULT_MODE_ID } from "./architecture-data";

/**
 * The System Architecture Lab.
 *
 * The only client component in this section. It holds two pieces of state
 * (the selected mode and the node currently hovered or focused) and nothing
 * else. Every visual behaviour below it is CSS: packet motion, connection
 * highlighting, the mode transition and the trace stagger.
 *
 * Nothing here reaches the network. Switching mode is a local state change
 * over static TypeScript data; no AI provider, API or backend is involved.
 */
export default function ArchitectureLab() {
  const [modeId, setModeId] = useState(DEFAULT_MODE_ID);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const mode = useMemo(
    () => ARCHITECTURE_MODES.find((m) => m.id === modeId) ?? ARCHITECTURE_MODES[0],
    [modeId]
  );

  const activeNode = activeNodeId
    ? mode.nodes.find((n) => n.id === activeNodeId) ?? null
    : null;

  const selectMode = useCallback((id: string) => {
    setModeId(id);
    setActiveNodeId(null);
  }, []);

  const handleEnter = useCallback((id: string) => setActiveNodeId(id), []);
  const handleLeave = useCallback(() => setActiveNodeId(null), []);

  return (
    <div className="arch-lab surface-milk">
      <header className="arch-lab__head">
        <div className="arch-lab__identity">
          <span className="arch-lab__title">SYSTEM ARCHITECTURE LAB</span>
          <span className="arch-lab__subtitle">
            Deterministic systems simulation
          </span>
        </div>

        <ArchitectureModeSelector
          modes={ARCHITECTURE_MODES}
          activeId={mode.id}
          onSelect={selectMode}
        />
      </header>

      <div
        className="arch-lab__body"
        id="arch-panel"
        role="tabpanel"
        aria-labelledby={`arch-tab-${mode.id}`}
        tabIndex={0}
      >
        {/* One summary of the current topology, so the diagram is described
            rather than exposing every connection to assistive technology. */}
        <p className="visually-hidden" aria-live="polite">
          {mode.description}
        </p>

        <ArchitectureCanvas
          mode={mode}
          activeNodeId={activeNodeId}
          onNodeEnter={handleEnter}
          onNodeLeave={handleLeave}
        />

        <ExecutionTrace rows={mode.trace} modeId={mode.id} />
      </div>

      {/* A fixed band rather than a pointer-following tooltip. */}
      <footer className="arch-lab__detail" id="arch-detail">
        {activeNode ? (
          <>
            <span className="arch-lab__detail-title">{activeNode.label}</span>
            <span className="arch-lab__detail-text">{activeNode.description}</span>
          </>
        ) : (
          <span className="arch-lab__detail-hint">
            Select a node to see what it is responsible for.
          </span>
        )}
      </footer>
    </div>
  );
}
