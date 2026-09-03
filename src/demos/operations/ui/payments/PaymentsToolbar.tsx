"use client";

/**
 * Operations demo: the Payments toolbar.
 *
 * The toolbar the earlier modules settled on, with two filters and one sort:
 * inline on a wide screen, behind a Filters button in a sheet on a phone, and
 * the approved select for every control.
 *
 * The status filter carries live counts over the derived status, not the stored
 * one. Counting `payment.status` would report Overdue as zero for ever, because
 * Overdue is never written down.
 *
 * One thing is this toolbar's own: the outstanding total beside the count. A
 * payments list is read to answer "how much is still owed", and the answer to
 * that question moves with the filters, so it is stated where the filters are
 * and it names how many payments it was summed over. A figure without its
 * denominator is a figure nobody can check.
 */

import { useId } from "react";

import {
  isDefaultPaymentQuery,
  type PaymentListQuery,
} from "../../selectors/payments-list";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "../leads/OpsOverlay";
import {
  CATEGORY_OPTIONS,
  SORT_CHOICES,
  STATUS_OPTIONS,
  formatCents,
  parseSortValue,
  sortValue,
} from "./payments-view";

export type OutstandingSummary = {
  /** Integer cents still owed across everything the filters matched. */
  cents: number;
  /** How many payments that sum was taken over. */
  count: number;
};

type Props = {
  query: PaymentListQuery;
  total: number | null;
  tally: Record<string, number>;
  outstanding: OutstandingSummary | null;
  mayWrite: boolean;
  filtersOpen: boolean;
  onPatch: (next: Partial<PaymentListQuery>) => void;
  onClear: () => void;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
  onRecord: () => void;
};

export default function PaymentsToolbar({
  query,
  total,
  tally,
  outstanding,
  mayWrite,
  filtersOpen,
  onPatch,
  onClear,
  onOpenFilters,
  onCloseFilters,
  onRecord,
}: Props) {
  const searchId = useId();
  const isDefault = isDefaultPaymentQuery(query);
  const activeCount =
    (query.search.trim() ? 1 : 0) +
    (query.status !== "all" ? 1 : 0) +
    (query.category !== "all" ? 1 : 0);

  return (
    <div className="ops-leads__toolbar">
      <div className="ops-leads__lead-row">
        <div className="ops-leads__search">
          <label className="visually-hidden" htmlFor={searchId}>
            Search payments
          </label>
          <input
            id={searchId}
            type="search"
            className="ops-input ops-leads__search-input"
            placeholder="Search payments"
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
          <button type="button" className="ops-button ops-button--primary" onClick={onRecord}>
            Record payment
          </button>
        )}
      </div>

      <div className="ops-leads__filters">
        <Controls query={query} tally={tally} onPatch={onPatch} />
      </div>

      <div className="ops-leads__result">
        <p className="ops-leads__count" aria-live="polite">
          {total === null ? " " : `${total} ${total === 1 ? "payment" : "payments"}`}
        </p>
        <p className="ops-payments__summary">
          <Outstanding outstanding={outstanding} total={total} />
        </p>
        {!isDefault && (
          <button type="button" className="ops-link-button" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>

      {filtersOpen && (
        <OpsOverlay variant="sheet" label="Filter and sort payments" onClose={onCloseFilters}>
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
              {total === null ? "" : `${total} ${total === 1 ? "payment" : "payments"}`}
            </p>
          </div>
        </OpsOverlay>
      )}
    </div>
  );
}

/**
 * The outstanding figure, or the plain sentence that says there is none.
 *
 * "8 of 26" rather than "8", because the sum was taken over the unsettled rows
 * and the count line beside it reports every matched row. Naming both is what
 * lets a reader see that the two numbers are answering different questions.
 */
function Outstanding({
  outstanding,
  total,
}: {
  outstanding: OutstandingSummary | null;
  total: number | null;
}) {
  if (!outstanding || total === null) return <>{" "}</>;
  if (outstanding.cents === 0) return <>Nothing outstanding</>;

  const noun = total === 1 ? "payment" : "payments";
  return (
    <>
      USD <strong>{formatCents(outstanding.cents)}</strong> outstanding across{" "}
      {outstanding.count} of {total} {noun}
    </>
  );
}

function Controls({
  query,
  tally,
  onPatch,
  stacked = false,
}: {
  query: PaymentListQuery;
  tally: Record<string, number>;
  onPatch: (next: Partial<PaymentListQuery>) => void;
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
          onChange={(v) => onPatch({ status: v as PaymentListQuery["status"] })}
          /* Counts come from the live rows and from the derived status, never
             from a constant and never from what is stored. */
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
          label={stacked ? undefined : "Category"}
          srLabel="Category"
          value={query.category}
          active={query.category !== "all"}
          onChange={(v) => onPatch({ category: v as PaymentListQuery["category"] })}
          options={CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />,
        "Category"
      )}

      {wrap(
        <OpsSelect
          label={stacked ? undefined : "Sort"}
          srLabel="Sort payments"
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
