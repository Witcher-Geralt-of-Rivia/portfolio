/**
 * Operations demo — derived state.
 *
 * The three values the specification refuses to let a form write directly:
 * a vehicle's status, a payment's overdue state, and a contract's total.
 * Each is computed from the records that actually determine it, so the demo
 * cannot end up showing a vehicle as Available while an active contract points
 * at it.
 *
 * Everything here is pure. No clock is read, no id is allocated, nothing is
 * persisted — callers pass the instant they are reasoning about, which is what
 * makes these functions testable and makes the results reproducible.
 */

import { DAY_MS, DAILY_RATE_CENTS } from "../constants";
import type {
  Contract,
  ContractBalance,
  Interval,
  MaintenanceWorkOrder,
  Payment,
  PaymentEffectiveStatus,
  Reservation,
  VehicleClass,
  VehicleStatus,
} from "../types";

/* =====================================================================
   1. INTERVALS

   One overlap helper, used by reservations, contracts and availability alike.
   Two slightly different versions is how a booking system ends up allowing a
   double-booking in exactly one code path.
   ===================================================================== */

/**
 * Do two half-open intervals overlap?
 *
 * Half-open — `[start, end)` — so a booking ending at 10:00 and one starting
 * at 10:00 do not collide. Back-to-back rentals are the normal case in this
 * domain, and treating them as a conflict would make the seed impossible to
 * build.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  const aStart = Date.parse(a.startAt);
  const aEnd = Date.parse(a.endAt);
  const bStart = Date.parse(b.startAt);
  const bEnd = Date.parse(b.endAt);
  return aStart < bEnd && bStart < aEnd;
}

/** Whether an instant falls inside a half-open interval. */
export function covers(interval: Interval, instant: string): boolean {
  const t = Date.parse(instant);
  return Date.parse(interval.startAt) <= t && t < Date.parse(interval.endAt);
}

/* =====================================================================
   2. VEHICLE STATUS
   ===================================================================== */

export type VehicleContext = {
  vehicleId: string;
  contracts: { id: string; data: Contract }[];
  reservations: { id: string; data: Reservation }[];
  workOrders: { id: string; data: MaintenanceWorkOrder }[];
};

/** A work order that currently occupies its vehicle. */
export function isActiveWorkOrder(w: MaintenanceWorkOrder): boolean {
  return w.status === "Open" || w.status === "In Progress";
}

/**
 * A vehicle's status, in the frozen precedence order.
 *
 * ```
 * 1  an active work order (Open or In Progress)   → Maintenance
 * 2  an Active contract                           → Rented
 * 3  a Confirmed reservation with this vehicle    → Reserved
 * 4  otherwise                                    → Available
 * ```
 *
 * Precedence rather than a set of independent flags, because the states are
 * genuinely ordered: a vehicle in the workshop is not available to rent even
 * if someone has reserved it, and a rented vehicle is not merely reserved.
 */
export function deriveVehicleStatus(ctx: VehicleContext): VehicleStatus {
  const mine = <T extends { vehicleId?: string }>(rows: { id: string; data: T }[]) =>
    rows.filter((r) => r.data.vehicleId === ctx.vehicleId);

  if (mine(ctx.workOrders).some((w) => isActiveWorkOrder(w.data))) return "Maintenance";
  if (mine(ctx.contracts).some((c) => c.data.status === "Active")) return "Rented";
  if (mine(ctx.reservations).some((r) => r.data.status === "Confirmed")) return "Reserved";
  return "Available";
}

/** The relationship pointers a vehicle record carries alongside its status. */
export function deriveVehicleLinks(ctx: VehicleContext): {
  currentContractId?: string;
  currentReservationId?: string;
  activeMaintenanceId?: string;
} {
  const mine = <T extends { vehicleId?: string }>(rows: { id: string; data: T }[]) =>
    rows.filter((r) => r.data.vehicleId === ctx.vehicleId);

  const work = mine(ctx.workOrders).find((w) => isActiveWorkOrder(w.data));
  const contract = mine(ctx.contracts).find((c) => c.data.status === "Active");
  const reservation = mine(ctx.reservations).find((r) => r.data.status === "Confirmed");

  return {
    ...(contract ? { currentContractId: contract.id } : {}),
    ...(reservation ? { currentReservationId: reservation.id } : {}),
    ...(work ? { activeMaintenanceId: work.id } : {}),
  };
}

/* =====================================================================
   3. PAYMENTS
   ===================================================================== */

/**
 * A payment's effective status (D-053).
 *
 * `Overdue` is never stored. Deriving it here means a payment cannot disagree
 * with the demo's own clock — the failure a persisted flag guarantees the
 * moment logical time moves past a due date.
 */
export function derivePaymentStatus(payment: Payment, now: string): PaymentEffectiveStatus {
  if (payment.status === "Paid") return "Paid";
  return Date.parse(payment.dueAt) < Date.parse(now) ? "Overdue" : "Pending";
}

export function requiresAttention(payment: Payment, now: string): boolean {
  const status = derivePaymentStatus(payment, now);
  return status === "Pending" || status === "Overdue";
}

/* =====================================================================
   4. CONTRACT MONEY

   Integer cents throughout (D-053). A balance is a running subtraction across
   several payments, which is exactly the pattern that accumulates
   floating-point drift.
   ===================================================================== */

/** Billable days: whole days, partial days rounded up, never fewer than one. */
export function billableDays(startAt: string, endAt: string): number {
  const ms = Date.parse(endAt) - Date.parse(startAt);
  return Math.max(1, Math.ceil(ms / DAY_MS));
}

export function contractTotalCents(dailyRateCents: number, startAt: string, endAt: string): number {
  return dailyRateCents * billableDays(startAt, endAt);
}

export function contractBalance(contract: Contract): ContractBalance {
  return {
    totalAmount: contract.totalAmount,
    paidAmount: contract.paidAmount,
    remainingBalance: contract.totalAmount - contract.paidAmount,
  };
}

/**
 * The deterministic daily rate for a vehicle, in cents.
 *
 * Spread across the class band by index rather than chosen arbitrarily, so the
 * same vehicle always costs the same and two resets produce identical
 * contracts.
 */
export function dailyRateForVehicle(vehicleClass: VehicleClass, index: number): number {
  const band = DAILY_RATE_CENTS[vehicleClass];
  const span = band.max - band.min;
  /* Steps of 100 cents keep the rates readable — 18.00, 19.00 — rather than
     landing on values no rental company would print. */
  const steps = Math.floor(span / 100) + 1;
  return band.min + (index % steps) * 100;
}

/** Presentation helper. Formatting belongs at the edge, but rounding does not. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
