"use client";

/**
 * Operations demo: the fleet register.
 *
 * The Leads and Reservations table in the same CSS grammar: a row header that
 * is a real button, sortable columns carrying `aria-sort`, and a caption that
 * says how the list is ordered.
 *
 * The row header is the asset code, not the model. A fleet refers to a machine
 * by the code painted on it, so that is the identity a person scans down the
 * first column for and the thing they click to open. The model is a property
 * of the code, and sits in the column after it.
 *
 * Six columns, and none of them is an action: everything about a vehicle that
 * can be changed is changed in the drawer, and everything that cannot is
 * derived from another module.
 */

import type { SortDirection } from "@/demo-runtime/types";

import { formatOdometer, type FleetRow, type FleetSortKey } from "../../selectors/fleet-list";
import { STATUS_TONE } from "./fleet-view";

type Props = {
  rows: FleetRow[] | null;
  selectedId: string | null;
  sort: FleetSortKey;
  direction: SortDirection;
  onSort: (sort: FleetSortKey, direction: SortDirection) => void;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending",
};

const SORT_LABEL: Record<FleetSortKey, string> = {
  asset: "asset code",
  model: "model",
  status: "status",
  odometer: "odometer",
};

/**
 * The sortable columns, and the key each one sorts by.
 *
 * Class is not sortable because there are three of them and the filter answers
 * that question better. Assignment is not sortable because it is a sentence
 * assembled from three other collections, and ordering by prose would sort by
 * whichever word the join happened to put first.
 */
const COLUMN_SORT: Record<string, FleetSortKey | undefined> = {
  Asset: "asset",
  Model: "model",
  Class: undefined,
  Status: "status",
  Odometer: "odometer",
  Assignment: undefined,
};

const COLUMNS = ["Asset", "Model", "Class", "Status", "Odometer", "Assignment"];

export default function FleetTable({
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
          Loading vehicles
        </p>
      </div>
    );
  }

  return (
    <div className="ops-leads__table-wrap">
      <table className="ops-table ops-leads__table">
        <caption className="visually-hidden">
          Vehicles, sorted by {SORT_LABEL[sort]}{" "}
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
                  className="ops-leads__name ops-vehicles__asset"
                  aria-current={row.id === selectedId ? "true" : undefined}
                  onClick={(e) => onSelect(row.id, e.currentTarget)}
                >
                  {row.assetCode}
                </button>
              </th>

              <td className="ops-vehicles__model">{row.modelLabel}</td>

              <td>{row.vehicleClass}</td>

              <td>
                <span className={`ops-pill ops-pill--${STATUS_TONE[row.status]}`}>
                  {row.status}
                </span>
              </td>

              <td className="ops-vehicles__odo">{formatOdometer(row.odometerKm)}</td>

              <td className="ops-vehicles__assignment">
                {/* Free is a word, not an empty cell: a blank here reads as
                    missing data rather than as an available machine. */}
                {row.assignment ?? <span className="ops-leads__unassigned">Free</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
