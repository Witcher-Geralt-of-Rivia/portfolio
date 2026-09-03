/**
 * Operations demo: list query helpers.
 *
 * Thin, typed wrappers over the runtime's query primitive, adding the two
 * things every module list needs and the runtime deliberately does not know
 * about: a normalised search, and a stable tie-break.
 */

import { runQuery } from "@/demo-runtime/repository";
import type {
  AuditEntry,
  CollectionName,
  DemoRecord,
  QueryResult,
  QuerySpec,
  SortDirection,
} from "@/demo-runtime/types";

import { DEFAULT_PAGE_SIZE } from "../constants";

export type ListQuery<T> = {
  search?: string;
  searchFields?: readonly (keyof T & string)[];
  where?: (data: T, record: DemoRecord<T>) => boolean;
  sortField?: keyof T & string;
  sortDirection?: SortDirection;
  page?: number;
  pageSize?: number;
};

/**
 * Run a module list query.
 *
 * Search is trimmed and case-insensitive, which the runtime's matcher already
 * does; an empty or whitespace-only term is treated as no filter rather than
 * as a term nothing matches.
 *
 * Ordering falls back to id when no sort field is given, and the runtime
 * already breaks ties by id, so two records with the same sort value always
 * appear in the same order. A list that reshuffles on every read is unusable
 * and makes screenshots irreproducible.
 */
export function queryList<T>(
  records: DemoRecord<T>[],
  query: ListQuery<T> = {}
): QueryResult<T> {
  const term = (query.search ?? "").trim();

  const spec: QuerySpec<T> = {
    ...(query.where ? { where: query.where } : {}),
    ...(term && query.searchFields?.length
      ? { search: { term, fields: query.searchFields } }
      : {}),
    ...(query.sortField
      ? { sort: { field: query.sortField, direction: query.sortDirection ?? "asc" } }
      : {}),
    page: query.page ?? 1,
    pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
  };

  return runQuery(records, spec);
}

/** Count without paging, for badges and KPI tiles. */
export function countWhere<T>(
  records: DemoRecord<T>[],
  predicate: (data: T, record: DemoRecord<T>) => boolean
): number {
  return records.filter((r) => predicate(r.data, r)).length;
}

/** Group a collection by a derived key, in insertion order of first sighting. */
export function groupBy<T, K extends string>(
  records: DemoRecord<T>[],
  key: (data: T, record: DemoRecord<T>) => K
): Map<K, DemoRecord<T>[]> {
  const groups = new Map<K, DemoRecord<T>[]>();
  for (const record of records) {
    const k = key(record.data, record);
    const bucket = groups.get(k);
    if (bucket) bucket.push(record);
    else groups.set(k, [record]);
  }
  return groups;
}

/* =====================================================================
   ACTIVITY
   ===================================================================== */

/**
 * One record's audit trail, newest first.
 *
 * `runtime.listAudit()` returns every entry in the demo, so the narrowing has
 * to happen somewhere; it happens here so a drawer can render a list rather
 * than compute one.
 *
 * The collection is a parameter rather than a constant. `selectLeadActivity`
 * hard-codes `leads`, which is right for a lead and silently wrong for
 * anything else: a drawer passing a reservation, contract, vehicle or work
 * order id to it matches nothing at all and renders an empty feed that looks
 * like an entity with no history.
 *
 * Sequence is monotonic within a demo, so it orders the feed exactly and needs
 * no tie-break: two entries cannot share one.
 */
export function selectActivity(
  entries: AuditEntry[],
  collection: CollectionName,
  entityId: string
): AuditEntry[] {
  return entries
    .filter((e) => e.collection === collection && e.entityId === entityId)
    .sort((a, b) => b.sequence - a.sequence);
}
