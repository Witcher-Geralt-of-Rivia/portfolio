/**
 * Operations demo: the Reservations list.
 *
 * A reservation names a customer and sometimes a vehicle, and neither name is
 * on the record. This is the join: it resolves both once for the whole page so
 * the table renders rows rather than reading two collections per line, and so
 * search can look at what a person actually sees.
 *
 * The sibling of `customers-list.ts` in shape and in reasoning. Filtering and
 * search happen here rather than through the shared `queryList` matcher for
 * the same reason the Inbox list does its own: the searchable text spans other
 * collections, and that matcher tests fields of one record.
 */

import type { DemoRecord, SortDirection } from "@/demo-runtime/types";

import { DEFAULT_PAGE_SIZE } from "../constants";
import type {
  Customer,
  Reservation,
  ReservationStatus,
  Vehicle,
  VehicleClass,
} from "../types";

/* =====================================================================
   QUERY
   ===================================================================== */

export type ReservationSortKey = "start" | "updated" | "customer" | "status";

export type ReservationListQuery = {
  search: string;
  status: ReservationStatus | "all";
  vehicleClass: VehicleClass | "all";
  sort: ReservationSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
};

/**
 * The frozen default: the soonest rental period first.
 *
 * A reservations list is read to answer "what is coming up", so the earliest
 * start is the top of it. `updatedAt` would answer "what did someone touch
 * last", which is a different and less useful question here.
 */
export const DEFAULT_RESERVATION_QUERY: ReservationListQuery = {
  search: "",
  status: "all",
  vehicleClass: "all",
  sort: "start",
  direction: "asc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function isDefaultReservationQuery(query: ReservationListQuery): boolean {
  return (
    query.search.trim() === "" && query.status === "all" && query.vehicleClass === "all"
  );
}

/* =====================================================================
   ROWS
   ===================================================================== */

export type ReservationRow = {
  id: string;
  customerId: string;
  /** The customer's own name. A visitor is never shown a raw id (D-092). */
  customerName: string;
  vehicleClass: VehicleClass;
  vehicleId: string | null;
  /** `MTR-004 Metro 125`, or null while no vehicle is assigned. */
  vehicleLabel: string | null;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  notes: string;
  convertedContractId: string | null;
  updatedAt: string;
};

export type ReservationWorld = {
  reservations: DemoRecord<Reservation>[];
  customers: DemoRecord<Customer>[];
  vehicles: DemoRecord<Vehicle>[];
};

export type ReservationListResult = {
  items: ReservationRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/** `MTR-004 Metro 125`. The operational identity, never the record id. */
export function vehicleLabelOf(vehicle: DemoRecord<Vehicle>): string {
  return `${vehicle.data.assetCode} ${vehicle.data.modelLabel}`;
}

export function buildReservationRows(world: ReservationWorld): ReservationRow[] {
  const customerById = new Map(world.customers.map((c) => [c.id, c]));
  const vehicleById = new Map(world.vehicles.map((v) => [v.id, v]));

  return world.reservations.map((reservation) => {
    const customer = customerById.get(reservation.data.customerId) ?? null;
    const vehicle = reservation.data.vehicleId
      ? (vehicleById.get(reservation.data.vehicleId) ?? null)
      : null;

    return {
      id: reservation.id,
      customerId: reservation.data.customerId,
      /* A record whose customer cannot be resolved says so rather than
         throwing or inventing a name. Local state can be reset, not repaired,
         and a row that renders is a row someone can act on. */
      customerName: customer?.data.displayName ?? "Unknown customer",
      vehicleClass: reservation.data.vehicleClass,
      vehicleId: reservation.data.vehicleId ?? null,
      vehicleLabel: vehicle ? vehicleLabelOf(vehicle) : null,
      startAt: reservation.data.startAt,
      endAt: reservation.data.endAt,
      status: reservation.data.status,
      notes: reservation.data.notes,
      convertedContractId: reservation.data.convertedContractId ?? null,
      updatedAt: reservation.updatedAt,
    };
  });
}

/** Active first, then the rest in lifecycle order. */
const STATUS_RANK: Record<ReservationStatus, number> = {
  Draft: 0,
  Confirmed: 1,
  Converted: 2,
  Cancelled: 3,
};

function compareOn(key: ReservationSortKey, a: ReservationRow, b: ReservationRow): number {
  switch (key) {
    case "customer":
      return a.customerName.localeCompare(b.customerName);
    case "updated":
      return a.updatedAt.localeCompare(b.updatedAt);
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case "start":
    default:
      return a.startAt.localeCompare(b.startAt);
  }
}

/**
 * Filter, order and page the reservation list.
 *
 * Search covers what the row shows: the customer's name, the assigned
 * vehicle's asset code and model, and the notes. It also matches the
 * reservation id, because the id is on screen in the detail and a visitor who
 * has one in hand should be able to find it, which is the same allowance
 * Leads makes.
 */
export function selectReservationList(
  rows: ReservationRow[],
  query: ReservationListQuery
): ReservationListResult {
  const term = query.search.trim().toLowerCase();

  const matched = rows.filter((row) => {
    if (query.status !== "all" && row.status !== query.status) return false;
    if (query.vehicleClass !== "all" && row.vehicleClass !== query.vehicleClass) return false;
    if (!term) return true;
    return (
      row.customerName.toLowerCase().includes(term) ||
      (row.vehicleLabel ?? "").toLowerCase().includes(term) ||
      row.notes.toLowerCase().includes(term) ||
      row.id.toLowerCase().includes(term)
    );
  });

  const sign = query.direction === "desc" ? -1 : 1;
  /* The tie-break is written out rather than inherited from the adapters. */
  const sorted = [...matched].sort((a, b) => {
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

/** How many rows each status holds, for the filter's live counts. */
export function statusTally(rows: ReservationRow[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const row of rows) tally[row.status] = (tally[row.status] ?? 0) + 1;
  return tally;
}
