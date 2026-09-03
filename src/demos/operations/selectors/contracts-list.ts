/**
 * Operations demo: the Contracts list.
 *
 * A contract names a customer and a vehicle and neither name is on the record,
 * so this is the join: both are resolved once for the whole page, and search
 * then looks at what a person actually sees rather than at raw ids.
 *
 * The sibling of `reservations-list.ts` in shape and in reasoning. Money is
 * carried in integer cents exactly as stored and formatted at the edge, so the
 * balance a row shows is a subtraction the domain did, not one a component
 * invented.
 */

import type { DemoRecord, SortDirection } from "@/demo-runtime/types";

import { DEFAULT_PAGE_SIZE } from "../constants";
import type {
  Contract,
  ContractStatus,
  Customer,
  Vehicle,
  VehicleClass,
} from "../types";
import { vehicleLabelOf } from "./reservations-list";

/* =====================================================================
   QUERY
   ===================================================================== */

export type ContractSortKey = "start" | "updated" | "customer" | "status" | "balance";

export type ContractListQuery = {
  search: string;
  status: ContractStatus | "all";
  vehicleClass: VehicleClass | "all";
  sort: ContractSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
};

/**
 * The frozen default: the most recently started rental first.
 *
 * A contracts list is read to answer "what is running", and the newest start is
 * the top of that. Reservations sorts the other way because it answers "what is
 * coming up", which is a different question about a different tense.
 */
export const DEFAULT_CONTRACT_QUERY: ContractListQuery = {
  search: "",
  status: "all",
  vehicleClass: "all",
  sort: "start",
  direction: "desc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function isDefaultContractQuery(query: ContractListQuery): boolean {
  return query.search.trim() === "" && query.status === "all" && query.vehicleClass === "all";
}

/* =====================================================================
   ROWS
   ===================================================================== */

export type ContractRow = {
  id: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  /** `MTR-004 Metro 125`, or null if the vehicle cannot be resolved. */
  vehicleLabel: string | null;
  vehicleClass: VehicleClass | null;
  reservationId: string | null;
  status: ContractStatus;
  startAt: string;
  endAt: string;
  /** Integer cents, all four. Formatting happens in the component. */
  dailyRate: number;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  updatedAt: string;
};

export type ContractWorld = {
  contracts: DemoRecord<Contract>[];
  customers: DemoRecord<Customer>[];
  vehicles: DemoRecord<Vehicle>[];
};

export type ContractListResult = {
  items: ContractRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function buildContractRows(world: ContractWorld): ContractRow[] {
  const customerById = new Map(world.customers.map((c) => [c.id, c]));
  const vehicleById = new Map(world.vehicles.map((v) => [v.id, v]));

  return world.contracts.map((contract) => {
    const customer = customerById.get(contract.data.customerId) ?? null;
    const vehicle = vehicleById.get(contract.data.vehicleId) ?? null;

    return {
      id: contract.id,
      customerId: contract.data.customerId,
      /* A record whose customer cannot be resolved says so rather than
         throwing: local state can be reset, not repaired, and a row that
         renders is a row someone can act on. */
      customerName: customer?.data.displayName ?? "Unknown customer",
      vehicleId: contract.data.vehicleId,
      vehicleLabel: vehicle ? vehicleLabelOf(vehicle) : null,
      vehicleClass: vehicle?.data.vehicleClass ?? null,
      reservationId: contract.data.reservationId ?? null,
      status: contract.data.status,
      startAt: contract.data.startAt,
      endAt: contract.data.endAt,
      dailyRate: contract.data.dailyRate,
      totalAmount: contract.data.totalAmount,
      paidAmount: contract.data.paidAmount,
      remainingBalance: contract.data.totalAmount - contract.data.paidAmount,
      updatedAt: contract.updatedAt,
    };
  });
}

/** Live first, then the rest in lifecycle order. */
const STATUS_RANK: Record<ContractStatus, number> = {
  Active: 0,
  Pending: 1,
  Completed: 2,
  Cancelled: 3,
};

function compareOn(key: ContractSortKey, a: ContractRow, b: ContractRow): number {
  switch (key) {
    case "customer":
      return a.customerName.localeCompare(b.customerName);
    case "updated":
      return a.updatedAt.localeCompare(b.updatedAt);
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case "balance":
      return a.remainingBalance - b.remainingBalance;
    case "start":
    default:
      return a.startAt.localeCompare(b.startAt);
  }
}

/**
 * Filter, order and page the contract list.
 *
 * Search covers what the row shows: the customer's name and the vehicle's asset
 * code and model. It also matches the contract id, because the id is on screen
 * in the detail and is what a reservation's drawer hands a visitor, so someone
 * holding one should be able to find it.
 */
export function selectContractList(
  rows: ContractRow[],
  query: ContractListQuery
): ContractListResult {
  const term = query.search.trim().toLowerCase();

  const matched = rows.filter((row) => {
    if (query.status !== "all" && row.status !== query.status) return false;
    if (query.vehicleClass !== "all" && row.vehicleClass !== query.vehicleClass) return false;
    if (!term) return true;
    return (
      row.customerName.toLowerCase().includes(term) ||
      (row.vehicleLabel ?? "").toLowerCase().includes(term) ||
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

/** How many rows each status holds, for the filter's live counts. */
export function contractStatusTally(rows: ContractRow[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const row of rows) tally[row.status] = (tally[row.status] ?? 0) + 1;
  return tally;
}
