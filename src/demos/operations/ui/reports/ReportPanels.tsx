"use client";

/**
 * Operations demo: the Reports panels.
 *
 * Exactly four panels, because the specification names exactly four groups and
 * closes the list: CRM Funnel, Fleet Utilization, Contract Status and Payment
 * Status. Reservations and Maintenance are not report groups here, however
 * reportable they might be, and adding them would be adjusting the frozen
 * contract to fit an idea rather than the other way round.
 *
 * Not one panel holds a figure of its own. Every count and every sum arrives
 * from `selectReports`, which counts records the visitor can go and open in the
 * module they came from. A reporting screen is where a demo is most tempted to
 * write a number down, and a number written down here would be the first one on
 * the whole product that disagrees with its own list.
 *
 * The instruments are the ones the Overview already established: the panel, the
 * proportional rail and the segmented ring. Reports is the page that would most
 * easily grow a second visual language for the same shapes, so it inherits
 * rather than invents, and the fleet ring in particular is the Overview's ring
 * unchanged down to the arc arithmetic.
 *
 * Three rules hold across all four. A share is never printed without the total
 * it was taken over. A bar always carries its count in text beside it. And
 * nothing is compared to a previous period, because the demo runs on one
 * logical clock and has no previous period to compare against.
 */

import type { ReportsData } from "../../selectors/overview";
import type { VehicleStatus } from "../../types";
import StatBars from "./StatBars";
import {
  CONTRACT_TONE,
  PAYMENT_TONE,
  VEHICLE_TONE,
  formatCents,
} from "./reports-view";

/** Cents are stored, money is shown. The conversion happens once, here. */
const money = (cents: number) => `USD ${formatCents(cents)}`;

/** `1 contract`, `14 contracts`. A count is never printed without its noun. */
const counted = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const sum = (rows: readonly { count: number }[]) =>
  rows.reduce((total, row) => total + row.count, 0);

/**
 * One figure: a label, the value, and the count the value was taken over.
 *
 * The note is not decoration. It is the denominator, and every figure on this
 * page carries one.
 */
function Figure({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <p className="ops-figure__label">{label}</p>
      <p className="ops-figure__value">{value}</p>
      <p className="ops-figure__note">{note}</p>
    </div>
  );
}

/* =====================================================================
   CONTRACT STATUS AND VALUE
   ===================================================================== */

export function ContractValue({
  rows,
  values,
  totals,
}: {
  rows: ReportsData["contractStatus"];
  values: ReportsData["contractValue"];
  totals: ReportsData["contractTotals"];
}) {
  const total = sum(rows);

  /* The money for a status travels with the bar for that status, keyed on the
     label the bar prints. Four Pending contracts worth 165.00 and four worth
     3,000.00 are different situations, and a reader should not have to join
     two lists by eye to tell which one this is. */
  const valueByStatus: Record<string, string> = Object.fromEntries(
    values.map((row) => [row.status, money(row.totalCents)] as const)
  );

  return (
    <section className="ops-panel" aria-labelledby="ops-report-contracts-title">
      <div className="ops-panel__head">
        <h2 className="ops-panel__title" id="ops-report-contracts-title">
          Contract status and value
        </h2>
        <p className="ops-panel__note">
          {counted(total, "contract", "contracts")} in the period
        </p>
      </div>

      <StatBars
        rows={rows.map((row) => ({
          label: row.status,
          count: row.count,
          tone: CONTRACT_TONE[row.status],
        }))}
        total={total}
        noun="contracts"
        values={valueByStatus}
      />

      {/* Total, paid and outstanding are the same subtraction the contract
          drawer shows on one record, summed over the period. They agree with
          the drawer because both read the stored cents rather than rounding a
          currency string. */}
      <div className="ops-figures">
        <Figure
          label="Total value"
          value={money(totals.totalCents)}
          note={`across ${counted(total, "contract", "contracts")}`}
        />
        <Figure
          label="Paid"
          value={money(totals.paidCents)}
          note={`received on the same ${counted(total, "contract", "contracts")}`}
        />
        <Figure
          label="Outstanding"
          value={money(totals.outstandingCents)}
          note={`still owed on the same ${counted(total, "contract", "contracts")}`}
        />
      </div>
    </section>
  );
}

/* =====================================================================
   FLEET UTILISATION

   The Overview's ring, unchanged. Same radius, same arc arithmetic, same
   `aria-hidden` on the SVG with the legend carrying the complete data beside
   it. Two rings that looked slightly different on two screens would be two
   instruments, and a reader would reasonably assume they measured two things.
   ===================================================================== */

