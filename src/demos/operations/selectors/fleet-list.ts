/**
 * Operations demo: the Fleet list.
 *
 * A vehicle's status is derived, and this list shows the stored cache of that
 * derivation exactly as persisted: rendering a second, independently computed
 * status here would create the disagreement the whole derived-state contract
 * exists to prevent.
 *
 * What this file does add is the sentence next to the status. "Rented" is a
 * state; "Rented to Alina Danforth" is the answer to why the machine is not on
 * the forecourt, and the join that produces it is exactly the join a person
 * would otherwise do by hand across three other modules.
 */

import type { DemoRecord, SortDirection } from "@/demo-runtime/types";

import { DEFAULT_PAGE_SIZE } from "../constants";
import type {
  Contract,
  Customer,
  MaintenanceWorkOrder,
  Reservation,
  Vehicle,
  VehicleClass,
  VehicleStatus,
} from "../types";

/* =====================================================================
   QUERY
   ===================================================================== */

export type FleetSortKey = "asset" | "odometer" | "status" | "model";

export type FleetListQuery = {
  search: string;
  status: VehicleStatus | "all";
  vehicleClass: VehicleClass | "all";
  sort: FleetSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
};

/**
 * The frozen default: asset code ascending.
 *
 * A fleet list is a register. People look things up in it by the code painted
 * on the machine, and a register that reorders itself by recency is one you
 * cannot scan.
 */
export const DEFAULT_FLEET_QUERY: FleetListQuery = {
  search: "",
  status: "all",
  vehicleClass: "all",
  sort: "asset",
  direction: "asc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function isDefaultFleetQuery(query: FleetListQuery): boolean {
  return query.search.trim() === "" && query.status === "all" && query.vehicleClass === "all";
}

/* =====================================================================
   ROWS
   ===================================================================== */

export type FleetRow = {
  id: string;
  assetCode: string;
  modelLabel: string;
  vehicleClass: VehicleClass;
  /** The stored status, which is the cached derivation. Never recomputed here. */
  status: VehicleStatus;
  odometerKm: number;
  serviceArea: string;
  currentContractId: string | null;
  currentReservationId: string | null;
  activeMaintenanceId: string | null;
  /** Why the vehicle is in that state, in words. Null when it is simply free. */
  assignment: string | null;
  updatedAt: string;
};

export type FleetWorld = {
  vehicles: DemoRecord<Vehicle>[];
  contracts: DemoRecord<Contract>[];
  reservations: DemoRecord<Reservation>[];
  workOrders: DemoRecord<MaintenanceWorkOrder>[];
  customers: DemoRecord<Customer>[];
};

export type FleetListResult = {
  items: FleetRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

/**
 * The one-line answer to "what is this vehicle doing".
 *
 * Built from the pointers the vehicle already carries, in the same precedence
 * the status derivation uses, so the sentence and the pill can never describe
 * two different situations.
 *
 * The customer's name appears here for every role that can open Fleet,
 * including the Fleet Coordinator who cannot open Customers. Withholding the
 * name would leave them unable to say who has the machine, which is squarely
 * their job; what they do not get is the link (D-092).
 */
function assignmentOf(
  vehicle: DemoRecord<Vehicle>,
  world: FleetWorld,
  customerName: (customerId: string) => string
): string | null {
  const v = vehicle.data;

  if (v.activeMaintenanceId) {
    const work = world.workOrders.find((w) => w.id === v.activeMaintenanceId);
    return work ? `${work.data.type} work order` : "In the workshop";
  }
  if (v.currentContractId) {
    const contract = world.contracts.find((c) => c.id === v.currentContractId);
    return contract ? `Out with ${customerName(contract.data.customerId)}` : "On an active contract";
  }
  if (v.currentReservationId) {
    const reservation = world.reservations.find((r) => r.id === v.currentReservationId);
    return reservation
      ? `Held for ${customerName(reservation.data.customerId)}`
      : "Held by a confirmed reservation";
  }
  return null;
}

export function buildFleetRows(world: FleetWorld): FleetRow[] {
  const customerById = new Map(world.customers.map((c) => [c.id, c]));
  const nameOf = (id: string) => customerById.get(id)?.data.displayName ?? "Unknown customer";

  return world.vehicles.map((vehicle) => ({
    id: vehicle.id,
    assetCode: vehicle.data.assetCode,
    modelLabel: vehicle.data.modelLabel,
    vehicleClass: vehicle.data.vehicleClass,
    status: vehicle.data.status,
    odometerKm: vehicle.data.odometerKm,
    serviceArea: vehicle.data.serviceArea,
    currentContractId: vehicle.data.currentContractId ?? null,
    currentReservationId: vehicle.data.currentReservationId ?? null,
    activeMaintenanceId: vehicle.data.activeMaintenanceId ?? null,
    assignment: assignmentOf(vehicle, world, nameOf),
    updatedAt: vehicle.updatedAt,
  }));
}

/** Occupied first, free last: the order a dispatcher reads the register in. */
const STATUS_RANK: Record<VehicleStatus, number> = {
  Rented: 0,
  Reserved: 1,
  Maintenance: 2,
  Available: 3,
};

function compareOn(key: FleetSortKey, a: FleetRow, b: FleetRow): number {
  switch (key) {
    case "odometer":
      return a.odometerKm - b.odometerKm;
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case "model":
      return a.modelLabel.localeCompare(b.modelLabel);
    case "asset":
    default:
      return a.assetCode.localeCompare(b.assetCode);
  }
}

/**
 * Filter, order and page the fleet register.
 *
 * Search covers the two things painted on a machine or written on a worksheet:
 * its asset code and its model. The record id is deliberately not searchable
 * here, because a visitor never sees `vehicle_0007` in this module: the asset
 * code is the identity, which is the whole point of generating one.
 */
export function selectFleetList(rows: FleetRow[], query: FleetListQuery): FleetListResult {
  const term = query.search.trim().toLowerCase();

  const matched = rows.filter((row) => {
    if (query.status !== "all" && row.status !== query.status) return false;
    if (query.vehicleClass !== "all" && row.vehicleClass !== query.vehicleClass) return false;
    if (!term) return true;
    return (
      row.assetCode.toLowerCase().includes(term) || row.modelLabel.toLowerCase().includes(term)
    );
  });

  const sign = query.direction === "desc" ? -1 : 1;
  const sorted = [...matched].sort((a, b) => {
    const primary = compareOn(query.sort, a, b);
    return primary !== 0 ? sign * primary : a.assetCode.localeCompare(b.assetCode);
  });

  const total = sorted.length;
  const pageSize = query.pageSize > 0 ? Math.floor(query.pageSize) : total;
  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const page = Math.min(Math.max(1, Math.floor(query.page)), pageCount);
  const items = pageSize > 0 ? sorted.slice((page - 1) * pageSize, page * pageSize) : sorted;

  return { items, total, page, pageSize: pageSize || total, pageCount };
}

export function fleetStatusTally(rows: FleetRow[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const row of rows) tally[row.status] = (tally[row.status] ?? 0) + 1;
  return tally;
}

/** `12,480 km`, grouped so a six-figure reading is still readable at a glance. */
export function formatOdometer(km: number): string {
  return `${km.toLocaleString("en-US")} km`;
}
