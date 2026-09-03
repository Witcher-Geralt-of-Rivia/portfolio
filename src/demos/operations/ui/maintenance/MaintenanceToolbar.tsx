"use client";

/**
 * Operations demo: the Maintenance toolbar.
 *
 * The same toolbar every list module carries: search, a Filters button that
 * becomes a sheet on a phone, and the approved select for each control. Two
 * filters and one sort, because a work queue is read by state and by weight
 * and there is nothing else worth narrowing on.
 *
 * The status filter carries live counts. "How many are still open" is the
 * question a coordinator opens this page to answer, and the number is already
 * derived from the rows on screen.
 */

import { useId } from "react";

import {
  isDefaultMaintenanceQuery,
  type MaintenanceListQuery,
} from "../../selectors/maintenance-list";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "../leads/OpsOverlay";
import {
  PRIORITY_OPTIONS,
  SORT_CHOICES,
  STATUS_OPTIONS,
  parseSortValue,
  sortValue,
} from "./maintenance-view";

type Props = {
  query: MaintenanceListQuery;
  total: number | null;
  tally: Record<string, number>;
  mayWrite: boolean;
  filtersOpen: boolean;
  onPatch: (next: Partial<MaintenanceListQuery>) => void;
  onClear: () => void;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
  onCreate: () => void;
};

/** The count line, in one place so the bar and the sheet cannot disagree. */
const countLabel = (total: number) =>
  `${total} ${total === 1 ? "work order" : "work orders"}`;

export default function MaintenanceToolbar({
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
  const isDefault = isDefaultMaintenanceQuery(query);
  const activeCount =
    (query.search.trim() ? 1 : 0) +
    (query.status !== "all" ? 1 : 0) +
    (query.priority !== "all" ? 1 : 0);

  return (
    <div className="ops-leads__toolbar">
      <div className="ops-leads__lead-row">
        <div className="ops-leads__search">
          <label className="visually-hidden" htmlFor={searchId}>
            Search work orders
          </label>
          <input
            id={searchId}
            type="search"
            className="ops-input ops-leads__search-input"
            placeholder="Search work orders"
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
            New work order
          </button>
        )}
      </div>

      <div className="ops-leads__filters">
        <Controls query={query} tally={tally} onPatch={onPatch} />
      </div>

      <div className="ops-leads__result">
        <p className="ops-leads__count" aria-live="polite">
          {total === null ? " " : countLabel(total)}
        </p>
        {!isDefault && (
          <button type="button" className="ops-link-button" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>

      {filtersOpen && (
        <OpsOverlay variant="sheet" label="Filter and sort work orders" onClose={onCloseFilters}>
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
            <p className="ops-sheet__result">{total === null ? "" : countLabel(total)}</p>
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
  query: MaintenanceListQuery;
  tally: Record<string, number>;
  onPatch: (next: Partial<MaintenanceListQuery>) => void;
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
          onChange={(v) => onPatch({ status: v as MaintenanceListQuery["status"] })}
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
          label={stacked ? undefined : "Priority"}
          srLabel="Priority"
          value={query.priority}
          active={query.priority !== "all"}
          onChange={(v) => onPatch({ priority: v as MaintenanceListQuery["priority"] })}
          options={PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />,
        "Priority"
      )}

      {wrap(
        <OpsSelect
          label={stacked ? undefined : "Sort"}
          srLabel="Sort work orders"
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
