/**
 * Operations demo: what the Fleet module shows, and to whom.
 *
 * Read-write for Admin and the Fleet Coordinator, closed to Sales and Finance,
 * straight from the frozen matrix.
 *
 * The module's own rule is what a form may touch. A vehicle has seven stored
 * fields and three of them are editable; the other four are the cached
 * derivation, and a control that wrote one would put the demo back into the
 * state `deriveVehicleStatus` exists to make impossible.
 */

import type { SortDirection } from "@/demo-runtime/types";

import { MODELS_BY_CLASS } from "../../constants";
import { canViewModule, canWriteModule } from "../../permissions";
import type { FleetSortKey } from "../../selectors/fleet-list";
import type { ModelLabel, Role, VehicleClass, VehicleStatus } from "../../types";

export function canOpenFleet(role: Role): boolean {
  return canViewModule(role, "Fleet");
}

export function canWorkFleet(role: Role): boolean {
  return canWriteModule(role, "Fleet");
}

/* Where a vehicle's relationships lead, per role (D-092). */
export const canOpenReservations = (role: Role) => canViewModule(role, "Reservations");
export const canOpenContracts = (role: Role) => canViewModule(role, "Contracts");
export const canOpenMaintenance = (role: Role) => canViewModule(role, "Maintenance");

/* =====================================================================
   PRESENTATION
   ===================================================================== */

/**
 * The four derived states.
 *
 * Available is the good one and reads mint. Rented and Reserved are both
 * "occupied" and are deliberately different tones, because reading one as the
 * other is what double-books a vehicle. Maintenance is grey: a machine in the
 * workshop is planned work, not a fault, and the status word carries the
 * meaning in any case.
 */
export const STATUS_TONE: Record<VehicleStatus, string> = {
  Available: "mint",
  Reserved: "sky",
  Rented: "peach",
  Maintenance: "slate",
};

export const STATUS_OPTIONS: readonly { value: VehicleStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Available", label: "Available" },
  { value: "Reserved", label: "Reserved" },
  { value: "Rented", label: "Rented" },
  { value: "Maintenance", label: "Maintenance" },
];

export const CLASS_OPTIONS: readonly { value: VehicleClass | "all"; label: string }[] = [
  { value: "all", label: "All classes" },
  { value: "Urban", label: "Urban" },
  { value: "Touring", label: "Touring" },
  { value: "Utility", label: "Utility" },
];

export const VEHICLE_CLASSES: readonly VehicleClass[] = ["Urban", "Touring", "Utility"];

/**
 * The models a class may carry.
 *
 * The same table the service validates against, read by the form so the choice
 * offered and the choice accepted cannot drift apart. The form narrows the
 * options; the service still refuses a bad pair, because a form is one caller.
 */
export function modelsFor(vehicleClass: VehicleClass): readonly ModelLabel[] {
  return MODELS_BY_CLASS[vehicleClass];
}

/* =====================================================================
   SORT
   ===================================================================== */

export type FleetSortChoice = {
  value: string;
  label: string;
  key: FleetSortKey;
  direction: SortDirection;
};

const choice = (
  key: FleetSortKey,
  direction: SortDirection,
  label: string
): FleetSortChoice => ({ value: `${key}:${direction}`, label, key, direction });

export const SORT_CHOICES: readonly FleetSortChoice[] = [
  choice("asset", "asc", "Asset code: MTR-001 first"),
  choice("asset", "desc", "Asset code: newest first"),
  choice("odometer", "asc", "Odometer: lowest"),
  choice("odometer", "desc", "Odometer: highest"),
  choice("status", "asc", "Status: in use first"),
  choice("status", "desc", "Status: available first"),
  choice("model", "asc", "Model: A to Z"),
  choice("model", "desc", "Model: Z to A"),
];

export function sortValue(key: FleetSortKey, direction: SortDirection): string {
  return `${key}:${direction}`;
}

export function parseSortValue(value: string): { key: FleetSortKey; direction: SortDirection } {
  const hit = SORT_CHOICES.find((c) => c.value === value);
  return hit ? { key: hit.key, direction: hit.direction } : { key: "asset", direction: "asc" };
}

const ROOT = "/demos/operations";

export const reservationHref = (id: string) =>
  `${ROOT}/reservations?selected=${encodeURIComponent(id)}`;
export const contractHref = (id: string) =>
  `${ROOT}/contracts?selected=${encodeURIComponent(id)}`;
export const maintenanceHref = (id: string) =>
  `${ROOT}/maintenance?selected=${encodeURIComponent(id)}`;
