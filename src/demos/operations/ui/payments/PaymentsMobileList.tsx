"use client";

/**
 * Operations demo: Payments on a phone.
 *
 * The card pattern the earlier modules established, carrying exactly what a
 * person needs to choose between two rows: who owes it, whether it is settled,
 * which agreement it belongs to, how much it is, what kind of payment it is and
 * when it fell due.
 *
 * The amount and the status both earn their place because together they are the
 * decision. Everything else about a payment is reference, and reference belongs
 * in the drawer.
 */

import { absoluteDate } from "../../selectors/leads-list";
import type { PaymentRow } from "../../selectors/payments-list";
import { STATUS_TONE, formatCents } from "./payments-view";

type Props = {
  rows: PaymentRow[] | null;
  selectedId: string | null;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

export default function PaymentsMobileList({ rows, selectedId, onSelect }: Props) {
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
              <span className={`ops-pill ops-pill--${STATUS_TONE[row.effectiveStatus]}`}>
                {row.effectiveStatus}
              </span>
            </span>

            <span className="ops-leadcard__meta">
              <span className="ops-payments__contract">{row.contractId}</span>
              <span className="ops-payments__card-money">USD {formatCents(row.amount)}</span>
            </span>

            <span className="ops-leadcard__foot">
              <span className="ops-leadcard__owner">{row.category}</span>
              {/* "Due" said in words rather than left as a bare date, because a
                  card carries two dates in the domain and only one here. */}
              <span className="ops-leadcard__follow">Due {absoluteDate(row.dueAt)}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
