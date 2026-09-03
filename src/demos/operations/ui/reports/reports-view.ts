/**
 * Operations demo: what the Reports module shows, and to whom.
 *
 * Read-only for Admin and the Finance Analyst. There is no mutation anywhere in
 * this module and no control that writes.
 *
 * The discipline worth stating: every headline number on this page is a count
 * or a sum of records the visitor can go and look at, and every share is
 * printed with the denominator it was taken over. There is no comparison to a
 * previous period, because the demo has one logical clock and no history to
 * compare against, and inventing "+12% on last month" would be the single
 * fastest way to make an otherwise honest product look like a mock-up.
 */

import { canViewModule } from "../../permissions";
import type {
  ContractStatus,
  MaintenancePriority,
  MaintenanceStatus,
  PaymentEffectiveStatus,
  ReservationStatus,
  Role,
  VehicleStatus,
} from "../../types";
import { REPORT_PERIODS, type ReportPeriod } from "../../constants";

export function canOpenReports(role: Role): boolean {
  return canViewModule(role, "Reports");
}

/* Where a report's subject lives, per role (D-092). A Finance Analyst can read
   Contracts and Customers but not Reservations, Fleet or Maintenance, so the
   panels about those stay figures rather than becoming doors. */
export const canOpenReservations = (role: Role) => canViewModule(role, "Reservations");
export const canOpenContracts = (role: Role) => canViewModule(role, "Contracts");
export const canOpenFleet = (role: Role) => canViewModule(role, "Fleet");
export const canOpenMaintenance = (role: Role) => canViewModule(role, "Maintenance");
export const canOpenPayments = (role: Role) => canViewModule(role, "Payments");
export const canOpenLeads = (role: Role) => canViewModule(role, "Leads");

/* =====================================================================
   PERIOD
   ===================================================================== */

/**
 * The frozen filter, and the only one.
 *
 * `REPORT_PERIODS` is part of the specification, so it is implemented; nothing
 * else is, and nothing else is added. A report builder is a different product.
 */
export const PERIOD_OPTIONS: readonly { value: ReportPeriod; label: string }[] =
  REPORT_PERIODS.map((p) => ({ value: p, label: p }));

export const DEFAULT_PERIOD: ReportPeriod = "All demo data";

/**
 * Which panels a period actually applies to.
 *
 * A lead, a contract, a reservation and a work order each have a moment of
 * origin, so a window over them means something. The fleet does not: a
 * vehicle's status is what it is now, and filtering a snapshot by a date range
 * would produce a number with no meaning at all. Said out loud on the page
 * rather than left for a reader to wonder about.
 */
export const SNAPSHOT_NOTE =
  "The fleet panel is a snapshot of the register as it stands, so the period filter does not apply to it.";

/* =====================================================================
   TONES
   ===================================================================== */

/* One vocabulary across the whole product: these are the same tones the
   modules themselves use, so a Rented bar and a Rented pill are the same
   colour on two different screens. */

export const VEHICLE_TONE: Record<VehicleStatus, string> = {
  Available: "mint",
  Reserved: "sky",
  Rented: "peach",
  Maintenance: "slate",
};

export const CONTRACT_TONE: Record<ContractStatus, string> = {
  Pending: "lavender",
  Active: "sky",
  Completed: "mint",
  Cancelled: "slate",
};

export const RESERVATION_TONE: Record<ReservationStatus, string> = {
  Draft: "slate",
  Confirmed: "sky",
  Converted: "mint",
  Cancelled: "slate",
};

export const PAYMENT_TONE: Record<PaymentEffectiveStatus, string> = {
  Paid: "mint",
  Pending: "slate",
  Overdue: "peach",
};

export const MAINTENANCE_TONE: Record<MaintenanceStatus, string> = {
  Open: "lavender",
  "In Progress": "sky",
  Completed: "mint",
  Cancelled: "slate",
};

export const PRIORITY_TONE: Record<MaintenancePriority, string> = {
  Routine: "quiet",
  Soon: "normal",
  High: "high",
};

const ROOT = "/demos/operations";

export const MODULE_HREF = {
  leads: `${ROOT}/leads`,
  reservations: `${ROOT}/reservations`,
  contracts: `${ROOT}/contracts`,
  fleet: `${ROOT}/fleet`,
  maintenance: `${ROOT}/maintenance`,
  payments: `${ROOT}/payments`,
} as const;

export { formatCents } from "../../selectors/derive";
