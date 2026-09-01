"use client";

/**
 * Operations demo — the Overview panels.
 *
 * Every number here comes from `selectors/overview.ts`. Nothing is stored and
 * nothing is written as a literal: a dashboard figure that disagrees with the
 * list beneath it is the fastest way for a demo like this to lose credibility.
 *
 * The visuals are CSS and authored SVG. Where an SVG carries data, the same
 * values appear in text beside it and the SVG is `aria-hidden`, so nothing is
 * conveyed by colour or shape alone.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { formatCents } from "../selectors/derive";
import type { OverviewData } from "../selectors/overview";
import type { Customer, Reservation, Vehicle } from "../types";

/* =====================================================================
   KPI GRID
   ===================================================================== */

export type KpiKey =
  | "openLeads"
  | "confirmedReservations"
  | "vehiclesAvailable"
  | "paymentsRequiringAttention";

const KPI_META: Record<KpiKey, { label: string; support: string }> = {
  openLeads: { label: "OPEN LEADS", support: "Across active pipeline stages" },
  confirmedReservations: {
    label: "CONFIRMED RESERVATIONS",
    support: "Vehicles held for collection",
  },
  vehiclesAvailable: { label: "VEHICLES AVAILABLE", support: "Ready to rent today" },
  paymentsRequiringAttention: {
    label: "PAYMENTS REQUIRING ATTENTION",
    support: "Pending or past due",
  },
};

/**
 * A small proportional cue, drawn from the value's own share of its whole.
 *
 * Not a trend: there is no previous period to compare against, and inventing
 * a "+12%" would be exactly the fabricated metric the project forbids.
 */
function KpiCue({ share }: { share: number }) {
  const pct = Math.max(0, Math.min(1, share));
  return (
    <span className="ops-kpi__cue" aria-hidden="true">
      <span className="ops-kpi__cue-fill" style={{ transform: `scaleX(${pct.toFixed(3)})` }} />
    </span>
  );
}

export function KpiGrid({
  data,
  keys,
  totals,
}: {
  data: OverviewData;
  keys: KpiKey[];
  totals: { leads: number; reservations: number; vehicles: number; payments: number };
}) {
  const value: Record<KpiKey, number> = {
    openLeads: data.openLeads,
    confirmedReservations: data.confirmedReservations,
    vehiclesAvailable: data.vehiclesAvailable,
    paymentsRequiringAttention: data.paymentsRequiringAttention,
  };
  const whole: Record<KpiKey, number> = {
    openLeads: totals.leads,
    confirmedReservations: totals.reservations,
    vehiclesAvailable: totals.vehicles,
    paymentsRequiringAttention: totals.payments,
  };

  return (
    <div className={`ops-kpis ops-kpis--${keys.length}`}>
      {keys.map((key) => (
        <article className="ops-kpi" key={key}>
          <h3 className="ops-kpi__label">{KPI_META[key].label}</h3>
          <p className="ops-kpi__value">{value[key]}</p>
          <p className="ops-kpi__support">{KPI_META[key].support}</p>
          <KpiCue share={whole[key] > 0 ? value[key] / whole[key] : 0} />
        </article>
      ))}
    </div>
  );
}

/* =====================================================================
   LEAD FUNNEL
   ===================================================================== */

/**
 * A progression of proportional rails, not a triangle.
 *
 * A literal funnel shape encodes the count twice — once in the width, once in
 * the taper — and reads as decoration. Rails compare honestly: each bar's
 * length is its share of the largest stage, and the count is written out.
 */
export function LeadFunnel({ data }: { data: OverviewData }) {
  const total = data.leadFunnel.reduce((sum, s) => sum + s.count, 0);
  const peak = Math.max(1, ...data.leadFunnel.map((s) => s.count));
  /* Won is a stage in the progression but not "in pipeline" — it is closed.
     The note counts the leads still moving, which is the same figure the
     Open leads KPI shows. */
  const open = data.leadFunnel
    .filter((s) => s.stage !== "Won")
    .reduce((sum, s) => sum + s.count, 0);

  return (
    <section className="ops-panel" aria-labelledby="ops-funnel-title">
      <div className="ops-panel__head">
        <h2 className="ops-panel__title" id="ops-funnel-title">
          Lead funnel
        </h2>
        <p className="ops-panel__note">{open} still open</p>
      </div>

      <ul className="ops-funnel">
        {data.leadFunnel.map((stage) => {
          const share = total > 0 ? Math.round((stage.count / total) * 100) : 0;
          return (
            <li className="ops-funnel__row" key={stage.stage} tabIndex={0}>
              <span className="ops-funnel__stage">{stage.stage}</span>
              <span className="ops-funnel__rail" aria-hidden="true">
                <span
                  className="ops-funnel__fill"
                  style={{ transform: `scaleX(${(stage.count / peak).toFixed(3)})` }}
                />
              </span>
              <span className="ops-funnel__count">{stage.count}</span>
              {/* Revealed on hover or focus; also the accessible description,
                  so the share is never conveyed by the rail alone. */}
              <span className="ops-funnel__share">{share}% of the funnel</span>
            </li>
          );
        })}
      </ul>

      <p className="ops-funnel__lost">
        <span className="ops-funnel__lost-dot" aria-hidden="true" />
        {data.leadsLost} lost, shown separately from the progression
      </p>
    </section>
  );
}

/* =====================================================================
   FLEET STATUS
   ===================================================================== */

