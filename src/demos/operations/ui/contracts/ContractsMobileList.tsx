"use client";

/**
 * Operations demo: Contracts on a phone.
 *
 * The card pattern Leads and Customers established, carrying exactly what a
 * person needs to choose between two rows: who the hire is for, where it sits
 * in the lifecycle, when it runs, which vehicle is out, and what is still owed.
 *
 * The balance earns its place on a card because it is the one figure that
 * decides whether a row needs attention at all. The daily rate and the total do
 * not: they are reference, and reference belongs in the drawer.
 */

import type { ContractRow } from "../../selectors/contracts-list";
import { absoluteDate } from "../../selectors/leads-list";
import { STATUS_TONE, formatCents } from "./contracts-view";

type Props = {
  rows: ContractRow[] | null;
  selectedId: string | null;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

export default function ContractsMobileList({ rows, selectedId, onSelect }: Props) {
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
              <span className="ops-contracts__card-period">
                {absoluteDate(row.startAt)} to {absoluteDate(row.endAt)}
              </span>
            </span>

            <span className="ops-leadcard__foot">
              <span className="ops-leadcard__owner">{row.vehicleLabel ?? "Not resolved"}</span>
              {/* A settled contract says so in a word rather than showing a
                  zero, which reads as a figure someone still has to check. */}
              <span className="ops-leadcard__follow ops-contracts__card-money">
                {row.remainingBalance === 0
                  ? "Settled"
                  : `USD ${formatCents(row.remainingBalance)} due`}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
