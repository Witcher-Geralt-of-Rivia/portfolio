/**
 * Operations demo: what the Maintenance module shows, and to whom.
 *
 * Read-write for Admin and the Fleet Coordinator, closed to Sales and Finance.
 *
 * The tone table is the part worth reading. Nothing in a maintenance queue is
 * an emergency here: High means "before the others", and giving it a red badge
 * would make a routine inspection list look like an incident board. The word is
 * the signal; the colour only groups.
 */

import type { SortDirection } from "@/demo-runtime/types";

import { canViewModule, canWriteModule } from "../../permissions";
import type { MaintenanceSortKey } from "../../selectors/maintenance-list";
import type {
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceType,
  Role,
} from "../../types";

export function canOpenMaintenance(role: Role): boolean {
  return canViewModule(role, "Maintenance");
}

export function canWorkMaintenance(role: Role): boolean {
  return canWriteModule(role, "Maintenance");
}

/** Fleet is built, so a work order's vehicle is a link for a role that has it. */
export const canOpenFleet = (role: Role) => canViewModule(role, "Fleet");

/* =====================================================================
   PRESENTATION
   ===================================================================== */

/**
 * In Progress is the live state and reads sky. Open is waiting, Completed is
 * done, Cancelled is grey. None of the four is a warning tone, because none of
 * the four is a fault.
 */
export const STATUS_TONE: Record<MaintenanceStatus, string> = {
  Open: "lavender",
  "In Progress": "sky",
  Completed: "mint",
  Cancelled: "slate",
};

/**
 * Priority, as a quiet chip rather than a badge.
 *
 * The same three-step vocabulary the Leads module uses for its own priority:
 * quiet, normal, high. `high` is a weight, not an alarm, and it is rendered in
 * the same soft family as everything else on the page.
 */
export const PRIORITY_TONE: Record<MaintenancePriority, string> = {
  Routine: "quiet",
  Soon: "normal",
  High: "high",
};

export const STATUS_OPTIONS: readonly { value: MaintenanceStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Open", label: "Open" },
  { value: "In Progress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

export const PRIORITY_OPTIONS: readonly {
  value: MaintenancePriority | "all";
  label: string;
}[] = [
  { value: "all", label: "All priorities" },
  { value: "Routine", label: "Routine" },
  { value: "Soon", label: "Soon" },
  { value: "High", label: "High" },
];

export const MAINTENANCE_TYPES: readonly MaintenanceType[] = [
  "Inspection",
  "Preventive",
  "Repair",
];

export const MAINTENANCE_PRIORITIES: readonly MaintenancePriority[] = [
  "Routine",
  "Soon",
  "High",
];

/* =====================================================================
   SORT
   ===================================================================== */

export type MaintenanceSortChoice = {
  value: string;
  label: string;
  key: MaintenanceSortKey;
  direction: SortDirection;
};

const choice = (
  key: MaintenanceSortKey,
  direction: SortDirection,
  label: string
): MaintenanceSortChoice => ({ value: `${key}:${direction}`, label, key, direction });

export const SORT_CHOICES: readonly MaintenanceSortChoice[] = [
  choice("opened", "desc", "Opened: newest"),
  choice("opened", "asc", "Opened: oldest"),
  choice("priority", "desc", "Priority: High first"),
  choice("priority", "asc", "Priority: Routine first"),
  choice("status", "asc", "Status: in progress first"),
  choice("status", "desc", "Status: cancelled first"),
  choice("vehicle", "asc", "Vehicle: MTR-001 first"),
  choice("updated", "desc", "Updated: newest"),
];

export function sortValue(key: MaintenanceSortKey, direction: SortDirection): string {
  return `${key}:${direction}`;
}

export function parseSortValue(value: string): {
  key: MaintenanceSortKey;
  direction: SortDirection;
} {
  const hit = SORT_CHOICES.find((c) => c.value === value);
  return hit ? { key: hit.key, direction: hit.direction } : { key: "opened", direction: "desc" };
}

/* =====================================================================
   ACTIONS
   ===================================================================== */

/**
 * Which actions a work order currently offers.
 *
 * `startMaintenance` accepts only Open, `completeMaintenance` only In Progress,
 * and `cancelMaintenance` refuses Completed and Cancelled and so accepts both
 * of the others. The service stays the authority; this decides what to draw.
 *
 * Starting is offered on any Open work order, including one whose vehicle is
 * out on an active rental. The domain refuses that case and says why, and
 * hiding the control instead would leave a visitor unable to discover the rule
 * that the module exists to demonstrate.
 */
export function actionsFor(status: MaintenanceStatus): {
  start: boolean;
  complete: boolean;
  cancel: boolean;
} {
  return {
    start: status === "Open",
    complete: status === "In Progress",
    cancel: status === "Open" || status === "In Progress",
  };
}

const ROOT = "/demos/operations";

export const vehicleHref = (id: string) => `${ROOT}/fleet?selected=${encodeURIComponent(id)}`;
