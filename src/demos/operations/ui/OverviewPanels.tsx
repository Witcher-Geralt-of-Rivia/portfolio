"use client";

/**
 * Operations demo: the Overview panels.
 *
 * Every number here comes from `selectors/overview.ts`. Nothing is stored and
 * nothing is written as a literal: a dashboard figure that disagrees with the
 * list beneath it is the fastest way for a demo like this to lose credibility.
 *
 * The visuals are CSS and authored SVG. Where an SVG carries data, the same
 * values appear in text beside it and the SVG is `aria-hidden`, so nothing is
 * conveyed by colour or shape alone.
 */

import Link from "next/link";

import type { DemoRecord } from "@/demo-runtime/types";

import { formatCents } from "../selectors/derive";
import type { ActionQueueItem, OverviewData } from "../selectors/overview";
import type { Customer, Reservation, Vehicle } from "../types";

/* =====================================================================
   KPI GRID
   ===================================================================== */

export type KpiKey =
  | "openLeads"
  | "confirmedReservations"
  | "vehiclesAvailable"
  | "paymentsRequiringAttention";

/**
 * What each KPI is, and the breakdown printed beneath it.
 *
 * The breakdown replaced a progress bar. That bar drew each value as a share
 * of a denominator the card never named (open leads against all leads,
 * available vehicles against the fleet), so it implied a ratio the reader
 * could not check and that nothing in the product had defined. A count that
 * sums to the headline is checkable on sight, and it is more useful: knowing
 * the 38 open leads are 12 New and 10 Contacted says something a bar cannot.
 *
 * Every figure here is derived. Nothing is a trend: there is no previous
 * period in the dataset to compare against, so a "+12%" would be invented.
 */
const KPI_META: Record<KpiKey, { label: string }> = {
  openLeads: { label: "OPEN LEADS" },
  confirmedReservations: { label: "CONFIRMED RESERVATIONS" },
  vehiclesAvailable: { label: "VEHICLES AVAILABLE" },
  paymentsRequiringAttention: { label: "PAYMENTS REQUIRING ATTENTION" },
};

export type KpiBreakdownPart = { label: string; count: number };

export type KpiValue = {
  value: number;
  /** Parts that sum to the value, or a single denominator note. */
  parts?: KpiBreakdownPart[];
  note?: string;
};