const FLEET_TONE: Record<string, string> = {
  Available: "mint",
  Reserved: "lavender",
  Rented: "sky",
  Maintenance: "peach",
};

/**
 * A segmented ring, with every value also written out.
 *
 * The ring is `aria-hidden`: the legend beside it carries the complete data,
 * so nothing depends on distinguishing four soft hues.
 */
export function FleetStatus({ data }: { data: OverviewData }) {
  const total = data.fleetStatus.reduce((sum, s) => sum + s.count, 0);
  const R = 52;
  const C = 2 * Math.PI * R;

  /* The segment offsets are computed up front rather than accumulated while
     mapping: mutating a binding during render is exactly what React's
     immutability rule forbids, and a running total is easy to write that way
     by accident. */
  const segments = data.fleetStatus.reduce<
    { status: string; length: number; offset: number }[]
  >((acc, s) => {
    const previous = acc[acc.length - 1];
    const length = total > 0 ? (s.count / total) * C : 0;
    return [
      ...acc,
      { status: s.status, length, offset: previous ? previous.offset + previous.length : 0 },
    ];
  }, []);

  return (
    <section className="ops-panel" aria-labelledby="ops-fleet-title">
      <div className="ops-panel__head">
        <h2 className="ops-panel__title" id="ops-fleet-title">
          Fleet status
        </h2>
        <p className="ops-panel__note">{total} vehicles</p>
      </div>

      <div className="ops-fleet">
        <svg className="ops-fleet__ring" viewBox="0 0 128 128" aria-hidden="true">
          <circle className="ops-fleet__track" cx="64" cy="64" r={R} />
          {segments.map((s) => (
            <circle
              key={s.status}
              className={`ops-fleet__seg ops-fleet__seg--${FLEET_TONE[s.status]}`}
              cx="64"
              cy="64"
              r={R}
              strokeDasharray={`${s.length} ${C - s.length}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </svg>

        <ul className="ops-fleet__legend">
          {data.fleetStatus.map((s) => (
            <li className="ops-fleet__row" key={s.status}>
              <span
                className={`ops-fleet__swatch ops-fleet__swatch--${FLEET_TONE[s.status]}`}
                aria-hidden="true"
              />
              <span className="ops-fleet__status">{s.status}</span>
              <span className="ops-fleet__count">{s.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* =====================================================================
   UPCOMING RESERVATIONS
   ===================================================================== */

const dayMonth = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export function UpcomingReservations({
  reservations,
  customers,
  vehicles,
}: {
  reservations: DemoRecord<Reservation>[];
  customers: DemoRecord<Customer>[];
  vehicles: DemoRecord<Vehicle>[];
}) {
  const nameOf = (id: string) =>
    customers.find((c) => c.id === id)?.data.displayName ?? "Unknown customer";
  const assetOf = (id?: string) =>
    id ? (vehicles.find((v) => v.id === id)?.data.assetCode ?? "—") : "—";

  const rows = reservations.slice(0, 5);

  return (
    <section className="ops-panel" aria-labelledby="ops-upcoming-title">
      <div className="ops-panel__head">
        <h2 className="ops-panel__title" id="ops-upcoming-title">
          Upcoming reservations
        </h2>
        <p className="ops-panel__note">{reservations.length} confirmed</p>
      </div>

      {rows.length === 0 ? (
        <p className="ops-empty">No upcoming reservations.</p>
      ) : (
        <table className="ops-table">
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Vehicle</th>
              <th scope="col">Starts</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="ops-table__strong">{nameOf(r.data.customerId)}</td>
                <td>
                  <span className="ops-mono">{assetOf(r.data.vehicleId)}</span>
                  <span className="ops-table__sub">{r.data.vehicleClass}</span>
                </td>
                <td>{dayMonth(r.data.startAt)}</td>
                <td>
                  <span className="ops-pill ops-pill--lavender">{r.data.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/* =====================================================================
   ACTION QUEUE
   ===================================================================== */

const QUEUE_META: Record<string, { label: string; tone: string }> = {
  payment: { label: "Payment", tone: "peach" },
  maintenance: { label: "Maintenance", tone: "peach" },
  lead: { label: "Follow-up", tone: "sky" },
  notification: { label: "Notification", tone: "lavender" },
};

export function ActionQueue({ items }: { items: OverviewData["actionQueue"] }) {
  const shown = items.slice(0, 6);

  return (
    <section className="ops-panel" aria-labelledby="ops-queue-title">
      <div className="ops-panel__head">
        <h2 className="ops-panel__title" id="ops-queue-title">
          Action queue
        </h2>
        <p className="ops-panel__note">
          {items.length > shown.length
            ? `${shown.length} of ${items.length}`
            : `${items.length} item${items.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {shown.length === 0 ? (
        <p className="ops-empty">Nothing needs attention.</p>
      ) : (
        <ul className="ops-queue">
          {shown.map((item) => {
            const meta = QUEUE_META[item.kind] ?? { label: item.kind, tone: "sky" };
            return (
              /* The entity id stays in the data — a later stage links these
                 rows to their records — but it is internal plumbing and does
                 not belong on the visitor's screen. */
              <li className="ops-queue__row" key={`${item.kind}-${item.id}`}>
                <span className={`ops-pill ops-pill--${meta.tone}`}>{meta.label}</span>
                <span className="ops-queue__label">{item.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export { formatCents };
