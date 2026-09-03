"use client";

/**
 * Operations demo: Maintenance on a phone.
 *
 * The card pattern the CRM established, carrying what a person needs to choose
 * between two jobs: which machine, where the job sits, the line someone wrote
 * about it, what kind of work it is and how it ranks.
 *
 * The summary is on the card rather than in the drawer alone, because on a
 * phone the drawer is a full-screen trip and the summary is the reason to take
 * it. It truncates to a single line so a long note cannot push the priority
 * chip off the bottom of a card someone is scanning.
 */

import type { MaintenanceRow } from "../../selectors/maintenance-list";
import { PRIORITY_TONE, STATUS_TONE } from "./maintenance-view";

type Props = {
  rows: MaintenanceRow[] | null;
  selectedId: string | null;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

export default function MaintenanceMobileList({ rows, selectedId, onSelect }: Props) {
  if (!rows) {
    return (
      <div className="ops-leads__cards" aria-busy="true">
        <div className="ops-skeleton ops-skeleton--cards" />
      </div>
    );
  }

  return (
    <ul className="ops-leads__cards">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            className={`ops-leadcard${row.id === selectedId ? " ops-leadcard--selected" : ""}`}
            aria-current={row.id === selectedId ? "true" : undefined}
            onClick={(e) => onSelect(row.id, e.currentTarget)}
          >
            <span className="ops-leadcard__top">
              <span className="ops-leadcard__name">
                {row.vehicleLabel ?? "Unknown vehicle"}
              </span>
              <span className={`ops-pill ops-pill--${STATUS_TONE[row.status]}`}>
                {row.status}
              </span>
            </span>

            <span className="ops-leadcard__meta">
              <span className="ops-maintenance__card-summary">{row.summary}</span>
            </span>

            <span className="ops-leadcard__foot">
              <span className="ops-leadcard__owner">{row.type}</span>
              <span className={`ops-prio ops-prio--${PRIORITY_TONE[row.priority]}`}>
                <span className="ops-prio__dot" aria-hidden="true" />
                {row.priority}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
