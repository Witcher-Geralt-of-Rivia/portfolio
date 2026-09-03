/**
 * Operations demo: what the Reservations module shows, and to whom.
 *
 * The policy table, in the shape `customers-view.ts` and `inbox-view.ts`
 * established: derived from `permissions.ts` rather than restated.
 *
 * Reservations is read-write for three of the four roles and closed to the
 * fourth, so there is no partly-visible composition to decide. What varies is
 * where a visitor may go from here: Customers is built and Fleet is not, so a
 * customer becomes a link and a vehicle stays a fact.
 */

import { canViewModule, canWriteModule } from "../../permissions";
import type { ReservationStatus, Role, VehicleClass } from "../../types";
import type { ReservationSortKey } from "../../selectors/reservations-list";
import type { SortDirection } from "@/demo-runtime/types";

export function canOpenReservations(role: Role): boolean {
  return canViewModule(role, "Reservations");
}

export function canWorkReservations(role: Role): boolean {
  return canWriteModule(role, "Reservations");
}

/**
 * Whether the customer behind a reservation may be opened.
 *
 * A Fleet Coordinator cannot open Customers, so they get the name and no link.
 * The name is not the link: withholding it would leave them unable to do
 * reservations work, which is squarely theirs to do (D-092).
 */
export function canOpenCustomer(role: Role): boolean {
  return canViewModule(role, "Customers");
}

/** Only for roles that work the Inbox, and only once a conversation exists. */
export function canOpenInbox(role: Role): boolean {
  return canViewModule(role, "Inbox");
}

/**
 * Fleet and Contracts exist now.
 *
 * When this module shipped, both were unbuilt, so the assigned vehicle and the
 * converted contract were rendered as plain facts and D-092 recorded that they
 * would become links once there was somewhere for them to go. This is that
 * change, and nothing else about the rule moved: the Sales Agent cannot open
 * Fleet, so they still read the vehicle as a fact.
 */
export function canOpenFleet(role: Role): boolean {
  return canViewModule(role, "Fleet");
}

export function canOpenContracts(role: Role): boolean {
  return canViewModule(role, "Contracts");
}

/* =====================================================================
   PRESENTATION
   ===================================================================== */

/**
 * Draft is unfinished work, Confirmed is a live hold, Converted is done and
 * Cancelled is colourless.
 *
 * Cancelled is deliberately not a warning tone. A cancelled booking is an
 * ordinary outcome of running a rental desk, not a fault, which is the same
 * reasoning that kept a lost lead grey.
 */
export const STATUS_TONE: Record<ReservationStatus, string> = {
  Draft: "slate",
  Confirmed: "sky",
  Converted: "mint",
  Cancelled: "slate",
};

export const VEHICLE_CLASSES: readonly VehicleClass[] = ["Urban", "Touring", "Utility"];

export const STATUS_OPTIONS: readonly { value: ReservationStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Draft", label: "Draft" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Converted", label: "Converted" },
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

export type ReservationSortChoice = {
  value: string;
  label: string;
  key: ReservationSortKey;
  direction: SortDirection;
};

const choice = (
  key: ReservationSortKey,
  direction: SortDirection,
  label: string
): ReservationSortChoice => ({ value: `${key}:${direction}`, label, key, direction });

/** Field and direction as one choice, worded for the field (D-069). */
export const SORT_CHOICES: readonly ReservationSortChoice[] = [
  choice("start", "asc", "Start date: earliest"),
  choice("start", "desc", "Start date: latest"),
  choice("updated", "desc", "Updated: newest"),
  choice("updated", "asc", "Updated: oldest"),
  choice("customer", "asc", "Customer: A to Z"),
  choice("customer", "desc", "Customer: Z to A"),
  choice("status", "asc", "Status: Draft first"),
  choice("status", "desc", "Status: Cancelled first"),
];

export function sortValue(key: ReservationSortKey, direction: SortDirection): string {
  return `${key}:${direction}`;
}

export function parseSortValue(value: string): {
  key: ReservationSortKey;
  direction: SortDirection;
} {
  const hit = SORT_CHOICES.find((c) => c.value === value);
  return hit ? { key: hit.key, direction: hit.direction } : { key: "start", direction: "asc" };
}

/* =====================================================================
   ACTIONS
   ===================================================================== */

/**
 * Which lifecycle actions a reservation currently offers.
 *
 * Derived from the status the domain already enforces, so the interface never
 * shows a control the service would refuse. The service stays the authority:
 * this decides what to render, not what is legal.
 */
export function actionsFor(status: ReservationStatus): {
  edit: boolean;
  confirm: boolean;
  convert: boolean;
  cancel: boolean;
} {
  return {
    edit: status === "Draft",
    confirm: status === "Draft",
    convert: status === "Confirmed",
    cancel: status === "Draft" || status === "Confirmed",
  };
}

const ROOT = "/demos/operations";

export const customerHref = (id: string) =>
  `${ROOT}/customers?selected=${encodeURIComponent(id)}`;
export const conversationHref = (id: string) =>
  `${ROOT}/inbox?selected=${encodeURIComponent(id)}`;
export const vehicleHref = (id: string) => `${ROOT}/fleet?selected=${encodeURIComponent(id)}`;
export const contractHref = (id: string) =>
  `${ROOT}/contracts?selected=${encodeURIComponent(id)}`;
