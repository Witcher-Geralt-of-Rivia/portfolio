"use client";

/**
 * Operations demo: Reservations on a phone.
 *
 * The card pattern Leads and Customers established, carrying exactly what a
 * person needs to choose between two rows: who it is for, when it runs, which
 * class, which vehicle if one is assigned, and where it sits in the lifecycle.
 *
 * Not the whole detail. A card that repeats the drawer is a card nobody taps.
 */

import { absoluteDate } from "../../selectors/leads-list";
import type { ReservationRow } from "../../selectors/reservations-list";
import { STATUS_TONE } from "./reservations-view";

type Props = {
  rows: ReservationRow[] | null;
  selectedId: string | null;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

export default function ReservationsMobileList({ rows, selectedId, onSelect }: Props) {
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
              <span className="ops-leadcard__name">{row.customerName}</span>
              <span className={`ops-pill ops-pill--${STATUS_TONE[row.status]}`}>
                {row.status}
              </span>
            </span>

            <span className="ops-leadcard__meta">
              <span className="ops-reservations__card-period">
                {absoluteDate(row.startAt)} to {absoluteDate(row.endAt)}
              </span>
            </span>

            <span className="ops-leadcard__foot">
              <span className="ops-leadcard__owner">{row.vehicleClass}</span>
              <span className="ops-leadcard__follow">
                {row.vehicleLabel ?? "Not assigned"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
