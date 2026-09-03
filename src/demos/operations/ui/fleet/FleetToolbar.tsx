"use client";

/**
 * Operations demo: the Fleet toolbar.
 *
 * The toolbar Leads established and Reservations reused: search, a Filters
 * button that opens the same sheet on a phone, and the approved select for
 * every control.
 *
 * The status filter carries live counts because "how many are free right now"
 * is the question a register is opened to answer, and the number is already
 * derived by the list selector.
 */

import { useId } from "react";

import { isDefaultFleetQuery, type FleetListQuery } from "../../selectors/fleet-list";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "../leads/OpsOverlay";
import {
  CLASS_OPTIONS,
  SORT_CHOICES,
  STATUS_OPTIONS,
  parseSortValue,
  sortValue,
} from "./fleet-view";

type Props = {
  query: FleetListQuery;
  total: number | null;
  tally: Record<string, number>;
  mayWrite: boolean;
  filtersOpen: boolean;
  onPatch: (next: Partial<FleetListQuery>) => void;
  onClear: () => void;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
  onCreate: () => void;
};

export default function FleetToolbar({
  query,
  total,
  tally,
  mayWrite,
  filtersOpen,
  onPatch,
  onClear,
  onOpenFilters,
  onCloseFilters,
  onCreate,
}: Props) {
  const searchId = useId();
  const isDefault = isDefaultFleetQuery(query);
  const activeCount =
    (query.search.trim() ? 1 : 0) +
    (query.status !== "all" ? 1 : 0) +
    (query.vehicleClass !== "all" ? 1 : 0);

  return (
    <div className="ops-leads__toolbar">
      <div className="ops-leads__lead-row">
        <div className="ops-leads__search">
          <label className="visually-hidden" htmlFor={searchId}>
            Search vehicles
          </label>
          <input
            id={searchId}
            type="search"
            className="ops-input ops-leads__search-input"
            placeholder="Search vehicles"
            value={query.search}
            onChange={(e) => onPatch({ search: e.target.value })}
          />
        </div>

        <button
          type="button"
          className="ops-button ops-button--quiet ops-leads__filter-button"
          aria-expanded={filtersOpen}
          onClick={onOpenFilters}
        >
          Filters
          {activeCount > 0 && (
            <span className="ops-leads__filter-count" aria-hidden="true">
              {activeCount}
            </span>
          )}
          <span className="visually-hidden">
            {activeCount > 0 ? `, ${activeCount} active` : ""}
          </span>
        </button>

        {mayWrite && (
          <button type="button" className="ops-button ops-button--primary" onClick={onCreate}>
            New vehicle
          </button>
        )}
      </div>

      <div className="ops-leads__filters">
        <Controls query={query} tally={tally} onPatch={onPatch} />
      </div>

      <div className="ops-leads__result">
        <p className="ops-leads__count" aria-live="polite">
          {total === null ? " " : `${total} ${total === 1 ? "vehicle" : "vehicles"}`}
        </p>
        {!isDefault && (
          <button type="button" className="ops-link-button" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>

      {filtersOpen && (
        <OpsOverlay variant="sheet" label="Filter and sort vehicles" onClose={onCloseFilters}>
          <div className="ops-sheet__head">
            <h2 className="ops-sheet__title">Filter and sort</h2>
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={onCloseFilters}
            >
              Done
            </button>
          </div>

          <div className="ops-sheet__body">
            <Controls query={query} tally={tally} onPatch={onPatch} stacked />
          </div>

          <div className="ops-sheet__foot">
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={onClear}
              disabled={isDefault}
            >
              Clear filters
            </button>
            <p className="ops-sheet__result">
              {total === null ? "" : `${total} ${total === 1 ? "vehicle" : "vehicles"}`}
            </p>
          </div>
        </OpsOverlay>
      )}
    </div>
  );
}

function Controls({
  query,
  tally,
  onPatch,
  stacked = false,
}: {
  query: FleetListQuery;
  tally: Record<string, number>;
  onPatch: (next: Partial<FleetListQuery>) => void;
  stacked?: boolean;
}) {
  const wrap = (node: React.ReactNode, label: string) =>
    stacked ? (
      <span className="ops-control-row">
        <span className="ops-control-row__label">{label}</span>
        {node}
      </span>
    ) : (
      node
    );

  return (
    <>
      {wrap(
        <OpsSelect
          label={stacked ? undefined : "Status"}
          srLabel="Status"
          value={query.status}
          active={query.status !== "all"}
          onChange={(v) => onPatch({ status: v as FleetListQuery["status"] })}
          /* Counts come from the live rows, never from a constant. */
          options={STATUS_OPTIONS.map((o) => ({
            value: o.value,
            label:
              o.value === "all" || tally[o.value] === undefined
                ? o.label
                : `${o.label} (${tally[o.value]})`,
          }))}
        />,
        "Status"
      )}

      {wrap(
        <OpsSelect
          label={stacked ? undefined : "Class"}
          srLabel="Vehicle class"
          value={query.vehicleClass}
          active={query.vehicleClass !== "all"}
          onChange={(v) => onPatch({ vehicleClass: v as FleetListQuery["vehicleClass"] })}
          options={CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />,
        "Vehicle class"
      )}

      {wrap(
        <OpsSelect
          label={stacked ? undefined : "Sort"}
          srLabel="Sort vehicles"
          value={sortValue(query.sort, query.direction)}
          onChange={(v) => {
            const next = parseSortValue(v);
            onPatch({ sort: next.key, direction: next.direction });
          }}
          options={SORT_CHOICES.map((c) => ({ value: c.value, label: c.label }))}
        />,
        "Sort"
      )}
    </>
  );
}
