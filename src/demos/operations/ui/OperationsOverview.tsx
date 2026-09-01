"use client";

/**
 * Operations demo — the Overview screen.
 *
 * Reads every collection once, hands them to the canonical selector, and
 * renders the result. The selector is the single source of truth for what a
 * number means, so this component computes nothing.
 *
 * Which KPIs appear depends on the role. A KPI is a summary of a module's
 * data, so showing one for a module the role cannot open would leak exactly
 * the information the permission matrix withholds — the Overview would become
 * a hole in its own policy.
 */

import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { canViewModule } from "../permissions";
import { selectOverview } from "../selectors/overview";
import { resolvedPayments } from "../services/payments";
import { read } from "../services/context";
import type { Role } from "../types";
import {
  ActionQueue,
  FleetStatus,
  KpiGrid,
  LeadFunnel,
  UpcomingReservations,
  type KpiKey,
} from "./OverviewPanels";
import { useOperations } from "./OperationsProvider";

/** Which module each KPI summarises, so the role matrix decides its visibility. */
const KPI_MODULE: Record<KpiKey, Parameters<typeof canViewModule>[1]> = {
  openLeads: "Leads",
  confirmedReservations: "Reservations",
  vehiclesAvailable: "Fleet",
  paymentsRequiringAttention: "Payments",
};

const KPI_ORDER: KpiKey[] = [
  "openLeads",
  "confirmedReservations",
  "vehiclesAvailable",
  "paymentsRequiringAttention",
];

export function kpisForRole(role: Role): KpiKey[] {
  return KPI_ORDER.filter((key) => canViewModule(role, KPI_MODULE[key]));
}

/** Action queue items are filtered the same way, for the same reason. */
const QUEUE_MODULE: Record<string, Parameters<typeof canViewModule>[1]> = {
  lead: "Leads",
  payment: "Payments",
  maintenance: "Maintenance",
  notification: "Overview",
};

export default function OperationsOverview() {
  const { ctx, role } = useOperations();

  const { data, loading } = useDemoQuery(async () => {
    if (!ctx) return null;
    const [leads, vehicles, reservations, contracts, maintenance, notifications, payments] =
      await Promise.all([
        read.leads(ctx),
        read.vehicles(ctx),
        read.reservations(ctx),
        read.contracts(ctx),
        read.maintenance(ctx),
        ctx.runtime.repository.all<{ read: boolean }>("notifications"),
        resolvedPayments(ctx),
      ]);

    const overview = selectOverview({
      now: ctx.runtime.now(),
      leads,
      vehicles,
      reservations,
      contracts,
      payments,
      maintenance,
      notifications: notifications as Parameters<typeof selectOverview>[0]["notifications"],
    });

    return {
      overview,
      customers: await read.customers(ctx),
      vehicles,
      totals: {
        leads: leads.length,
        reservations: reservations.length,
        vehicles: vehicles.length,
        payments: payments.length,
      },
    };
  }, [role]);

  if (loading || !data) {
    /* The skeleton reserves the same geometry the panels occupy, so nothing
       moves when the data resolves. */
    return <OverviewSkeleton kpis={kpisForRole(role).length} />;
  }

  const kpis = kpisForRole(role);
  const queue = data.overview.actionQueue.filter((item) =>
    canViewModule(role, QUEUE_MODULE[item.kind] ?? "Overview")
  );

  return (
    <div className="ops-overview">
      <KpiGrid data={data.overview} keys={kpis} totals={data.totals} />

      <div className="ops-overview__row ops-overview__row--wide">
        <LeadFunnel data={data.overview} />
        <FleetStatus data={data.overview} />
      </div>

      <div className="ops-overview__row">
        <UpcomingReservations
          reservations={data.overview.upcomingReservations}
          customers={data.customers}
          vehicles={data.vehicles}
        />
        <ActionQueue items={queue} />
      </div>
    </div>
  );
}

function OverviewSkeleton({ kpis }: { kpis: number }) {
  return (
    <div className="ops-overview" aria-busy="true">
      <div className={`ops-kpis ops-kpis--${kpis}`}>
        {Array.from({ length: kpis }, (_, i) => (
          <div className="ops-kpi ops-skeleton" key={i} />
        ))}
      </div>
      <div className="ops-overview__row ops-overview__row--wide">
        <div className="ops-panel ops-skeleton ops-skeleton--panel" />
        <div className="ops-panel ops-skeleton ops-skeleton--panel" />
      </div>
      <div className="ops-overview__row">
        <div className="ops-panel ops-skeleton ops-skeleton--panel" />
        <div className="ops-panel ops-skeleton ops-skeleton--panel" />
      </div>
      <p className="visually-hidden" role="status">
        Loading demo data
      </p>
    </div>
  );
}