const RING_RADIUS = 52;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export function FleetUtilisation({ data }: { data: ReportsData["fleetUtilization"] }) {
  const total = data.total;

  /* The segment offsets are computed up front rather than accumulated while
     mapping: mutating a binding during render is exactly what React's
     immutability rule forbids, and a running total is easy to write that way
     by accident. */
  const segments = data.byStatus.reduce<
    { status: VehicleStatus; length: number; offset: number }[]
  >((acc, s) => {
    const previous = acc[acc.length - 1];
    const length = total > 0 ? (s.count / total) * RING_LENGTH : 0;
    return [
      ...acc,
      { status: s.status, length, offset: previous ? previous.offset + previous.length : 0 },
    ];
  }, []);

  return (
    <section className="ops-panel" aria-labelledby="ops-report-fleet-title">
      <div className="ops-panel__head">
        <h2 className="ops-panel__title" id="ops-report-fleet-title">
          Fleet utilisation
        </h2>
        {/* No period on this note, and that is deliberate: the register is a
            snapshot of what the fleet is now, so a date window over it would
            produce a number with no meaning at all. The page says so in full
            above the panels. */}
        <p className="ops-panel__note">{total} vehicles</p>
      </div>

      <div className="ops-fleet">
        <svg className="ops-fleet__ring" viewBox="0 0 128 128" aria-hidden="true">
          <circle className="ops-fleet__track" cx="64" cy="64" r={RING_RADIUS} />
          {segments.map((s) => (
            <circle
              key={s.status}
              className={`ops-fleet__seg ops-fleet__seg--${VEHICLE_TONE[s.status]}`}
              cx="64"
              cy="64"
              r={RING_RADIUS}
              strokeDasharray={`${s.length} ${RING_LENGTH - s.length}`}
              strokeDashoffset={-s.offset}
            />
          ))}
        </svg>

        <ul className="ops-fleet__legend">
          {data.byStatus.map((s) => (
            <li className="ops-fleet__row" key={s.status}>
              <span
                className={`ops-fleet__swatch ops-fleet__swatch--${VEHICLE_TONE[s.status]}`}
                aria-hidden="true"
              />
              <span className="ops-fleet__status">{s.status}</span>
              <span className="ops-fleet__count">{s.count}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* The only percentage this page prints in the open, and it arrives with
          the fleet it was taken over. A bare utilisation figure is precisely
          the number a reader has no way to check. */}
      <div className="ops-figures">
        <Figure
          label="Rented share"
          value={`${data.rentedShare}%`}
          note={`of ${counted(total, "vehicle", "vehicles")} currently rented`}
        />
      </div>
    </section>
  );
}

/* =====================================================================
   PAYMENT STATUS
   ===================================================================== */

export function PaymentReport({ data }: { data: ReportsData["paymentStatus"] }) {
  const total = sum(data.byStatus);
  /* Unsettled is Pending plus Overdue, which is what the outstanding sum was
     taken over. Counted from the same rows the bars draw rather than derived a
     second time, so the figure and its denominator cannot drift apart. */
  const unsettled = sum(data.byStatus.filter((row) => row.status !== "Paid"));

  return (
    <section className="ops-panel" aria-labelledby="ops-report-payments-title">
      <div className="ops-panel__head">
        <h2 className="ops-panel__title" id="ops-report-payments-title">
          Payment status
        </h2>
        <p className="ops-panel__note">
          {counted(total, "payment", "payments")} in the period
        </p>
      </div>

      <StatBars
        rows={data.byStatus.map((row) => ({
          label: row.status,
          count: row.count,
          tone: PAYMENT_TONE[row.status],
        }))}
        total={total}
        noun="payments"
      />

      <div className="ops-figures">
        <Figure
          label="Outstanding"
          value={money(data.outstandingCents)}
          note={`across ${counted(unsettled, "payment", "payments")} not yet settled`}
        />
      </div>
    </section>
  );
}

/* =====================================================================
   LEAD FUNNEL
   ===================================================================== */

export function LeadFunnelReport({ rows }: { rows: ReportsData["crmFunnel"] }) {
  const total = sum(rows);
  /* Won is a stage in the progression but not "in pipeline": it is closed. The
     Overview's own funnel makes the same split, and stating both here keeps the
     panel saying what the bars alone leave the reader to add up. */
  const won = rows.find((row) => row.stage === "Won")?.count ?? 0;
  const open = total - won;

  return (
    <section className="ops-panel" aria-labelledby="ops-report-funnel-title">
      <div className="ops-panel__head">
        <h2 className="ops-panel__title" id="ops-report-funnel-title">
          Lead funnel
        </h2>
        <p className="ops-panel__note">{counted(total, "lead", "leads")} in the period</p>
      </div>

      {/* One tone across all five stages, as the Overview funnel has. A funnel
          is a single progression rather than five categories, and colouring
          the steps apart would imply a distinction the domain does not make. */}
      <StatBars
        rows={rows.map((row) => ({ label: row.stage, count: row.count, tone: "sky" }))}
        total={total}
        noun="leads"
      />

      <div className="ops-figures">
        <Figure
          label="Still open"
          value={String(open)}
          note={`of ${counted(total, "lead", "leads")} in the funnel`}
        />
        <Figure
          label="Won"
          value={String(won)}
          note="closed, and counted in the funnel above"
        />
      </div>
    </section>
  );
}
