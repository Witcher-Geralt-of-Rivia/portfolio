/**
 * Operations demo: the Leads list.
 *
 * Everything the Leads screen needs to turn 48 records into one page of rows:
 * which leads match, in what order, and how their dates read. It lives here
 * rather than in the screen because all of it is domain knowledge (that Won
 * follows Proposal, that High outranks Normal, that an archived lead is out of
 * the working list), and a component that decided any of it would be a second
 * place to change when the product changes.
 *
 * Filtering and search go through `queryList`, so there is one matcher. Sorting
 * and paging are done here, for a reason the type system makes plain:
 * `QuerySpec.sort` takes `keyof T`, and three of the six sorts this screen owes
 * the visitor are not fields on a lead. Stage and Priority are ranks (sorting
 * their strings would order the pipeline Contacted, Lost, New, Proposal,
 * Qualified, Won, which is alphabetical and meaningless), and Created lives on
 * the record envelope rather than in the lead itself.
 */

import type { DemoRecord, QueryResult, SortDirection } from "@/demo-runtime/types";
import type { AuditEntry } from "@/demo-runtime/types";

import { C, DEFAULT_PAGE_SIZE } from "../constants";
import { LEAD_STAGES, PRIORITIES, type Actor, type Lead, type LeadSource, type LeadStage } from "../types";
import { queryList } from "./queries";

/* =====================================================================
   THE QUERY
   ===================================================================== */

export type LeadSortKey =
  | "lastActivity"
  | "nextFollowUp"
  | "name"
  | "stage"
  | "priority"
  | "created";

/** `all` is "no filter"; `unassigned` is a real state, not the absence of one. */
export type OwnerFilter = "all" | "unassigned" | (string & {});

export type LeadListQuery = {
  search: string;
  stage: LeadStage | "all";
  source: LeadSource | "all";
  owner: OwnerFilter;
  sort: LeadSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
};

/**
 * The frozen default.
 *
 * Last activity descending puts the leads someone has actually touched most
 * recently at the top, which is the only column in the seed with a genuine
 * spread: every record shares a `createdAt`, so "newest first" would be an
 * arbitrary order wearing a meaningful label.
 */
export const DEFAULT_LEAD_QUERY: LeadListQuery = {
  search: "",
  stage: "all",
  source: "all",
  owner: "all",
  sort: "lastActivity",
  direction: "desc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function isDefaultLeadQuery(query: LeadListQuery): boolean {
  return (
    query.search.trim() === "" &&
    query.stage === "all" &&
    query.source === "all" &&
    query.owner === "all"
  );
}

/** Which fields a search term is matched against. Never contact data: there is none. */
export const LEAD_SEARCH_FIELDS = ["displayName", "vehicleInterest"] as const;

const rank = <T extends string>(values: readonly T[], value: T): number => {
  const at = values.indexOf(value);
  return at === -1 ? values.length : at;
};

/**
 * Compare two leads on the requested key.
 *
 * A null follow-up is not "the earliest": a lead with nothing scheduled sorts
 * after every lead that has something scheduled, in both directions, so
 * reversing the order never floats emptiness to the top.
 */
function compareOn(
  key: LeadSortKey,
  a: DemoRecord<Lead>,
  b: DemoRecord<Lead>
): number {
  switch (key) {
    case "name":
      return a.data.displayName.localeCompare(b.data.displayName);
    case "stage":
      return rank(LEAD_STAGES, a.data.stage) - rank(LEAD_STAGES, b.data.stage);
    case "priority":
      return rank(PRIORITIES, a.data.priority) - rank(PRIORITIES, b.data.priority);
    case "created":
      return a.createdAt.localeCompare(b.createdAt);
    case "nextFollowUp": {
      const x = a.data.nextFollowUpAt;
      const y = b.data.nextFollowUpAt;
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return x.localeCompare(y);
    }
    case "lastActivity":
    default:
      return a.data.lastActivityAt.localeCompare(b.data.lastActivityAt);
  }
}

/**
 * Run the Leads list query.
 *
 * Archived leads are excluded here rather than by the caller. Archiving is what
 * takes a lead out of the working list, so a list that had to remember to ask
 * would eventually forget.
 */
