"use client";

/**
 * Operations demo: the Customers toolbar.
 *
 * The Leads toolbar's structure, with two filters instead of three. Inline on a
 * wide screen, behind a Filters button in a sheet on a phone, and the same
 * approved select for every control.
 */

import { useId } from "react";

import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_STATUSES,
  isDefaultCustomerQuery,
  type CustomerListQuery,
  type CustomerSortKey,
} from "../../selectors/customers-list";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "../leads/OpsOverlay";
import { SORT_CHOICES, parseSortValue, sortValue } from "./customers-view";
import type { SortDirection } from "@/demo-runtime/types";

type Props = {
  query: CustomerListQuery;
  total: number | null;
  mayWrite: boolean;
  filtersOpen: boolean;
  onPatch: (next: Partial<CustomerListQuery>) => void;
  onClear: () => void;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
  onCreate: () => void;
};

export default function CustomersToolbar({
  query,
  total,
  mayWrite,
  filtersOpen,
  onPatch,
  onClear,
  onOpenFilters,
  onCloseFilters,
  onCreate,
}: Props) {
  const searchId = useId();
  const isDefault = isDefaultCustomerQuery(query);
  const activeCount =
    (query.search.trim() ? 1 : 0) +
    (query.status !== "all" ? 1 : 0) +
    (query.segment !== "all" ? 1 : 0);

  return (
    <div className="ops-leads__toolbar">
      <div className="ops-leads__lead-row">
        <div className="ops-leads__search">
          <label className="visually-hidden" htmlFor={searchId}>
            Search customers
          </label>
          <input
            id={searchId}
            type="search"
            className="ops-input ops-leads__search-input"
            placeholder="Search customers"
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
            New customer
          </button>
        )}
      </div>

      <div className="ops-leads__filters">
        <FilterControls query={query} onPatch={onPatch} />
        <SortControls
          sort={query.sort}
          direction={query.direction}
          onSort={(sort, direction) => onPatch({ sort, direction })}
        />
      </div>

      <div className="ops-leads__result">
        <p className="ops-leads__count" aria-live="polite">
          {total === null ? " " : `${total} ${total === 1 ? "customer" : "customers"}`}
        </p>
        {!isDefault && (
          <button type="button" className="ops-link-button" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>

      {filtersOpen && (
        <OpsOverlay variant="sheet" label="Filter and sort customers" onClose={onCloseFilters}>
          <div className="ops-sheet__head">
            <h2 className="ops-sheet__title">Filter and sort</h2>
            <button type="button" className="ops-button ops-button--quiet" onClick={onCloseFilters}>
              Done
            </button>
          </div>

          <div className="ops-sheet__body">
            <FilterControls query={query} onPatch={onPatch} stacked />
            <SortControls
              sort={query.sort}
              direction={query.direction}
              onSort={(sort, direction) => onPatch({ sort, direction })}
              stacked
            />
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
              {total === null ? "" : `${total} ${total === 1 ? "customer" : "customers"}`}
            </p>
          </div>
        </OpsOverlay>
      )}
    </div>
  );
}

function FilterControls({
  query,
  onPatch,
  stacked = false,
}: {
  query: CustomerListQuery;
  onPatch: (next: Partial<CustomerListQuery>) => void;
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
          onChange={(v) => onPatch({ status: v as CustomerListQuery["status"] })}
          options={[
            { value: "all", label: "All statuses" },
            ...CUSTOMER_STATUSES.map((s) => ({ value: s, label: s })),
          ]}
        />,
        "Status"
      )}

      {wrap(
        <OpsSelect
          label={stacked ? undefined : "Segment"}
          srLabel="Segment"
          value={query.segment}
          active={query.segment !== "all"}
          onChange={(v) => onPatch({ segment: v as CustomerListQuery["segment"] })}
          options={[
            { value: "all", label: "All segments" },
            ...CUSTOMER_SEGMENTS.map((s) => ({ value: s, label: s })),
          ]}
        />,
        "Segment"
      )}
    </>
  );
}

function SortControls({
  sort,
  direction,
  onSort,
  stacked = false,
}: {
  sort: CustomerSortKey;
  direction: SortDirection;
  onSort: (sort: CustomerSortKey, direction: SortDirection) => void;
  stacked?: boolean;
}) {
  const control = (
    <OpsSelect
      label={stacked ? undefined : "Sort"}
      srLabel="Sort customers"
      value={sortValue(sort, direction)}
      onChange={(v) => {
        const next = parseSortValue(v);
        onSort(next.key, next.direction);
      }}
      options={SORT_CHOICES.map((c) => ({ value: c.value, label: c.label }))}
    />
  );

  return stacked ? (
    <span className="ops-control-row">
      <span className="ops-control-row__label">Sort</span>
      {control}
    </span>
  ) : (
    control
  );
}
