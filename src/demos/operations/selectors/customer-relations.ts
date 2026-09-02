/**
 * Operations demo: everything attached to one customer.
 *
 * One derivation, in one place. The detail drawer needs a lead, reservations,
 * contracts, payments, conversations and an audit trail, and reading five
 * collections from inside the component would put the joins in the JSX and
 * make each of them someone else's problem to keep correct.
 *
 * This derives the whole picture. **It does not decide who may see it.** Role
 * policy is applied above, in `customers-view.ts`, because what a Finance
 * Analyst may read is a product rule rather than a question about data.
 */

import type { AuditEntry, DemoRecord } from "@/demo-runtime/types";

import { contractBalance, derivePaymentStatus } from "./derive";
import { selectCustomerActivity } from "./customers-list";
import type {
  Contract,
  Conversation,
  Customer,
  Lead,
  Payment,
  PaymentEffectiveStatus,
  Reservation,
  Vehicle,
} from "../types";

export type CustomerContract = {
  id: string;
  status: Contract["status"];
  startAt: string;
  endAt: string;
  vehicleLabel: string;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
};

export type CustomerReservation = {
  id: string;
  status: Reservation["status"];
  startAt: string;
  endAt: string;
  vehicleClass: string;
};

export type CustomerPaymentSummary = {
  paid: number;
  pending: number;
  overdue: number;
  paidCents: number;
  total: number;
};

export type CustomerConversationSummary = {
  total: number;
  open: number;
  unread: number;
};

export type CustomerRelations = {
  /** The lead this customer was converted from, when there is one. */
  sourceLead: DemoRecord<Lead> | null;
  reservations: CustomerReservation[];
  contracts: CustomerContract[];
  payments: CustomerPaymentSummary;
  conversations: CustomerConversationSummary;
  activity: AuditEntry[];
};

export type CustomerWorld = {
  customer: DemoRecord<Customer>;
  leads: DemoRecord<Lead>[];
  reservations: DemoRecord<Reservation>[];
  contracts: DemoRecord<Contract>[];
  payments: DemoRecord<Payment>[];
  conversations: DemoRecord<Conversation>[];
  vehicles: DemoRecord<Vehicle>[];
  audit: AuditEntry[];
  /** The demo's logical clock. Overdue is derived, never read from storage. */
  now: string;
};

/** Most recent first, so a truncated list shows what matters. */
const byRecency = <T extends { startAt: string; id: string }>(a: T, b: T) =>
  b.startAt.localeCompare(a.startAt) || a.id.localeCompare(b.id);

export function selectCustomerRelations(world: CustomerWorld): CustomerRelations {
  const { customer, now } = world;
  const id = customer.id;

  const sourceLead = customer.data.sourceLeadId
    ? (world.leads.find((l) => l.id === customer.data.sourceLeadId) ?? null)
    : null;

  const vehicleLabel = (vehicleId: string) => {
    const vehicle = world.vehicles.find((v) => v.id === vehicleId);
    return vehicle ? `${vehicle.data.assetCode} ${vehicle.data.modelLabel}` : "Unassigned";
  };

  const reservations: CustomerReservation[] = world.reservations
    .filter((r) => r.data.customerId === id)
    .map((r) => ({
      id: r.id,
      status: r.data.status,
      startAt: r.data.startAt,
      endAt: r.data.endAt,
      vehicleClass: r.data.vehicleClass,
    }))
    .sort(byRecency);

  const contracts: CustomerContract[] = world.contracts
    .filter((c) => c.data.customerId === id)
    .map((c) => {
      const balance = contractBalance(c.data);
      return {
        id: c.id,
        status: c.data.status,
        startAt: c.data.startAt,
        endAt: c.data.endAt,
        vehicleLabel: vehicleLabel(c.data.vehicleId),
        totalCents: c.data.totalAmount,
        paidCents: c.data.paidAmount,
        balanceCents: balance.remainingBalance,
      };
    })
    .sort(byRecency);

  /* Overdue is derived against the logical clock, never read from the stored
     status (D-053). */
  const mine = world.payments.filter((p) => p.data.customerId === id);
  const effective = mine.map((p) => derivePaymentStatus(p.data, now));
  const count = (status: PaymentEffectiveStatus) =>
    effective.filter((s) => s === status).length;

  const payments: CustomerPaymentSummary = {
    paid: count("Paid"),
    pending: count("Pending"),
    overdue: count("Overdue"),
    paidCents: mine
      .filter((p, i) => effective[i] === "Paid")
      .reduce((total, p) => total + p.data.amount, 0),
    total: mine.length,
  };

  /* A conversation belongs to this customer directly, or to the lead they were
     converted from: the thread does not restart because the record was
     promoted. */
  const subjectIds = new Set<string>([id, ...(sourceLead ? [sourceLead.id] : [])]);
  const threads = world.conversations.filter((c) => subjectIds.has(c.data.subjectId));

  const conversations: CustomerConversationSummary = {
    total: threads.length,
    open: threads.filter((c) => c.data.status === "Open").length,
    unread: threads.filter((c) => c.data.unread).length,
  };

  return {
    sourceLead,
    reservations,
    contracts,
    payments,
    conversations,
    activity: selectCustomerActivity(world.audit, id),
  };
}

export type CustomerCounts = { contracts: number; reservations: number };

/**
 * Per-customer relationship counts for the list.
 *
 * Built once for the whole page rather than filtered per row, so a table of
 * ten rows does not walk the contracts collection ten times. The caller passes
 * only the collections the current role may read, so a count it must not see
 * is not merely hidden: it was never derived.
 */
export function selectCustomerCounts(
  contracts: DemoRecord<Contract>[],
  reservations: DemoRecord<Reservation>[]
): Map<string, CustomerCounts> {
  const counts = new Map<string, CustomerCounts>();
  const bump = (id: string, key: keyof CustomerCounts) => {
    const current = counts.get(id) ?? { contracts: 0, reservations: 0 };
    current[key] += 1;
    counts.set(id, current);
  };
  for (const c of contracts) bump(c.data.customerId, "contracts");
  for (const r of reservations) bump(r.data.customerId, "reservations");
  return counts;
}
