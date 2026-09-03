"use client";

/**
 * Operations demo: the Maintenance table.
 *
 * The shared table grammar: a row header that is a real button, sortable
 * columns carrying `aria-sort`, and a caption that says how the queue is
 * ordered.
 *
 * Six columns, chosen for the questions a coordinator asks while scanning:
 * which machine, what kind of job, how it ranks against the rest, where it is,
 * how long it has been waiting, and what the person who opened it wrote. The
 * last of those is the one that decides which row gets opened, so it gets the
 * width and truncates rather than wrapping the table out of shape.
 */

import type { SortDirection } from "@/demo-runtime/types";

import { absoluteDate } from "../../selectors/leads-list";
import type { MaintenanceRow, MaintenanceSortKey } from "../../selectors/maintenance-list";
import { PRIORITY_TONE, STATUS_TONE } from "./maintenance-view";

type Props = {
  rows: MaintenanceRow[] | null;
  selectedId: string | null;
  sort: MaintenanceSortKey;
  direction: SortDirection;
  onSort: (sort: MaintenanceSortKey, direction: SortDirection) => void;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending",
};

/* Every key the sort select can produce, not only the ones with a column
   header: choosing "Updated: newest" in the sheet still has to be spoken. */
const SORT_LABEL: Record<MaintenanceSortKey, string> = {
  opened: "date opened",
  updated: "last updated",
  priority: "priority",
  status: "status",
  vehicle: "vehicle",
};

/** The sortable columns, and the key each one sorts by. */
const COLUMN_SORT: Record<string, MaintenanceSortKey | undefined> = {
  Vehicle: "vehicle",
  Type: undefined,
  Priority: "priority",
  Status: "status",
  Opened: "opened",
  Summary: undefined,
};

const COLUMNS = ["Vehicle", "Type", "Priority", "Status", "Opened", "Summary"];

export default function MaintenanceTable({
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
          Loading work orders
        </p>
      </div>
    );
  }

  return (
    <div className="ops-leads__table-wrap">
      <table className="ops-table ops-leads__table">
        <caption className="visually-hidden">
          Work orders, sorted by {SORT_LABEL[sort]}{" "}
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
                  {row.vehicleLabel ? (
                    /* Asset code and model, in the mono treatment, because it
                       is what is painted on the machine rather than a name. */
                    <span className="ops-maintenance__vehicle">{row.vehicleLabel}</span>
                  ) : (
                    <span className="ops-leads__unassigned">Unknown vehicle</span>
                  )}
                </button>
              </th>

              <td className="ops-maintenance__type">{row.type}</td>

              <td>
                <span className={`ops-prio ops-prio--${PRIORITY_TONE[row.priority]}`}>
                  <span className="ops-prio__dot" aria-hidden="true" />
                  {row.priority}
                </span>
              </td>

              <td>
                <span className={`ops-pill ops-pill--${STATUS_TONE[row.status]}`}>
                  {row.status}
                </span>
              </td>

              <td className="ops-leads__date">
                <time dateTime={absoluteDate(row.openedAt)}>{absoluteDate(row.openedAt)}</time>
              </td>

              {/* The cell truncates, so the full line is on the title: the
                  summary is the one column a person reads to choose a row. */}
              <td className="ops-maintenance__summary" title={row.summary}>
                {row.summary}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
