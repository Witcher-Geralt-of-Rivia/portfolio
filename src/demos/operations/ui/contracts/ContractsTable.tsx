"use client";

/**
 * Operations demo: the Contracts table.
 *
 * The table the earlier modules established, in the same CSS grammar: a row
 * header that is a real button, sortable columns carrying `aria-sort`, and a
 * caption that says how the list is ordered.
 *
 * Six columns, and the tail is where this list differs from Reservations. That
 * one ends on Status and Updated, because a booking is read for where it sits
 * and when it last moved. A contract is read for what is still owed and whether
 * it is running, so Balance and Status take the last two columns and Updated
 * drops to a sort choice. A column nobody scans is a column that only costs
 * width.
 *
 * Money is right-aligned and tabular in CSS, which is the whole reason a person
 * can compare two figures without reading them.
 */

import type { SortDirection } from "@/demo-runtime/types";

import type { ContractRow, ContractSortKey } from "../../selectors/contracts-list";
import { absoluteDate } from "../../selectors/leads-list";
import { STATUS_TONE, formatCents } from "./contracts-view";

type Props = {
  rows: ContractRow[] | null;
  selectedId: string | null;
  sort: ContractSortKey;
  direction: SortDirection;
  onSort: (sort: ContractSortKey, direction: SortDirection) => void;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending",
};

const SORT_LABEL: Record<ContractSortKey, string> = {
  start: "start date",
  updated: "last updated",
  customer: "customer name",
  status: "status",
  balance: "remaining balance",
};

/** The sortable columns, and the key each one sorts by. */
const COLUMN_SORT: Record<string, ContractSortKey | undefined> = {
  Customer: "customer",
  Vehicle: undefined,
  Period: "start",
  Total: undefined,
  Balance: "balance",
  Status: "status",
};

const COLUMNS = ["Customer", "Vehicle", "Period", "Total", "Balance", "Status"];

export default function ContractsTable({
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
          Loading contracts
        </p>
      </div>
    );
  }

  return (
    <div className="ops-leads__table-wrap">
      <table className="ops-table ops-leads__table">
        <caption className="visually-hidden">
          Contracts, sorted by {SORT_LABEL[sort]}{" "}
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

              <td className="ops-contracts__vehicle">
                {/* Every contract stores a vehicle id, so an unresolved label
                    means the record it points at is gone rather than that the
                    hire has no car. The wording says which. */}
                {row.vehicleLabel ?? <span className="ops-leads__unassigned">Not resolved</span>}
              </td>

              <td className="ops-contracts__period">
                <time dateTime={absoluteDate(row.startAt)}>{absoluteDate(row.startAt)}</time>
                <span className="ops-contracts__to" aria-hidden="true">
                  to
                </span>
                <time dateTime={absoluteDate(row.endAt)}>{absoluteDate(row.endAt)}</time>
              </td>

              <td className="ops-contracts__money">USD {formatCents(row.totalAmount)}</td>

              <td
                className={`ops-contracts__money ops-contracts__balance${
                  row.remainingBalance === 0 ? " ops-contracts__balance--settled" : ""
                }`}
              >
                USD {formatCents(row.remainingBalance)}
              </td>

              <td>
                <span className={`ops-pill ops-pill--${STATUS_TONE[row.status]}`}>
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
