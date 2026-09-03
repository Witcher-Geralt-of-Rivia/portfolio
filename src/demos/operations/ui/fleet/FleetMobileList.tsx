"use client";

/**
 * Operations demo: the fleet on a phone.
 *
 * The card pattern Leads and Reservations established, carrying what a person
 * needs to choose between two machines: which one it is, whether it is free,
 * what it is, how far it has run and who has it.
 *
 * The asset code leads, as it does in the table, so a visitor moving between
 * the two widths is looking for the same thing in the same place.
 */

import { formatOdometer, type FleetRow } from "../../selectors/fleet-list";
import { STATUS_TONE } from "./fleet-view";

type Props = {
  rows: FleetRow[] | null;
  selectedId: string | null;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

export default function FleetMobileList({ rows, selectedId, onSelect }: Props) {
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
              <span className="ops-leadcard__name ops-vehicles__card-meta">
                {row.assetCode}
              </span>
              <span className={`ops-pill ops-pill--${STATUS_TONE[row.status]}`}>
                {row.status}
              </span>
            </span>

            <span className="ops-leadcard__meta">
              <span>{row.modelLabel}</span>
              <span>{row.vehicleClass}</span>
            </span>

            <span className="ops-leadcard__foot">
              <span className="ops-leadcard__owner ops-vehicles__card-meta">
                {formatOdometer(row.odometerKm)}
              </span>
              <span className="ops-leadcard__follow">{row.assignment ?? "Free"}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
