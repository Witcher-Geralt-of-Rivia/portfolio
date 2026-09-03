"use client";

/**
 * Operations demo: the Contracts toolbar.
 *
 * The toolbar the earlier modules settled on, with two filters and one sort:
 * inline on a wide screen, behind a Filters button in a sheet on a phone, and
 * the approved select for every control.
 *
 * There is no primary button in the lead row, and that absence is the design.
 * A contract is created by converting a reservation and by nothing else, so a
 * create control here would be a promise the services cannot keep. The row is
 * search and filters, and it is shorter for an honest reason.
 *
 * The status filter carries live counts, because "how many are still running"
 * is the question this list exists to answer and the number is already derived.
 */

import { useId } from "react";

import {
  isDefaultContractQuery,
  type ContractListQuery,
} from "../../selectors/contracts-list";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "../leads/OpsOverlay";
import {
  CLASS_OPTIONS,
  SORT_CHOICES,
  STATUS_OPTIONS,
  parseSortValue,
  sortValue,
} from "./contracts-view";

type Props = {
  query: ContractListQuery;
  total: number | null;
  tally: Record<string, number>;
  filtersOpen: boolean;
  onPatch: (next: Partial<ContractListQuery>) => void;
  onClear: () => void;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
};

export default function ContractsToolbar({
  query,
  total,
  tally,
  filtersOpen,
  onPatch,
  onClear,
  onOpenFilters,
  onCloseFilters,
}: Props) {
  const searchId = useId();
  const isDefault = isDefaultContractQuery(query);
  const activeCount =
    (query.search.trim() ? 1 : 0) +
    (query.status !== "all" ? 1 : 0) +
    (query.vehicleClass !== "all" ? 1 : 0);

  return (
    <div className="ops-leads__toolbar">
      <div className="ops-leads__lead-row">
        <div className="ops-leads__search">
          <label className="visually-hidden" htmlFor={searchId}>
            Search contracts
          </label>
          <input
            id={searchId}
            type="search"
            className="ops-input ops-leads__search-input"
            placeholder="Search contracts"
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
      </div>

      <div className="ops-leads__filters">
        <Controls query={query} tally={tally} onPatch={onPatch} />
      </div>

      <div className="ops-leads__result">
        <p className="ops-leads__count" aria-live="polite">
          {total === null ? " " : `${total} ${total === 1 ? "contract" : "contracts"}`}
        </p>
        {!isDefault && (
          <button type="button" className="ops-link-button" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>

      {filtersOpen && (
        <OpsOverlay variant="sheet" label="Filter and sort contracts" onClose={onCloseFilters}>
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
              {total === null ? "" : `${total} ${total === 1 ? "contract" : "contracts"}`}
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
  query: ContractListQuery;
  tally: Record<string, number>;
  onPatch: (next: Partial<ContractListQuery>) => void;
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
          onChange={(v) => onPatch({ status: v as ContractListQuery["status"] })}
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
          onChange={(v) => onPatch({ vehicleClass: v as ContractListQuery["vehicleClass"] })}
          options={CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />,
        "Vehicle class"
      )}

      {wrap(
        <OpsSelect
          label={stacked ? undefined : "Sort"}
          srLabel="Sort contracts"
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