export function selectLeadList(
  records: DemoRecord<Lead>[],
  query: LeadListQuery
): QueryResult<Lead> {
  const matched = queryList<Lead>(records, {
    search: query.search,
    searchFields: LEAD_SEARCH_FIELDS,
    where: (lead) => {
      if (lead.archived) return false;
      if (query.stage !== "all" && lead.stage !== query.stage) return false;
      if (query.source !== "all" && lead.source !== query.source) return false;
      if (query.owner === "unassigned" && lead.assignedActorId !== null) return false;
      if (query.owner !== "all" && query.owner !== "unassigned") {
        if (lead.assignedActorId !== query.owner) return false;
      }
      return true;
    },
    /* Zero, not omitted. `queryList` defaults a missing page size to ten, so
       leaving it out would quietly hand back the first ten matches and make
       the result count read "10 leads" over a list of forty-eight. Zero is
       the runtime's own way of saying "every match". */
    pageSize: 0,
  });

  const sign = query.direction === "desc" ? -1 : 1;
  /* The tie-break is written out rather than inherited. Both persistence
     adapters return rows in id order and the sort is stable, so ties already
     held their order, but that is a guarantee three layers down from the
     screen that depends on it, and a list which reshuffles between renders
     cannot be paged through. */
  const sorted = [...matched.items].sort((a, b) => {
    const primary = compareOn(query.sort, a, b);
    return primary !== 0 ? sign * primary : a.id.localeCompare(b.id);
  });

  const total = sorted.length;
  const pageSize = query.pageSize > 0 ? Math.floor(query.pageSize) : total;
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  /* Clamped, not trusted: a page number can outlive the filter that made it
     reachable, and page 5 of a two-page result should show page 2 rather than
     nothing at all. */
  const page = Math.min(Math.max(1, Math.floor(query.page)), pageCount);
  const items = pageSize > 0 ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  return { items, total, page, pageSize: pageSize || total, pageCount };
}

/* =====================================================================
   OWNERS
   ===================================================================== */

export type OwnerOption = { id: string; name: string };

/**
 * The people a lead can belong to.
 *
 * Derived, not listed. An actor qualifies by being an active Sales Agent
 * (the same test Rule 01 applies when it assigns automatically) or by already
 * owning a lead, so an existing owner is always representable even if their
 * role changes later. A Fleet Coordinator does not become a CRM owner by
 * existing in the actor seed.
 */
export function ownerOptions(
  actors: DemoRecord<Actor>[],
  leads: DemoRecord<Lead>[]
): OwnerOption[] {
  const held = new Set(
    leads.map((l) => l.data.assignedActorId).filter((id): id is string => id !== null)
  );

  return actors
    .filter((a) => (a.data.role === "Sales Agent" && a.data.active) || held.has(a.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((a) => ({ id: a.id, name: a.data.displayName }));
}

export function ownerNameOf(
  actorId: string | null,
  actors: DemoRecord<Actor>[]
): string | null {
  if (!actorId) return null;
  return actors.find((a) => a.id === actorId)?.data.displayName ?? null;
}

/* =====================================================================
   ACTIVITY
   ===================================================================== */

/**
 * One lead's audit trail, newest first.
 *
 * `runtime.listAudit()` returns every entry in the demo (63 seeded plus
 * everything the visitor has done), so the narrowing has to happen somewhere.
 * It happens here so a drawer can render a list rather than compute one.
 *
 * Sequence is monotonic within a demo, so it orders the feed exactly and needs
 * no tie-break: two entries cannot share one.
 */
export function selectLeadActivity(entries: AuditEntry[], leadId: string): AuditEntry[] {
  return entries
    .filter((e) => e.collection === C.leads && e.entityId === leadId)
    .sort((a, b) => b.sequence - a.sequence);
}

/* =====================================================================
   DATES
   ===================================================================== */

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The calendar day an instant falls on, in UTC, as a day number. */
function dayNumber(iso: string): number {
  return Math.floor(Date.parse(iso) / DAY_MS);
}

/** `2026-09-03`. The absolute value, for the title behind a relative phrase. */
export function absoluteDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * A date as a person would say it, relative to the demo's own clock.
 *
 * Never the browser's clock: this demo runs at a fixed logical time, and
 * reading the real one would make "Today" mean whenever the page happened to
 * be opened. `now` is always passed in for that reason.
 *
 * Only the near range is spoken relatively. "In 47 days" is arithmetic, not
 * language, so anything beyond a week falls back to a plain calendar date.
 */
export function relativeDate(iso: string | null, now: string): string {
  if (!iso) return "-";
  const days = dayNumber(iso) - dayNumber(now);

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1 && days <= 7) return `In ${days} days`;
  if (days < -1 && days >= -7) return `${Math.abs(days)} days ago`;

  const at = new Date(Date.parse(iso));
  return `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}
