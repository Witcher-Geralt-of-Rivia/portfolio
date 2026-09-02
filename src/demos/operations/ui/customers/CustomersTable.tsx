"use client";

/**
 * Operations demo: the Customers table.
 *
 * The same semantics as the Leads table, and the same CSS grammar, with one
 * difference: its columns depend on the role. A Finance Analyst cannot open
 * Reservations, so the Reservations column is not defined for them rather than
 * rendered empty. A column of dashes still tells the reader that something
 * exists and is being kept from them.
 */

import type { DemoRecord, SortDirection } from "@/demo-runtime/types";

import { relativeDate, absoluteDate } from "../../selectors/leads-list";
import type { CustomerCounts } from "../../selectors/customer-relations";
import type { CustomerSortKey } from "../../selectors/customers-list";
import type { Customer, Role } from "../../types";
import {
  COLUMN_SORT,
  STATUS_TONE,
  customerColumnsFor,
  type CustomerColumn,
} from "./customers-view";

type Props = {
  result: { items: DemoRecord<Customer>[] } | null;
  role: Role;
  counts: Map<string, CustomerCounts>;
  now: string | null;
  selectedId: string | null;
  sort: CustomerSortKey;
  direction: SortDirection;
  onSort: (sort: CustomerSortKey, direction: SortDirection) => void;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

const ARIA_SORT: Record<SortDirection, "ascending" | "descending"> = {
  asc: "ascending",
  desc: "descending",
};

const SORT_LABEL: Record<CustomerSortKey, string> = {
  updated: "last updated",
  name: "customer name",
  created: "created",
  segment: "segment",
  status: "status",
};

export default function CustomersTable({
  result,
  role,
  counts,
  now,
  selectedId,
  sort,
  direction,
  onSort,
  onSelect,
}: Props) {
  if (!result) {
    return (
      <div className="ops-leads__table-wrap" aria-busy="true">
        <div className="ops-skeleton ops-skeleton--table" />
        <p className="visually-hidden" role="status">
          Loading customers
        </p>
      </div>
    );
  }

  const columns = customerColumnsFor(role);

  return (
    <div className="ops-leads__table-wrap">
      <table className="ops-table ops-leads__table ops-customers__table">
        <caption className="visually-hidden">
          Customers, sorted by {SORT_LABEL[sort]}{" "}
          {direction === "asc" ? "ascending" : "descending"}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => {
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
          {result.items.map((customer) => {
            const count = counts.get(customer.id) ?? { contracts: 0, reservations: 0 };
            return (
              <tr
                key={customer.id}
                className={`ops-leads__row${customer.id === selectedId ? " ops-leads__row--selected" : ""}`}
              >
                {columns.map((column) => (
                  <Cell
                    key={column}
                    column={column}
                    customer={customer}
                    counts={count}
                    now={now}
                    selected={customer.id === selectedId}
                    onSelect={onSelect}
                  />
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({
  column,
  customer,
  counts,
  now,
  selected,
  onSelect,
}: {
  column: CustomerColumn;
  customer: DemoRecord<Customer>;
  counts: CustomerCounts;
  now: string | null;
  selected: boolean;
  onSelect: (id: string, trigger: HTMLElement) => void;
}) {
  switch (column) {
    case "Customer":
      return (
        /* A row header, and a real button inside it: a row that only answers a
           mouse is unreachable by keyboard. */
        <th scope="row" className="ops-leads__name-cell">
          <button
            type="button"
            className="ops-leads__name"
            aria-current={selected ? "true" : undefined}
            onClick={(e) => onSelect(customer.id, e.currentTarget)}
          >
            {customer.data.displayName}
          </button>
        </th>
      );
    case "Status":
      return (
        <td>
          <span className={`ops-pill ops-pill--${STATUS_TONE[customer.data.status]}`}>
            {customer.data.status}
          </span>
        </td>
      );
    case "Segment":
      return <td className="ops-customers__segment">{customer.data.segment}</td>;
    case "Origin":
      return (
        <td className="ops-customers__origin">
          {customer.data.sourceLeadId ? (
            /* Provenance, not the id. The link itself lives in the detail,
               where there is room to say what it opens. */
            <span className="ops-customers__converted">Converted lead</span>
          ) : (
            <span className="ops-leads__unassigned">Established</span>
          )}
        </td>
      );
    case "Contracts":
      return <td className="ops-customers__count">{counts.contracts}</td>;
    case "Reservations":
      return <td className="ops-customers__count">{counts.reservations}</td>;
    case "Updated":
    default:
      return (
        <td className="ops-leads__date">
          <time dateTime={absoluteDate(customer.updatedAt)}>
            {now ? relativeDate(customer.updatedAt, now) : "-"}
          </time>
        </td>
      );
  }
}
