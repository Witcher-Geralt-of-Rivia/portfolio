"use client";

/**
 * Operations demo: the Leads toolbar.
 *
 * Search, three filters, sort, the result count and the one primary action.
 *
 * Two compositions, not one squeezed. On a wide screen the filters sit inline,
 * because there is room and a visitor should see what is currently narrowing
 * the list without opening anything. On a phone they move into a sheet behind
 * a single Filter button that says how many are active: three selects stacked
 * above the table would push the records themselves below the fold.
 *
 * Search is not debounced. There are 48 records in memory and no request to
 * make; a delay would be latency invented to look like work.
 */

import { useId } from "react";

import {
  isDefaultLeadQuery,
  type LeadListQuery,
  type LeadSortKey,
  type OwnerOption,
} from "../../selectors/leads-list";
import { LEAD_SOURCES, LEAD_STAGES } from "../../types";
import { SORT_CHOICES, parseSortValue, sortValue } from "./leads-view";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "./OpsOverlay";
import type { SortDirection } from "@/demo-runtime/types";

type Props = {
  query: LeadListQuery;
  owners: OwnerOption[];
  total: number | null;
  mayWrite: boolean;
  filtersOpen: boolean;
  onPatch: (next: Partial<LeadListQuery>) => void;
  onClear: () => void;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
  onCreate: () => void;
};

export default function LeadsToolbar({
  query,
  owners,
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
  const isDefault = isDefaultLeadQuery(query);
  const activeCount =
    (query.search.trim() ? 1 : 0) +
    (query.stage !== "all" ? 1 : 0) +
    (query.source !== "all" ? 1 : 0) +
    (query.owner !== "all" ? 1 : 0);

  return (
    <div className="ops-leads__toolbar">
      <div className="ops-leads__lead-row">
        <div className="ops-leads__search">
          <label className="visually-hidden" htmlFor={searchId}>
            Search leads
          </label>
          <input
            id={searchId}
            type="search"
            className="ops-input ops-leads__search-input"
            placeholder="Search leads"
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
            New lead
          </button>
        )}
      </div>

      {/* Inline on a wide screen. The same controls the sheet renders, so a
          filter set on one composition is the one the other shows. */}
      <div className="ops-leads__filters">
        <FilterControls query={query} owners={owners} onPatch={onPatch} />
        <SortControls
          sort={query.sort}
          direction={query.direction}
          onSort={(sort, direction) => onPatch({ sort, direction })}
        />
      </div>

      <div className="ops-leads__result">
        <p className="ops-leads__count" aria-live="polite">
          {total === null ? " " : `${total} ${total === 1 ? "lead" : "leads"}`}
        </p>
        {!isDefault && (
          <button type="button" className="ops-link-button" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>

      {filtersOpen && (
        <OpsOverlay variant="sheet" label="Filter and sort leads" onClose={onCloseFilters}>
          <div className="ops-sheet__head">
            <h2 className="ops-sheet__title">Filter and sort</h2>
            <button type="button" className="ops-button ops-button--quiet" onClick={onCloseFilters}>
              Done
            </button>
          </div>

          <div className="ops-sheet__body">
            <FilterControls query={query} owners={owners} onPatch={onPatch} stacked />
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
              {total === null ? "" : `${total} ${total === 1 ? "lead" : "leads"}`}
            </p>
          </div>
        </OpsOverlay>
      )}
    </div>
  );
}

function FilterControls({
  query,
  owners,
  onPatch,
  stacked = false,
}: {
  query: LeadListQuery;
  owners: OwnerOption[];
  onPatch: (next: Partial<LeadListQuery>) => void;
  stacked?: boolean;
}) {
  /* Stacked in the phone sheet, where each control gets a line of its own and
     the label sits above rather than inside. */
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
          label={stacked ? undefined : "Stage"}
          srLabel="Stage"
          value={query.stage}
          active={query.stage !== "all"}
          onChange={(v) => onPatch({ stage: v as LeadListQuery["stage"] })}
          options={[
            { value: "all", label: "All stages" },
            ...LEAD_STAGES.map((stage) => ({ value: stage, label: stage })),
          ]}
        />,
        "Stage"
      )}

      {wrap(
        <OpsSelect
          label={stacked ? undefined : "Source"}
          srLabel="Source"
          value={query.source}
          active={query.source !== "all"}
          onChange={(v) => onPatch({ source: v as LeadListQuery["source"] })}
          options={[
            { value: "all", label: "All sources" },
            ...LEAD_SOURCES.map((source) => ({ value: source, label: source })),
          ]}
        />,
        "Source"
      )}

      {wrap(
        <OpsSelect
          label={stacked ? undefined : "Owner"}
          srLabel="Owner"
          value={query.owner}
          active={query.owner !== "all"}
          onChange={(v) => onPatch({ owner: v })}
          options={[
            { value: "all", label: "All owners" },
            { value: "unassigned", label: "Unassigned" },
            ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
          ]}
        />,
        "Owner"
      )}
    </>
  );
}

/**
 * Sort: one control, one choice.
 *
 * Field and direction were two controls, the second of which was an unlabelled
 * square carrying an arrow. They are one select now, and each option says what
 * it does: "Last activity: newest" rather than a field plus a symbol the
 * reader has to resolve.
 */
function SortControls({
  sort,
  direction,
  onSort,
  stacked = false,
}: {
  sort: LeadSortKey;
  direction: SortDirection;
  onSort: (sort: LeadSortKey, direction: SortDirection) => void;
  stacked?: boolean;
}) {
  const control = (
    <OpsSelect
      label={stacked ? undefined : "Sort"}
      srLabel="Sort leads"
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
