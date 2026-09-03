/**
 * Operations demo: what the Contracts module shows, and to whom.
 *
 * The policy table, in the shape the earlier modules established: derived from
 * `permissions.ts` rather than restated.
 *
 * Contracts is the first module in this product where the read/write split
 * actually bites. Every role can see a contract; only Admin can move one. So
 * three of the four roles get a complete, honest, entirely inert record, and
 * nothing about it is hidden to signal that they cannot act on it.
 */

import type { SortDirection } from "@/demo-runtime/types";

import { canViewModule, canWriteModule } from "../../permissions";
import type { ContractSortKey } from "../../selectors/contracts-list";
import type { ContractStatus, Role, VehicleClass } from "../../types";

export function canOpenContracts(role: Role): boolean {
  return canViewModule(role, "Contracts");
}

export function canWorkContracts(role: Role): boolean {
  return canWriteModule(role, "Contracts");
}

/* Where a contract's relationships lead, per role (D-092). */
export const canOpenCustomer = (role: Role) => canViewModule(role, "Customers");
export const canOpenReservations = (role: Role) => canViewModule(role, "Reservations");
export const canOpenFleet = (role: Role) => canViewModule(role, "Fleet");

/* =====================================================================
   PRESENTATION
   ===================================================================== */

/**
 * Active is the live state and gets the strongest tone. Pending is work that
 * has not started, Completed is done, and Cancelled is grey rather than a
 * warning: a contract that did not go ahead is an ordinary outcome, the same
 * reasoning that kept a lost lead and a cancelled reservation colourless.
 */
export const STATUS_TONE: Record<ContractStatus, string> = {
  Pending: "lavender",
  Active: "sky",
  Completed: "mint",
  Cancelled: "slate",
};

export const STATUS_OPTIONS: readonly { value: ContractStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Pending", label: "Pending" },
  { value: "Active", label: "Active" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

export const CLASS_OPTIONS: readonly { value: VehicleClass | "all"; label: string }[] = [
  { value: "all", label: "All classes" },
  { value: "Urban", label: "Urban" },
  { value: "Touring", label: "Touring" },
  { value: "Utility", label: "Utility" },
];

/* =====================================================================
   SORT
   ===================================================================== */

export type ContractSortChoice = {
  value: string;
  label: string;
  key: ContractSortKey;
  direction: SortDirection;
};

const choice = (
  key: ContractSortKey,
  direction: SortDirection,
  label: string
): ContractSortChoice => ({ value: `${key}:${direction}`, label, key, direction });

/** Field and direction as one choice, worded for the field (D-069). */
export const SORT_CHOICES: readonly ContractSortChoice[] = [
  choice("start", "desc", "Start date: latest"),
  choice("start", "asc", "Start date: earliest"),
  choice("updated", "desc", "Updated: newest"),
  choice("updated", "asc", "Updated: oldest"),
  choice("customer", "asc", "Customer: A to Z"),
  choice("customer", "desc", "Customer: Z to A"),
  choice("balance", "desc", "Balance: highest"),
  choice("balance", "asc", "Balance: lowest"),
  choice("status", "asc", "Status: Active first"),
  choice("status", "desc", "Status: Cancelled first"),
];

export function sortValue(key: ContractSortKey, direction: SortDirection): string {
  return `${key}:${direction}`;
}

export function parseSortValue(value: string): {
  key: ContractSortKey;
  direction: SortDirection;
} {
  const hit = SORT_CHOICES.find((c) => c.value === value);
  return hit ? { key: hit.key, direction: hit.direction } : { key: "start", direction: "desc" };
}

/* =====================================================================
   ACTIONS
   ===================================================================== */

/**
 * Which lifecycle actions a contract currently offers.
 *
 * Read straight off the transition rules the services already enforce, so the
 * interface never draws a control the domain would refuse: `activateContract`
 * accepts only Pending, `completeContract` only Active, and `cancelContract`
 * refuses Completed and Cancelled and therefore accepts both of the others.
 *
 * The service stays the authority. This decides what to render, not what is
 * legal, and a contract that changes underneath the drawer still gets the
 * service's own refusal rather than a lie from this table.
 */
export function actionsFor(status: ContractStatus): {
  activate: boolean;
  complete: boolean;
  cancel: boolean;
} {
  return {
    activate: status === "Pending",
    complete: status === "Active",
    cancel: status === "Pending" || status === "Active",
  };
}

const ROOT = "/demos/operations";

export const customerHref = (id: string) =>
  `${ROOT}/customers?selected=${encodeURIComponent(id)}`;
export const reservationHref = (id: string) =>
  `${ROOT}/reservations?selected=${encodeURIComponent(id)}`;
export const vehicleHref = (id: string) => `${ROOT}/fleet?selected=${encodeURIComponent(id)}`;

/** `USD 1234.56`, the money grammar the Overview and Customers already use. */
export { formatCents } from "../../selectors/derive";
