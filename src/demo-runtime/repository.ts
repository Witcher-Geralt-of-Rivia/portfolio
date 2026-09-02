/**
 * Demo runtime: generic repository and query layer.
 *
 * Reads and shapes records. It knows nothing about business rules, which is
 * why a domain service wraps it rather than the UI calling it directly: a
 * repository that starts validating leads or reassigning jobs has stopped
 * being generic and the next demo cannot share it.
 *
 * Queries run in memory after the collection is read. Demo collections hold
 * tens to low hundreds of records, so an index planner would be engineering
 * for a scale that will never arrive; the cost of reading a collection and
 * filtering it is measured in the QA harness and is not perceptible.
 */

import type { DemoPersistenceAdapter } from "./persistence/adapter";
import type {
  CollectionName,
  DemoId,
  DemoRecord,
  QueryResult,
  QuerySpec,
} from "./types";
import { DemoError } from "./types";

/* =====================================================================
   QUERY
   ===================================================================== */

function matchesSearch<T>(
  data: T,
  term: string,
  fields: readonly (keyof T & string)[]
): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  for (const field of fields) {
    const value = (data as Record<string, unknown>)[field];
    if (typeof value === "string" && value.toLowerCase().includes(needle)) return true;
    if (typeof value === "number" && String(value).includes(needle)) return true;
  }
  return false;
}

/**
 * Comparison used by sorting.
 *
 * Strings compare with `localeCompare` so ordering is stable and human, and
 * numbers compare numerically rather than lexically: the difference between
 * `2 < 10` and `"10" < "2"`, which is the classic way a sorted demo table
 * looks broken.
 */
function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

/**
 * Apply a query to records already read from persistence.
 *
 * Exported separately from the repository so a domain service can filter a
 * set it has already assembled, and so the QA harness can test the query
 * semantics without any persistence at all.
 */
export function runQuery<T>(
  records: DemoRecord<T>[],
  spec: QuerySpec<T> = {}
): QueryResult<T> {
  let items = records;

  if (spec.where) {
    const where = spec.where;
    items = items.filter((r) => where(r.data, r));
  }

  if (spec.search && spec.search.term.trim()) {
    const { term, fields } = spec.search;
    items = items.filter((r) => matchesSearch(r.data, term, fields));
  }

  if (spec.sort) {
    const { field, direction = "asc" } = spec.sort;
    const sign = direction === "desc" ? -1 : 1;
    /* Sort a copy: `items` may still be the array the caller passed in. */
    items = [...items].sort(
      (x, y) =>
        sign *
        compare(
          (x.data as Record<string, unknown>)[field],
          (y.data as Record<string, unknown>)[field]
        )
    );
  } else {
    /* Without an explicit sort, order by id. Persistence returns rows in key
       order, but relying on that would make the result depend on which
       adapter is active, and the two must be indistinguishable. */
    items = [...items].sort((x, y) => x.id.localeCompare(y.id));
  }

  const total = items.length;
  const pageSize = spec.pageSize && spec.pageSize > 0 ? Math.floor(spec.pageSize) : total;
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const page = Math.min(Math.max(1, Math.floor(spec.page ?? 1)), pageCount);

  const paged =
    spec.pageSize && spec.pageSize > 0
      ? items.slice((page - 1) * pageSize, page * pageSize)
      : items;

  return { items: paged, total, page, pageSize: pageSize || total, pageCount };
}

/* =====================================================================
   REPOSITORY
   ===================================================================== */

export type DemoRepository = {
  list<T>(collection: CollectionName, spec?: QuerySpec<T>): Promise<QueryResult<T>>;
  all<T>(collection: CollectionName): Promise<DemoRecord<T>[]>;
  get<T>(collection: CollectionName, id: string): Promise<DemoRecord<T> | null>;
  /** Throws NOT_FOUND rather than returning null. */
  require<T>(collection: CollectionName, id: string): Promise<DemoRecord<T>>;
  count(collection: CollectionName): Promise<number>;
};

export function createRepository(
  adapter: DemoPersistenceAdapter,
  demoId: DemoId
): DemoRepository {
  return {
    async all<T>(collection: CollectionName) {
      return (await adapter.list(demoId, collection)) as DemoRecord<T>[];
    },

    async list<T>(collection: CollectionName, spec?: QuerySpec<T>) {
      const records = (await adapter.list(demoId, collection)) as DemoRecord<T>[];
      return runQuery(records, spec);
    },

    async get<T>(collection: CollectionName, id: string) {
      return (await adapter.get(demoId, collection, id)) as DemoRecord<T> | null;
    },

    async require<T>(collection: CollectionName, id: string) {
      const hit = (await adapter.get(demoId, collection, id)) as DemoRecord<T> | null;
      if (!hit) {
        throw new DemoError("NOT_FOUND", `No ${collection} record with id "${id}".`, id);
      }
      return hit;
    },

    async count(collection: CollectionName) {
      return (await adapter.list(demoId, collection)).length;
    },
  };
}
