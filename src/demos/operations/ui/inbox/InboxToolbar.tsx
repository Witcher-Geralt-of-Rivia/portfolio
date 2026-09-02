"use client";

/**
 * Operations demo: the Inbox toolbar.
 *
 * The Leads and Customers toolbar, with three filters instead of two and no
 * page-size control: the Inbox does not paginate. Inline on a wide screen,
 * behind a Filters button in a sheet on a phone, and the same approved select
 * for every control.
 */

import { useId } from "react";

import type { InboxQuery } from "../../selectors/inbox-list";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "../leads/OpsOverlay";
import {
  CHANNEL_OPTIONS,
  READ_OPTIONS,
  STATUS_OPTIONS,
  activeFilterCount,
} from "./inbox-view";

type Props = {
  query: InboxQuery;
  total: number | null;
  unread: number | null;
  isDefault: boolean;
  filtersOpen: boolean;
  onPatch: (next: Partial<InboxQuery>) => void;
  onClear: () => void;
  onOpenFilters: () => void;
  onCloseFilters: () => void;
};

export default function InboxToolbar({
  query,
  total,
  unread,
  isDefault,
  filtersOpen,
  onPatch,
  onClear,
  onOpenFilters,
  onCloseFilters,
}: Props) {
  const searchId = useId();
  const active = activeFilterCount(query);

  return (
    <div className="ops-leads__toolbar ops-inbox__toolbar">
      <div className="ops-leads__lead-row">
        <div className="ops-leads__search">
          <label className="visually-hidden" htmlFor={searchId}>
            Search conversations
          </label>
          <input
            id={searchId}
            type="search"
            className="ops-input ops-leads__search-input"
            placeholder="Search conversations"
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
          {active > 0 && (
            <span className="ops-leads__filter-count" aria-hidden="true">
              {active}
            </span>
          )}
          <span className="visually-hidden">{active > 0 ? `, ${active} active` : ""}</span>
        </button>
      </div>

      <div className="ops-leads__filters">
        <FilterControls query={query} onPatch={onPatch} />
      </div>

      <div className="ops-leads__result">
        {/* Both figures describe what is on screen: filtering to four threads
            and still claiming six unread would be a count of something the
            visitor cannot see. */}
        <p className="ops-leads__count" aria-live="polite">
          {total === null
            ? " "
            : `${total} ${total === 1 ? "conversation" : "conversations"}${
                unread ? `, ${unread} unread` : ""
              }`}
        </p>
        {!isDefault && (
          <button type="button" className="ops-link-button" onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>

      {filtersOpen && (
        <OpsOverlay variant="sheet" label="Filter conversations" onClose={onCloseFilters}>
          <div className="ops-sheet__head">
            <h2 className="ops-sheet__title">Filter</h2>
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={onCloseFilters}
            >
              Done
            </button>
          </div>

          <div className="ops-sheet__body">
            <FilterControls query={query} onPatch={onPatch} stacked />
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
              {total === null
                ? ""
                : `${total} ${total === 1 ? "conversation" : "conversations"}`}
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
  query: InboxQuery;
  onPatch: (next: Partial<InboxQuery>) => void;
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
          onChange={(v) => onPatch({ status: v as InboxQuery["status"] })}
          options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />,
        "Status"
      )}

      {wrap(
        <OpsSelect
          label={stacked ? undefined : "Channel"}
          srLabel="Channel"
          value={query.channel}
          active={query.channel !== "all"}
          onChange={(v) => onPatch({ channel: v as InboxQuery["channel"] })}
          options={CHANNEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />,
        "Channel"
      )}

      {wrap(
        <OpsSelect
          label={stacked ? undefined : "Read"}
          srLabel="Read state"
          value={query.read}
          active={query.read !== "all"}
          onChange={(v) => onPatch({ read: v as InboxQuery["read"] })}
          options={READ_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />,
        "Read state"
      )}
    </>
  );
}
