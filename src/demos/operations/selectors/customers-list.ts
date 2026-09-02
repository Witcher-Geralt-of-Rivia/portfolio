/**
 * Operations demo: the Customers list.
 *
 * The sibling of `leads-list.ts`, and deliberately the same shape: filtering
 * and search go through the shared `queryList` matcher, then ordering and
 * paging happen here because two of the sorts are not fields on a customer.
 * Segment and Status are ranks rather than strings, and Created and Updated
 * live on the record envelope rather than in the payload.
 */

import type { AuditEntry, DemoRecord, QueryResult, SortDirection } from "@/demo-runtime/types";

import { C, DEFAULT_PAGE_SIZE } from "../constants";
import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_STATUSES,
  type Customer,
  type CustomerSegment,
  type CustomerStatus,
} from "../types";
import { queryList } from "./queries";

export type CustomerSortKey = "updated" | "name" | "created" | "segment" | "status";

export type CustomerListQuery = {
  search: string;
  status: CustomerStatus | "all";
  segment: CustomerSegment | "all";
  sort: CustomerSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
};

/**
 * The frozen default: most recently touched first.
 *
 * Every seeded customer shares a `createdAt`, so "newest" by creation would be
 * an arbitrary order wearing a meaningful label. `updatedAt` moves whenever
 * someone actually changes a record, which is what a working list wants at the
 * top.
 */
export const DEFAULT_CUSTOMER_QUERY: CustomerListQuery = {
  search: "",
  status: "all",
  segment: "all",
  sort: "updated",
  direction: "desc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function isDefaultCustomerQuery(query: CustomerListQuery): boolean {
  return query.search.trim() === "" && query.status === "all" && query.segment === "all";
}

/** Name and notes. There is no contact field on a customer to search. */
export const CUSTOMER_SEARCH_FIELDS = ["displayName", "notes"] as const;

const rank = <T extends string>(values: readonly T[], value: T): number => {
  const at = values.indexOf(value);
  return at === -1 ? values.length : at;
};

function compareOn(
  key: CustomerSortKey,
  a: DemoRecord<Customer>,
  b: DemoRecord<Customer>
): number {
  switch (key) {
    case "name":
      return a.data.displayName.localeCompare(b.data.displayName);
    case "created":
      return a.createdAt.localeCompare(b.createdAt);
    case "segment":
      return a.data.segment.localeCompare(b.data.segment);
    case "status":
      /* Active first, which is the only ordering of two states anyone wants. */
      return rank(CUSTOMER_STATUSES, a.data.status) - rank(CUSTOMER_STATUSES, b.data.status);
    case "updated":
    default:
      return a.updatedAt.localeCompare(b.updatedAt);
  }
}

/**
 * Run the Customers list query.
 *
 * Archived customers are excluded here rather than by the caller, for the same
 * reason the Leads list excludes archived leads: archiving is what takes a
 * record out of the working list, so a list that had to remember to ask would
 * eventually forget.
 *
 * Inactive is not archived. An Inactive customer stays in the list.
 */
export function selectCustomerList(
  records: DemoRecord<Customer>[],
  query: CustomerListQuery
): QueryResult<Customer> {
  const matched = queryList<Customer>(records, {
    search: query.search,
    searchFields: CUSTOMER_SEARCH_FIELDS,
    where: (customer) => {
      if (customer.archived) return false;
      if (query.status !== "all" && customer.status !== query.status) return false;
      if (query.segment !== "all" && customer.segment !== query.segment) return false;
      return true;
    },
    /* Zero, not omitted: `queryList` defaults a missing page size to ten. */
    pageSize: 0,
  });

  const sign = query.direction === "desc" ? -1 : 1;
  /* The tie-break is written out rather than inherited from the adapters. */
  const sorted = [...matched.items].sort((a, b) => {
    const primary = compareOn(query.sort, a, b);
    return primary !== 0 ? sign * primary : a.id.localeCompare(b.id);
  });

  const total = sorted.length;
  const pageSize = query.pageSize > 0 ? Math.floor(query.pageSize) : total;
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const page = Math.min(Math.max(1, Math.floor(query.page)), pageCount);
  const items = pageSize > 0 ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  return { items, total, page, pageSize: pageSize || total, pageCount };
}

/** One customer's audit trail, newest first. Sequence is unique, so it orders exactly. */
export function selectCustomerActivity(entries: AuditEntry[], customerId: string): AuditEntry[] {
  return entries
    .filter((e) => e.collection === C.customers && e.entityId === customerId)
    .sort((a, b) => b.sequence - a.sequence);
}

export { CUSTOMER_SEGMENTS, CUSTOMER_STATUSES };
