/**
 * Operations demo — Overview and report selectors.
 *
 * Every figure is computed from the records that back it. Nothing here is
 * stored, and no KPI has a literal value: a dashboard number that disagrees
 * with the list beneath it is the single most obvious way a demo like this
 * loses credibility.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { DAY_MS, type ReportPeriod } from "../constants";
import type {
  Contract,
  ContractStatus,
  Lead,
  LeadStage,
  MaintenanceWorkOrder,
  Notification,
  PaymentEffectiveStatus,
  Reservation,
  ResolvedPayment,
  Vehicle,
  VehicleStatus,
} from "../types";

export type OverviewInput = {
  now: string;
  leads: DemoRecord<Lead>[];
  vehicles: DemoRecord<Vehicle>[];
  reservations: DemoRecord<Reservation>[];
  contracts: DemoRecord<Contract>[];
  payments: ResolvedPayment[];
  maintenance: DemoRecord<MaintenanceWorkOrder>[];
  notifications: DemoRecord<Notification>[];
};

export type ActionQueueItem = {
  kind: "notification" | "lead" | "payment" | "maintenance";
  id: string;
  label: string;
};

export type OverviewData = {
  openLeads: number;
  confirmedReservations: number;
  vehiclesAvailable: number;
  paymentsRequiringAttention: number;
  leadFunnel: { stage: LeadStage; count: number }[];
  leadsLost: number;
  fleetStatus: { status: VehicleStatus; count: number }[];
  upcomingReservations: DemoRecord<Reservation>[];
  actionQueue: ActionQueueItem[];
};

/** The funnel excludes Lost, which is reported separately rather than as a stage. */
const FUNNEL_STAGES: LeadStage[] = ["New", "Contacted", "Qualified", "Proposal", "Won"];

export function selectOverview(input: OverviewInput): OverviewData {
  const { now, leads, vehicles, reservations, payments, maintenance, notifications } = input;

  const openLeads = leads.filter(
    (l) => !l.data.archived && l.data.stage !== "Won" && l.data.stage !== "Lost"
  );

  const confirmed = reservations.filter((r) => r.data.status === "Confirmed");
  const available = vehicles.filter((v) => v.data.status === "Available");
  const attention = payments.filter(
    (p) => p.effectiveStatus === "Pending" || p.effectiveStatus === "Overdue"
  );

  const leadFunnel = FUNNEL_STAGES.map((stage) => ({
    stage,
    count: leads.filter((l) => !l.data.archived && l.data.stage === stage).length,
  }));

  const fleetStatus = (["Available", "Reserved", "Rented", "Maintenance"] as VehicleStatus[]).map(
    (status) => ({ status, count: vehicles.filter((v) => v.data.status === status).length })
  );

  /* Upcoming means confirmed and not yet started, soonest first. */
  const upcomingReservations = confirmed
    .filter((r) => Date.parse(r.data.startAt) >= Date.parse(now))
    .sort((a, b) => Date.parse(a.data.startAt) - Date.parse(b.data.startAt));

  /* The queue's order is fixed: unread notifications, then leads whose
     follow-up is due, then overdue payments, then open high-priority work.
     Deterministic order matters — an action list that reshuffles between
     renders is unusable. */
  const actionQueue: ActionQueueItem[] = [
    ...notifications
      .filter((n) => !n.data.read)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((n) => ({ kind: "notification" as const, id: n.id, label: n.data.title })),
    ...openLeads
      .filter(
        (l) =>
          l.data.priority === "High" &&
          l.data.nextFollowUpAt !== null &&
          Date.parse(l.data.nextFollowUpAt) <= Date.parse(now)
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((l) => ({
        kind: "lead" as const,
        id: l.id,
        label: `Follow up with ${l.data.displayName}`,
      })),
    ...payments
      .filter((p) => p.effectiveStatus === "Overdue")
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => ({ kind: "payment" as const, id: p.id, label: "Overdue payment" })),
    ...maintenance
      .filter((w) => w.data.status === "Open" && w.data.priority === "High")
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((w) => ({ kind: "maintenance" as const, id: w.id, label: w.data.summary })),
  ];

  return {
    openLeads: openLeads.length,
    confirmedReservations: confirmed.length,
    vehiclesAvailable: available.length,
    paymentsRequiringAttention: attention.length,
    leadFunnel,
    leadsLost: leads.filter((l) => !l.data.archived && l.data.stage === "Lost").length,
    fleetStatus,
    upcomingReservations,
    actionQueue,
  };
}

/* =====================================================================
   REPORTS
   ===================================================================== */

/** The window a period filter covers, measured on the logical clock. */
export function periodStart(period: ReportPeriod, now: string): string | null {
  if (period === "All demo data") return null;
  const days = period === "30 days" ? 30 : 90;
  return new Date(Date.parse(now) - days * DAY_MS).toISOString();
}

function withinPeriod(instant: string, from: string | null): boolean {
  return from === null || Date.parse(instant) >= Date.parse(from);
}

export type ReportsData = {
  crmFunnel: { stage: LeadStage; count: number }[];
  fleetUtilization: {
    total: number;
    byStatus: { status: VehicleStatus; count: number }[];
    /** Share of the fleet currently earning, as a percentage of vehicles. */
    rentedShare: number;
  };
  contractStatus: { status: ContractStatus; count: number }[];
  paymentStatus: {
    byStatus: { status: PaymentEffectiveStatus; count: number }[];
    /** Integer cents. */
    outstandingCents: number;
  };
};

export type ReportsInput = {
  now: string;
  period: ReportPeriod;
  leads: DemoRecord<Lead>[];
  vehicles: DemoRecord<Vehicle>[];
  contracts: DemoRecord<Contract>[];
  payments: ResolvedPayment[];
};

export function selectReports(input: ReportsInput): ReportsData {
  const from = periodStart(input.period, input.now);

  /* Leads and contracts are time-filtered because they have a moment of
     origin. The fleet is a snapshot — a vehicle's status is what it is now,
     not what happened in a window — so the period does not apply to it. */
  const leads = input.leads.filter(
    (l) => !l.data.archived && withinPeriod(l.createdAt, from)
  );
  const contracts = input.contracts.filter((c) => withinPeriod(c.data.startAt, from));
  const payments = input.payments.filter((p) => withinPeriod(p.data.dueAt, from));

  const rented = input.vehicles.filter((v) => v.data.status === "Rented").length;

  return {
    crmFunnel: FUNNEL_STAGES.map((stage) => ({
      stage,
      count: leads.filter((l) => l.data.stage === stage).length,
    })),
    fleetUtilization: {
      total: input.vehicles.length,
      byStatus: (["Available", "Reserved", "Rented", "Maintenance"] as VehicleStatus[]).map(
        (status) => ({
          status,
          count: input.vehicles.filter((v) => v.data.status === status).length,
        })
      ),
      rentedShare:
        input.vehicles.length === 0
          ? 0
          : Math.round((rented / input.vehicles.length) * 100),
    },
    contractStatus: (["Pending", "Active", "Completed", "Cancelled"] as ContractStatus[]).map(
      (status) => ({ status, count: contracts.filter((c) => c.data.status === status).length })
    ),
    paymentStatus: {
      byStatus: (["Paid", "Pending", "Overdue"] as PaymentEffectiveStatus[]).map((status) => ({
        status,
        count: payments.filter((p) => p.effectiveStatus === status).length,
      })),
      outstandingCents: payments
        .filter((p) => p.effectiveStatus !== "Paid")
        .reduce((sum, p) => sum + p.data.amount, 0),
    },
  };
}
