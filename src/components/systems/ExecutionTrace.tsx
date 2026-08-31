import type { CSSProperties } from "react";

import type { TraceRow } from "./architecture-data";

/**
 * A compact deterministic trace of the selected architecture.
 *
 * The timings are illustrative simulation state, not measured performance,
 * which is why the heading carries a LOCAL SIMULATION marker. Rows fade in on
 * a short stagger; there is no character-by-character typing.
 */
export default function ExecutionTrace({
  rows,
  modeId,
}: {
  rows: TraceRow[];
  modeId: string;
}) {
  return (
    <aside className="arch-trace" aria-label="Execution trace">
      <div className="arch-trace__head">
        <span className="arch-trace__title">EXECUTION TRACE</span>
        <span className="arch-trace__badge">LOCAL SIMULATION</span>
      </div>

      <ol className="arch-trace__list" key={modeId}>
        {rows.map((row, i) => (
          <li
            key={row.t}
            className="arch-trace__row"
            style={{ "--i": i } as CSSProperties}
          >
            <span className="arch-trace__dot" aria-hidden="true" />
            <span className="arch-trace__time">{row.t}</span>
            <span className="arch-trace__text">{row.text}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