export function KpiGrid({ keys, values }: { keys: KpiKey[]; values: Record<KpiKey, KpiValue> }) {
  return (
    <div className={`ops-kpis ops-kpis--${keys.length}`}>
      {keys.map((key) => {
        const v = values[key];
        return (
          <article className="ops-kpi" key={key}>
            <h3 className="ops-kpi__label">{KPI_META[key].label}</h3>
            <p className="ops-kpi__value">{v.value}</p>
            {v.parts ? (
              <p className="ops-kpi__parts">
                {/* Separated by a flex gap rather than a middle dot. Each part
                    is nowrap and nothing sat between two of them, so the line
                    had no break opportunity and the fourth part was clipped
                    from 1180px to 1440px. A gap wraps and leaves no orphaned
                    separator at the start of the second line. */}
                {v.parts.map((part) => (
                  <span className="ops-kpi__part" key={part.label}>
                    <span className="ops-kpi__part-count">{part.count}</span>{" "}
                    <span className="ops-kpi__part-label">{part.label}</span>
                  </span>
                ))}
              </p>
            ) : (
              <p className="ops-kpi__note">{v.note}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* =====================================================================
   FINANCE PANELS

   Payment Status and Contract Status, drawn from the same report selector the
   Reports module will use. Proportional rails rather than a second ring: two
   rings side by side would read as decoration, and a rail compares lengths
   more honestly than arc segments.
   ===================================================================== */

function StatusBars({
  title,
  note,
  rows,
  titleId,
}: {
  title: string;
  note: string;
  titleId: string;
  rows: { label: string; count: number; tone: string }[];
}) {
  const peak = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="ops-panel" aria-labelledby={titleId}>
      <div className="ops-panel__head">
        <h2 className="ops-panel__title" id={titleId}>
          {title}
        </h2>
        <p className="ops-panel__note">{note}</p>
      </div>
      <ul className="ops-statusbars">
        {rows.map((r) => (
          <li className="ops-statusbars__row" key={r.label}>
            <span className="ops-statusbars__label">{r.label}</span>
            <span className="ops-statusbars__rail" aria-hidden="true">
              <span
                className={`ops-statusbars__fill ops-statusbars__fill--${r.tone}`}
                style={{ transform: `scaleX(${(r.count / peak).toFixed(3)})` }}
              />
            </span>
            <span className="ops-statusbars__count">{r.count}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PaymentStatus({
  rows,
  outstandingCents,
}: {
  rows: { status: string; count: number }[];
  outstandingCents: number;
}) {
  const tone: Record<string, string> = { Paid: "mint", Pending: "sky", Overdue: "peach" };
  return (
    <StatusBars
      title="Payment status"
      titleId="ops-paystatus-title"
      note={`USD ${formatCents(outstandingCents)} outstanding`}
      rows={rows.map((r) => ({ label: r.status, count: r.count, tone: tone[r.status] ?? "sky" }))}
    />
  );
}

export function ContractStatus({ rows }: { rows: { status: string; count: number }[] }) {
  const tone: Record<string, string> = {
    Pending: "lavender",
    Active: "sky",
    Completed: "mint",
    Cancelled: "peach",
  };
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return (
    <StatusBars
      title="Contract status"
      titleId="ops-contractstatus-title"
      note={`${total} contracts`}
      rows={rows.map((r) => ({ label: r.status, count: r.count, tone: tone[r.status] ?? "sky" }))}
    />
  );
}

/* =====================================================================
   LEAD FUNNEL
   ===================================================================== */

/**
 * A progression of proportional rails, not a triangle.
 *
 * A literal funnel shape encodes the count twice (once in the width, once in
 * the taper) and reads as decoration. Rails compare honestly: each bar's
 * length is its share of the largest stage, and the count is written out.
 */
export function LeadFunnel({ data }: { data: OverviewData }) {
  const total = data.leadFunnel.reduce((sum, s) => sum + s.count, 0);
  const peak = Math.max(1, ...data.leadFunnel.map((s) => s.count));
  /* Won is a stage in the progression but not "in pipeline": it is closed.
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
    id ? (vehicles.find((v) => v.id === id)?.data.assetCode ?? "-") : "-";

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

/**
 * Where each queue row leads.
 *
 * A notification is about something rather than being a record with a screen,
 * so it has no entry and stays a plain line. The other three name a record in
 * a module that now exists.
 */
const QUEUE_HREF: Partial<Record<ActionQueueItem["kind"], (id: string) => string>> = {
  lead: (id) => `/demos/operations/leads?selected=${encodeURIComponent(id)}`,
  payment: (id) => `/demos/operations/payments?selected=${encodeURIComponent(id)}`,
  maintenance: (id) => `/demos/operations/maintenance?selected=${encodeURIComponent(id)}`,
};

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
            const href = QUEUE_HREF[item.kind]?.(item.id) ?? null;
            return (
              /* The id is plumbing and stays off the screen; what it buys is
                 the link. A queue that tells you what needs attention and then
                 leaves you to go and find it is half a control.

                 No role check here: `actionCategories` in `overview-policy.ts`
                 already drops any category whose module the role cannot open,
                 so a row that renders is a row its reader can follow. */
              <li className="ops-queue__row" key={`${item.kind}-${item.id}`}>
                <span className={`ops-pill ops-pill--${meta.tone}`}>{meta.label}</span>
                {href ? (
                  <Link className="ops-queue__label ops-queue__link" href={href}>
                    {item.label}
                  </Link>
                ) : (
                  <span className="ops-queue__label">{item.label}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export { formatCents };
