"use client";

/**
 * Operations demo — the Leads table.
 *
 * A real `<table>` with real `<th scope="col">`. The rows are tabular data and
 * announcing them as such is what lets a screen reader say "Stage, Qualified"
 * instead of reading six unlabelled cells.
 *
 * The lead name is a `<button>`, not a click handler on the row. A row that
 * only responds to a mouse is unreachable by keyboard, and wrapping the whole
 * row in a control would make every cell part of one enormous accessible name.
 * The row still highlights on hover so the affordance reads at a glance.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { ownerNameOf, relativeDate, absoluteDate, type LeadSortKey } from "../../selectors/leads-list";
import type { Actor, Lead } from "../../types";
import { COLUMN_SORT, LEAD_COLUMNS, PRIORITY_TONE, STAGE_TONE } from "./leads-view";
import type { SortDirection } from "@/demo-runtime/types";

type Props = {
  result: {
    items: DemoRecord<Lead>[];
    total: number;
    page: number;
    pageSize: number;
    pageCount: number;
  } | null;
  actors: DemoRecord<Actor>[];
  now: string | null;
  selectedId: string | null;
  sort: LeadSortKey;
  direction: SortDirection;
  onSort: (sort: LeadSortKey, direction: SortDirection) => void;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

export default function LeadsTable({
  result,
  actors,
  now,
  selectedId,
  sort,
  direction,
  onSort,
  onSelect,
}: Props) {
  if (!result) return <TableSkeleton />;

  return (
    <div className="ops-leads__table-wrap">
      <table className="ops-table ops-leads__table">
        <caption className="visually-hidden">
          Leads, sorted by {SORT_LABEL[sort]} {direction === "asc" ? "ascending" : "descending"}
        </caption>
        <thead>
          <tr>
            {LEAD_COLUMNS.map((column) => {
              const key = COLUMN_SORT[column];
              const active = key !== null && key === sort;
              return (
                <th
                  key={column}
                  scope="col"
                  className={columnClass(column)}
                  /* Only the sorted column carries a value; the others say
                     "none", which is how a reader is told they are sortable
                     but not currently sorted. */
                  aria-sort={
                    key === null ? undefined : active ? ARIA_SORT[direction] : "none"
                  }
                >
                  {key === null ? (
                    column
                  ) : (
                    <button
                      type="button"
                      className={`ops-th-sort${active ? " ops-th-sort--active" : ""}`}
                      onClick={() =>
                        onSort(key, active && direction === "desc" ? "asc" : "desc")
                      }
                    >
                      {column}
                      <span className="ops-th-sort__mark" aria-hidden="true">
                        {active ? (direction === "desc" ? "▾" : "▴") : "⁚"}
                      </span>
                    </button>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {result.items.map((lead) => {
            const owner = ownerNameOf(lead.data.assignedActorId, actors);
            return (
              <tr
                key={lead.id}
                className={`ops-leads__row${lead.id === selectedId ? " ops-leads__row--selected" : ""}`}
              >
                <th scope="row" className="ops-leads__name-cell">
                  <button
                    type="button"
                    className="ops-leads__name"
                    aria-current={lead.id === selectedId ? "true" : undefined}
                    onClick={(e) => onSelect(lead.id, e.currentTarget)}
                  >
                    {lead.data.displayName}
                  </button>
                </th>
                <td className="ops-col--source">{lead.data.source}</td>
                <td>{lead.data.vehicleInterest}</td>
                <td>
                  <span className={`ops-pill ops-pill--${STAGE_TONE[lead.data.stage]}`}>
                    {lead.data.stage}
                  </span>
                </td>
                <td className="ops-leads__owner">
                  {owner ?? <span className="ops-leads__unassigned">Unassigned</span>}
                </td>
                <td>
                  <span className={`ops-prio ops-prio--${PRIORITY_TONE[lead.data.priority]}`}>
                    <span className="ops-prio__dot" aria-hidden="true" />
                    {lead.data.priority}
                  </span>
                </td>
                <td className="ops-leads__date">
                  <time dateTime={absoluteDate(lead.data.lastActivityAt)}>
                    {now ? relativeDate(lead.data.lastActivityAt, now) : "—"}
                  </time>
                </td>
                <td className="ops-leads__date">
                  {lead.data.nextFollowUpAt ? (
                    <time dateTime={absoluteDate(lead.data.nextFollowUpAt)}>
                      {now ? relativeDate(lead.data.nextFollowUpAt, now) : "—"}
                    </time>
                  ) : (
                    <span className="ops-leads__none">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending",
};

const SORT_LABEL: Record<LeadSortKey, string> = {
  lastActivity: "last activity",
  nextFollowUp: "next follow-up",
  name: "lead name",
  stage: "stage",
  priority: "priority",
  created: "created",
};

/* Source is the first column to go when the table narrows: it is the one
   column whose value repeats most and it is stated again in the detail. */
function columnClass(column: string): string | undefined {
  return column === "Source" ? "ops-col--source" : undefined;
}

function TableSkeleton() {
  return (
    <div className="ops-leads__table-wrap" aria-busy="true">
      <div className="ops-skeleton ops-skeleton--table" />
      <p className="visually-hidden" role="status">
        Loading leads
      </p>
    </div>
  );
}
