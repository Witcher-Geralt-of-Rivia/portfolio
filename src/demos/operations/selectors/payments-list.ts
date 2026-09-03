/**
 * Operations demo: the Payments list.
 *
 * A payment names a contract and a customer by id and carries a stored status
 * that is only two thirds of the truth. `Overdue` is never persisted (D-053):
 * it is what `derivePaymentStatus` says when the logical clock has passed a
 * due date, and this list filters and sorts on that derived value, because it
 * is the one a person is actually asking about.
 *
 * Money stays in integer cents all the way through here. Formatting happens at
 * the edge, in the component, the same way Contracts does it.
 */

import type { DemoRecord, SortDirection } from "@/demo-runtime/types";

import { DEFAULT_PAGE_SIZE } from "../constants";
import { derivePaymentStatus } from "./derive";
import type {
  Contract,
  Customer,
  Payment,
  PaymentCategory,
  PaymentEffectiveStatus,
} from "../types";

/* =====================================================================
   QUERY
   ===================================================================== */

export type PaymentSortKey = "due" | "amount" | "customer" | "status";

export type PaymentListQuery = {
  search: string;
  status: PaymentEffectiveStatus | "all";
  category: PaymentCategory | "all";
  sort: PaymentSortKey;
  direction: SortDirection;
  page: number;
  pageSize: number;
};

/**
 * The frozen default: the oldest due date first.
 *
 * A payments list is read to answer "what is outstanding", and the thing that
 * fell due longest ago is the top of that. Sorting by amount would put the
 * biggest invoice above the one that is three weeks late, which is the wrong
 * order for the question.
 */
export const DEFAULT_PAYMENT_QUERY: PaymentListQuery = {
  search: "",
  status: "all",
  category: "all",
  sort: "due",
  direction: "asc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function isDefaultPaymentQuery(query: PaymentListQuery): boolean {
  return query.search.trim() === "" && query.status === "all" && query.category === "all";
}

/* =====================================================================
   ROWS
   ===================================================================== */

export type PaymentRow = {
  id: string;
  customerId: string;
  customerName: string;
  contractId: string;
  /** Integer cents. */
  amount: number;
  category: PaymentCategory;
  /** What is persisted: only ever Pending or Paid. */
  storedStatus: Payment["status"];
  /** What the clock says: Pending, Paid or Overdue. Never stored. */
  effectiveStatus: PaymentEffectiveStatus;
  dueAt: string;
  paidAt: string | null;
  /** How the contract this payment belongs to is doing, for context. */
  contractStatus: Contract["status"] | null;
  updatedAt: string;
};

export type PaymentWorld = {
  payments: DemoRecord<Payment>[];
  customers: DemoRecord<Customer>[];
  contracts: DemoRecord<Contract>[];
  /** The logical clock. Never `Date.now()`: the demo runs at a fixed instant. */
  now: string;
};

export type PaymentListResult = {
  items: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export function buildPaymentRows(world: PaymentWorld): PaymentRow[] {
  const customerById = new Map(world.customers.map((c) => [c.id, c]));
  const contractById = new Map(world.contracts.map((c) => [c.id, c]));

  return world.payments.map((payment) => {
    const customer = customerById.get(payment.data.customerId) ?? null;
    const contract = contractById.get(payment.data.contractId) ?? null;

    return {
      id: payment.id,
      customerId: payment.data.customerId,
      customerName: customer?.data.displayName ?? "Unknown customer",
      contractId: payment.data.contractId,
      amount: payment.data.amount,
      category: payment.data.category,
      storedStatus: payment.data.status,
      effectiveStatus: derivePaymentStatus(payment.data, world.now),
      dueAt: payment.data.dueAt,
      paidAt: payment.data.paidAt ?? null,
      contractStatus: contract?.data.status ?? null,
      updatedAt: payment.updatedAt,
    };
  });
}

/** Overdue first, then what is still owed, then what is settled. */
const STATUS_RANK: Record<PaymentEffectiveStatus, number> = {
  Overdue: 0,
  Pending: 1,
  Paid: 2,
};

function compareOn(key: PaymentSortKey, a: PaymentRow, b: PaymentRow): number {
  switch (key) {
    case "amount":
      return a.amount - b.amount;
    case "customer":
      return a.customerName.localeCompare(b.customerName);
    case "status":
      return STATUS_RANK[a.effectiveStatus] - STATUS_RANK[b.effectiveStatus];
    case "due":
    default:
      return a.dueAt.localeCompare(b.dueAt);
  }
}

/**
 * Filter, order and page the payment list.
 *
 * The status filter reads the derived status, not the stored one. A visitor
 * asking for overdue payments is asking a question about the clock, and
 * filtering on `payment.status` would answer a different question and return
 * nothing, because Overdue is never written down.
 *
 * Search covers the customer's name and the contract id, which are the two
 * handles a person arrives holding. The payment id matches too, for the same
 * reason the other modules allow it.
 */
export function selectPaymentList(
  rows: PaymentRow[],
  query: PaymentListQuery
): PaymentListResult {
  const term = query.search.trim().toLowerCase();

  const matched = rows.filter((row) => {
    if (query.status !== "all" && row.effectiveStatus !== query.status) return false;
    if (query.category !== "all" && row.category !== query.category) return false;
    if (!term) return true;
    return (
      row.customerName.toLowerCase().includes(term) ||
      row.contractId.toLowerCase().includes(term) ||
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

/** How many rows each effective status holds, for the filter's live counts. */
export function paymentStatusTally(rows: PaymentRow[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const row of rows) {
    tally[row.effectiveStatus] = (tally[row.effectiveStatus] ?? 0) + 1;
  }
  return tally;
}

/** Integer cents still owed across the rows given. */
export function outstandingCents(rows: PaymentRow[]): number {
  return rows
    .filter((r) => r.effectiveStatus !== "Paid")
    .reduce((sum, r) => sum + r.amount, 0);
}

/* =====================================================================
   MONEY AT THE EDGE
   ===================================================================== */

/**
 * A typed amount in dollars, as integer cents, or null if it is not a number.
 *
 * The visitor types `48.50` because that is what a person writing down a
 * payment writes. The domain takes 4850, and refuses anything that is not a
 * whole number of cents. Doing the conversion here rather than in the form
 * keeps one implementation of a rounding rule that is easy to get wrong:
 * `Math.round(48.5 * 100)` is right, `parseInt(48.5 * 100)` is not, and
 * `48.55 * 100` is 4854.999999999999 before rounding.
 */
export function centsFromInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** `1234.56`, the money grammar the rest of the product already prints. */
export { formatCents } from "./derive";
