/**
 * Operations demo: what the Payments module shows, and to whom.
 *
 * Read-write for Admin and the Finance Analyst, closed to Sales and Fleet,
 * straight from the frozen matrix.
 *
 * The module's own rule is what it is not. This is accounting state, not a
 * payment terminal: there is no provider, no card field, no bank detail and no
 * button that says Pay. "Record payment" is the whole vocabulary, and it is
 * accurate, because recording is all that happens.
 */

import type { SortDirection } from "@/demo-runtime/types";

import { canViewModule, canWriteModule } from "../../permissions";
import type { PaymentSortKey } from "../../selectors/payments-list";
import type { PaymentCategory, PaymentEffectiveStatus, Role } from "../../types";

export function canOpenPayments(role: Role): boolean {
  return canViewModule(role, "Payments");
}

export function canWorkPayments(role: Role): boolean {
  return canWriteModule(role, "Payments");
}

/* Where a payment's relationships lead, per role (D-092). */
export const canOpenCustomer = (role: Role) => canViewModule(role, "Customers");
export const canOpenContracts = (role: Role) => canViewModule(role, "Contracts");

/* =====================================================================
   PRESENTATION
   ===================================================================== */

/**
 * The three effective states.
 *
 * Overdue is peach rather than red. A payment that has passed its due date is
 * an ordinary thing for a finance analyst to work through, not an incident,
 * and the word carries the meaning in any case. Paid is mint, Pending is the
 * quiet slate of something simply not due yet.
 */
export const STATUS_TONE: Record<PaymentEffectiveStatus, string> = {
  Paid: "mint",
  Pending: "slate",
  Overdue: "peach",
};

export const STATUS_OPTIONS: readonly {
  value: PaymentEffectiveStatus | "all";
  label: string;
}[] = [
  { value: "all", label: "All statuses" },
  { value: "Overdue", label: "Overdue" },
  { value: "Pending", label: "Pending" },
  { value: "Paid", label: "Paid" },
];

export const CATEGORY_OPTIONS: readonly { value: PaymentCategory | "all"; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "Rental", label: "Rental" },
  { value: "Deposit", label: "Deposit" },
  { value: "Adjustment", label: "Adjustment" },
];

export const PAYMENT_CATEGORIES: readonly PaymentCategory[] = [
  "Rental",
  "Deposit",
  "Adjustment",
];

/* =====================================================================
   SORT
   ===================================================================== */

export type PaymentSortChoice = {
  value: string;
  label: string;
  key: PaymentSortKey;
  direction: SortDirection;
};

const choice = (
  key: PaymentSortKey,
  direction: SortDirection,
  label: string
): PaymentSortChoice => ({ value: `${key}:${direction}`, label, key, direction });

export const SORT_CHOICES: readonly PaymentSortChoice[] = [
  choice("due", "asc", "Due date: earliest"),
  choice("due", "desc", "Due date: latest"),
  choice("amount", "desc", "Amount: highest"),
  choice("amount", "asc", "Amount: lowest"),
  choice("customer", "asc", "Customer: A to Z"),
  choice("customer", "desc", "Customer: Z to A"),
  choice("status", "asc", "Status: overdue first"),
  choice("status", "desc", "Status: settled first"),
];

export function sortValue(key: PaymentSortKey, direction: SortDirection): string {
  return `${key}:${direction}`;
}

export function parseSortValue(value: string): {
  key: PaymentSortKey;
  direction: SortDirection;
} {
  const hit = SORT_CHOICES.find((c) => c.value === value);
  return hit ? { key: hit.key, direction: hit.direction } : { key: "due", direction: "asc" };
}

const ROOT = "/demos/operations";

export const customerHref = (id: string) =>
  `${ROOT}/customers?selected=${encodeURIComponent(id)}`;
export const contractHref = (id: string) =>
  `${ROOT}/contracts?selected=${encodeURIComponent(id)}`;

export { formatCents } from "../../selectors/derive";
