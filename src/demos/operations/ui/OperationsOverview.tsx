"use client";

/**
 * Operations demo — the Overview screen.
 *
 * Reads every collection once, hands them to the canonical selectors, and
 * renders whatever `overview-policy.ts` says this role may see. The component
 * decides nothing: not what a number means, and not who may see it.
 *
 * The role rule covers the whole screen, not only the KPI cards. A panel is a
 * module's data in summary form, so leaving one on screen for a module the
 * role cannot open would make the Overview a hole in its own policy.
 */

import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { selectOverview, selectReports } from "../selectors/overview";
import { read } from "../services/context";
import { resolvedPayments } from "../services/payments";
import type { Notification } from "../types";
import {
  ActionQueue,
  ContractStatus,
  FleetStatus,
  KpiGrid,
  LeadFunnel,
  PaymentStatus,
  UpcomingReservations,
  type KpiValue,
} from "./OverviewPanels";
import { useOperations } from "./OperationsProvider";
import { canSeeNotification, overviewFor, type KpiKey } from "./overview-policy";

export default function OperationsOverview() {
  const { ctx, role } = useOperations();
  const composition = overviewFor(role);

  const { data } = useDemoQuery(async () => {
    if (!ctx) return null;
    const [leads, vehicles, reservations, contracts, maintenance, notifications, payments] =
      await Promise.all([
        read.leads(ctx),
        read.vehicles(ctx),
        read.reservations(ctx),
        read.contracts(ctx),
        read.maintenance(ctx),
        ctx.runtime.repository.all<Notification>("notifications"),
        resolvedPayments(ctx),
      ]);

    const now = ctx.runtime.now();
    const overview = selectOverview({
      now,
      leads,
      vehicles,
      reservations,
      contracts,
      payments,
      maintenance,
      notifications,
    });
    const reports = selectReports({
      now,
      period: "All demo data",
      leads,
      vehicles,
      contracts,
      payments,
    });

    /* Each KPI's breakdown sums to its own headline, so a reader can check it
       on sight. These are counts from the same collections the panels use, not
       a second derivation. */
    const kpis: Record<KpiKey, KpiValue> = {
      openLeads: {
        value: overview.openLeads,
        parts: overview.leadFunnel
          .filter((s) => s.stage !== "Won")
          .map((s) => ({ label: s.stage, count: s.count })),
      },
      confirmedReservations: {
        value: overview.confirmedReservations,
        note: `${
          reservations.filter((r) => r.data.status === "Confirmed" && r.data.vehicleId).length
        } vehicles currently held`,
      },
      vehiclesAvailable: {
        value: overview.vehiclesAvailable,
        note: `of ${vehicles.length} fleet assets`,
      },
      paymentsRequiringAttention: {
        value: overview.paymentsRequiringAttention,
        parts: [
          {
            label: "pending",
            count: payments.filter((p) => p.effectiveStatus === "Pending").length,
          },
          {
            label: "overdue",
            count: payments.filter((p) => p.effectiveStatus === "Overdue").length,
          },
        ],
      },
    };

    return {
      overview,
      reports,
      kpis,
      customers: await read.customers(ctx),
      vehicles,
      notifications,
    };
  }, [role]);

  /* The skeleton is for having nothing to show, not for refreshing what is
     already on screen. `useDemoQuery` keeps the previous answer while it
     re-reads, so a mutation updates the figures in place instead of blanking
     the whole screen once per write. */
  if (!data) {
    return <OverviewSkeleton kpis={composition.kpis.length} panels={composition.panels.length} />;
  }

  const allowed = new Set(composition.actionCategories);
  const notificationById = new Map(data.notifications.map((n) => [n.id, n.data]));

  const queue = data.overview.actionQueue.filter((item) => {
    if (!allowed.has(item.kind)) return false;
    /* A notification names the area it came from, so it is filtered by that
       area too — otherwise the queue leaks through the door the panel filter
       just closed. */
    if (item.kind === "notification") {
      const category = notificationById.get(item.id)?.category;
      return category ? canSeeNotification(role, category) : true;
    }
    return true;
  });

  const show = (id: (typeof composition.panels)[number]) => composition.panels.includes(id);

  /* Panels are laid out in pairs in declaration order, so a role with three
     panels gets a full row and a single, not a gap. */
  const panels: React.ReactNode[] = [];
  if (show("leadFunnel")) panels.push(<LeadFunnel key="funnel" data={data.overview} />);
  if (show("fleetStatus")) panels.push(<FleetStatus key="fleet" data={data.overview} />);
  if (show("paymentStatus")) {
    panels.push(
      <PaymentStatus
        key="pay"
        rows={data.reports.paymentStatus.byStatus}
        outstandingCents={data.reports.paymentStatus.outstandingCents}
      />
    );
  }
  if (show("contractStatus")) {
    panels.push(<ContractStatus key="contract" rows={data.reports.contractStatus} />);
  }
  if (show("upcomingReservations")) {
    panels.push(
      <UpcomingReservations
        key="upcoming"
        reservations={data.overview.upcomingReservations}
        customers={data.customers}
        vehicles={data.vehicles}
      />
    );
  }
  panels.push(<ActionQueue key="queue" items={queue} />);

  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < panels.length; i += 2) rows.push(panels.slice(i, i + 2));

  return (
    <div className="ops-overview">
      <KpiGrid keys={composition.kpis} values={data.kpis} />
      {rows.map((row, i) => (
        <div
          className={`ops-overview__row${row.length === 1 ? " ops-overview__row--single" : ""}`}
          key={i}
        >
          {row}
        </div>
      ))}
    </div>
  );
}

function OverviewSkeleton({ kpis, panels }: { kpis: number; panels: number }) {
  const rows = Math.ceil(panels / 2);
  return (
    <div className="ops-overview" aria-busy="true">
      <div className={`ops-kpis ops-kpis--${kpis}`}>
        {Array.from({ length: kpis }, (_, i) => (
          <div className="ops-kpi ops-skeleton" key={i} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div className="ops-overview__row" key={i}>
          <div className="ops-panel ops-skeleton ops-skeleton--panel" />
          <div className="ops-panel ops-skeleton ops-skeleton--panel" />
        </div>
      ))}
      <p className="visually-hidden" role="status">
        Loading demo data
      </p>
    </div>
  );
}
