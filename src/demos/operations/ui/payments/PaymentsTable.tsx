"use client";

/**
 * Operations demo: the Payments table.
 *
 * The table the earlier modules established, in the same CSS grammar: a row
 * header that is a real button, sortable columns carrying `aria-sort`, and a
 * caption that says how the list is ordered.
 *
 * Six columns, ending on Due and Status, because those two together are the
 * whole question a payments list answers: when was it owed, and is it settled.
 * The status shown is the derived one. A column printing `payment.status` would
 * report a payment three weeks late as Pending, which is true of the record and
 * false of the world.
 *
 * Money is right-aligned and tabular in CSS, which is the whole reason a person
 * can compare two figures without reading them.
 */

import type { SortDirection } from "@/demo-runtime/types";

import { absoluteDate } from "../../selectors/leads-list";
import type { PaymentRow, PaymentSortKey } from "../../selectors/payments-list";
import { STATUS_TONE, formatCents } from "./payments-view";

type Props = {
  rows: PaymentRow[] | null;
  selectedId: string | null;
  sort: PaymentSortKey;
  direction: SortDirection;
  onSort: (sort: PaymentSortKey, direction: SortDirection) => void;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending",
};

const SORT_LABEL: Record<PaymentSortKey, string> = {
  due: "due date",
  amount: "amount",
  customer: "customer name",
  status: "status",
};

/** The sortable columns, and the key each one sorts by. */
const COLUMN_SORT: Record<string, PaymentSortKey | undefined> = {
  Customer: "customer",
  Contract: undefined,
  Amount: "amount",
  Category: undefined,
  Due: "due",
  Status: "status",
};

const COLUMNS = ["Customer", "Contract", "Amount", "Category", "Due", "Status"];

export default function PaymentsTable({
  rows,
  selectedId,
  sort,
  direction,
  onSort,
  onSelect,
}: Props) {
  if (!rows) {
    return (
      <div className="ops-leads__table-wrap" aria-busy="true">
        <div className="ops-skeleton ops-skeleton--table" />
        <p className="visually-hidden" role="status">
          Loading payments
        </p>
      </div>
    );
  }

  return (
    <div className="ops-leads__table-wrap">
      <table className="ops-table ops-leads__table">
        <caption className="visually-hidden">
          Payments, sorted by {SORT_LABEL[sort]}{" "}
          {direction === "asc" ? "ascending" : "descending"}
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const key = COLUMN_SORT[column];
              const active = key !== undefined && key === sort;
              return (
                <th
                  key={column}
                  scope="col"
                  aria-sort={key === undefined ? undefined : active ? ARIA_SORT[direction] : "none"}
                >
                  {key === undefined ? (
                    column
                  ) : (
                    <button
                      type="button"
                      className={`ops-th-sort${active ? " ops-th-sort--active" : ""}`}
                      onClick={() => onSort(key, active && direction === "asc" ? "desc" : "asc")}
                    >
                      {column}
                      <span className="ops-th-sort__mark" aria-hidden="true">
                        {active ? (direction === "asc" ? "▴" : "▾") : "⁚"}
                      </span>
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={`ops-leads__row${row.id === selectedId ? " ops-leads__row--selected" : ""}`}
            >
              {/* A row header, and a real button inside it: a row that only
                  answers a mouse is unreachable by keyboard. */}
              <th scope="row" className="ops-leads__name-cell">
                <button
                  type="button"
                  className="ops-leads__name"
                  aria-current={row.id === selectedId ? "true" : undefined}
                  onClick={(e) => onSelect(row.id, e.currentTarget)}
                >
                  {row.customerName}
                </button>
              </th>

              {/* The contract id in mono, unresolved on purpose: a payment is
                  filed against an agreement, and the id is the handle a person
                  carries between this list and that one. */}
              <td className="ops-payments__contract">{row.contractId}</td>

              <td className="ops-payments__money">USD {formatCents(row.amount)}</td>

              <td className="ops-payments__category">{row.category}</td>

              <td className="ops-leads__date">
                <time dateTime={absoluteDate(row.dueAt)}>{absoluteDate(row.dueAt)}</time>
              </td>

              <td>
                {/* The derived status, and the word is inside the pill: the
                    tone is a second reading of it, never the only one. */}
                <span className={`ops-pill ops-pill--${STATUS_TONE[row.effectiveStatus]}`}>
                  {row.effectiveStatus}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
