/**
 * Operations demo: the Maintenance list.
 *
 * A work order names a vehicle by id and nothing else, so the join here is what
 * turns the list from a table of references into a worksheet: the asset code
 * and model a person would read off the machine.
 *
 * Priority is ranked but never dramatised. High means "before the others", not
 * "emergency", and nothing in this module gives it alarm language or an alarm
 * colour: a rental fleet's work queue is ordinary work.
 */

import type { DemoRecord, SortDirection } from "@/demo-runtime/types";

import { DEFAULT_PAGE_SIZE } from "../constants";
import type {
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceType,
  MaintenanceWorkOrder,
  Vehicle,
  VehicleClass,
} from "../types";
import { vehicleLabelOf } from "./reservations-list";

/* =====================================================================
   QUERY
   ===================================================================== */

export type MaintenanceSortKey = "opened" | "updated" | "priority" | "status" | "vehicle";

export type MaintenanceListQuery = {
  search: string;
  status: MaintenanceStatus | "all";
  priority: MaintenancePriority | "all";
  sort: MaintenanceSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
};

/**
 * The frozen default: most recently opened first.
 *
 * A work queue is read from the top, and the newest arrival is the one nobody
 * has looked at yet. Priority is a sort a visitor chooses, not the order the
 * list opens in: defaulting to it would bury a routine job that has been
 * waiting a fortnight.
 */
export const DEFAULT_MAINTENANCE_QUERY: MaintenanceListQuery = {
  search: "",
  status: "all",
  priority: "all",
  sort: "opened",
  direction: "desc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function isDefaultMaintenanceQuery(query: MaintenanceListQuery): boolean {
  return query.search.trim() === "" && query.status === "all" && query.priority === "all";
}

/* =====================================================================
   ROWS
   ===================================================================== */

export type MaintenanceRow = {
  id: string;
  vehicleId: string;
  /** `MTR-012 Tour 250`, or null if the vehicle cannot be resolved. */
  vehicleLabel: string | null;
  assetCode: string | null;
  vehicleClass: VehicleClass | null;
  type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  openedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  summary: string;
  updatedAt: string;
};

export type MaintenanceWorld = {
  workOrders: DemoRecord<MaintenanceWorkOrder>[];
  vehicles: DemoRecord<Vehicle>[];
};

export type MaintenanceListResult = {
  items: MaintenanceRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function buildMaintenanceRows(world: MaintenanceWorld): MaintenanceRow[] {
  const vehicleById = new Map(world.vehicles.map((v) => [v.id, v]));

  return world.workOrders.map((work) => {
    const vehicle = vehicleById.get(work.data.vehicleId) ?? null;

    return {
      id: work.id,
      vehicleId: work.data.vehicleId,
      vehicleLabel: vehicle ? vehicleLabelOf(vehicle) : null,
      assetCode: vehicle?.data.assetCode ?? null,
      vehicleClass: vehicle?.data.vehicleClass ?? null,
      type: work.data.type,
      priority: work.data.priority,
      status: work.data.status,
      openedAt: work.data.openedAt,
      startedAt: work.data.startedAt ?? null,
      completedAt: work.data.completedAt ?? null,
      summary: work.data.summary,
      updatedAt: work.updatedAt,
    };
  });
}

/** Open work before finished work. */
const STATUS_RANK: Record<MaintenanceStatus, number> = {
  "In Progress": 0,
  Open: 1,
  Completed: 2,
  Cancelled: 3,
};

/** Ascending is least urgent first, so "High first" is the descending choice. */
const PRIORITY_RANK: Record<MaintenancePriority, number> = {
  Routine: 0,
  Soon: 1,
  High: 2,
};

function compareOn(key: MaintenanceSortKey, a: MaintenanceRow, b: MaintenanceRow): number {
  switch (key) {
    case "updated":
      return a.updatedAt.localeCompare(b.updatedAt);
    case "priority":
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case "vehicle":
      return (a.assetCode ?? "").localeCompare(b.assetCode ?? "");
    case "opened":
    default:
      return a.openedAt.localeCompare(b.openedAt);
  }
}

/**
 * Filter, order and page the work queue.
 *
 * Search covers the vehicle as a person names it, asset code or model, and the
 * summary, which is the line someone wrote about what is wrong. The work order
 * id matches too, for the same reason contracts allow it: the id is on screen
 * in the detail and in the fleet drawer.
 */
export function selectMaintenanceList(
  rows: MaintenanceRow[],
  query: MaintenanceListQuery
): MaintenanceListResult {
  const term = query.search.trim().toLowerCase();

  const matched = rows.filter((row) => {
    if (query.status !== "all" && row.status !== query.status) return false;
    if (query.priority !== "all" && row.priority !== query.priority) return false;
    if (!term) return true;
    return (
      (row.vehicleLabel ?? "").toLowerCase().includes(term) ||
      row.summary.toLowerCase().includes(term) ||
      row.id.toLowerCase().includes(term)
    );
  });

  const sign = query.direction === "desc" ? -1 : 1;
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

export function maintenanceStatusTally(rows: MaintenanceRow[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const row of rows) tally[row.status] = (tally[row.status] ?? 0) + 1;
  return tally;
}
