"use client";

/**
 * Operations demo: the Reservations table.
 *
 * The Leads and Customers table, in the same CSS grammar: a row header that is
 * a real button, sortable columns carrying `aria-sort`, and a caption that
 * says how the list is ordered.
 *
 * Six columns, chosen for the questions a rental desk actually asks: who, when,
 * what class, which vehicle, where in the lifecycle, and how recently it moved.
 * Every one of them is something a person scans to decide which row to open.
 */

import type { SortDirection } from "@/demo-runtime/types";

import { absoluteDate } from "../../selectors/leads-list";
import type { ReservationRow, ReservationSortKey } from "../../selectors/reservations-list";
import { STATUS_TONE } from "./reservations-view";

type Props = {
  rows: ReservationRow[] | null;
  selectedId: string | null;
  sort: ReservationSortKey;
  direction: SortDirection;
  onSort: (sort: ReservationSortKey, direction: SortDirection) => void;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending",
};

const SORT_LABEL: Record<ReservationSortKey, string> = {
  start: "start date",
  updated: "last updated",
  customer: "customer name",
  status: "status",
};

/** The sortable columns, and the key each one sorts by. */
const COLUMN_SORT: Record<string, ReservationSortKey | undefined> = {
  Customer: "customer",
  "Rental period": "start",
  Class: undefined,
  Vehicle: undefined,
  Status: "status",
  Updated: "updated",
};

const COLUMNS = ["Customer", "Rental period", "Class", "Vehicle", "Status", "Updated"];

export default function ReservationsTable({
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
          Loading reservations
        </p>
      </div>
    );
  }

  return (
    <div className="ops-leads__table-wrap">
      <table className="ops-table ops-leads__table ops-reservations__table">
        <caption className="visually-hidden">
          Reservations, sorted by {SORT_LABEL[sort]}{" "}
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

              <td className="ops-reservations__period">
                <time dateTime={absoluteDate(row.startAt)}>{absoluteDate(row.startAt)}</time>
                <span className="ops-reservations__to" aria-hidden="true">
                  to
                </span>
                <time dateTime={absoluteDate(row.endAt)}>{absoluteDate(row.endAt)}</time>
              </td>

              <td className="ops-reservations__class">{row.vehicleClass}</td>

              <td className="ops-reservations__vehicle">
                {row.vehicleLabel ?? (
                  <span className="ops-leads__unassigned">Not assigned</span>
                )}
              </td>

              <td>
                <span className={`ops-pill ops-pill--${STATUS_TONE[row.status]}`}>
                  {row.status}
                </span>
              </td>

              <td className="ops-leads__date">
                <time dateTime={absoluteDate(row.updatedAt)}>{absoluteDate(row.updatedAt)}</time>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
