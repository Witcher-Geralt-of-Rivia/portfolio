"use client";

/**
 * Operations demo: the Reports module.
 *
 * The one screen in the product that writes nothing at all. No table, no
 * drawer, no form, and no button that mutates: a period select, the four report
 * groups the specification freezes, and every figure a count or a sum of records
 * the visitor can open in the module it came from.
 *
 * What this module is actually demonstrating is a refusal. A reports page is
 * where a portfolio demo usually starts inventing: a headline percentage with
 * no denominator, a trend against a month the dataset does not contain, a bar
 * whose length is the only place its value appears. None of that is here. Every
 * share is printed with the total it was taken over, every rail carries its
 * count in words beside it, and there is no comparison to a previous period
 * because the demo runs on one logical clock and has no previous period.
 *
 * One read, one selector, one announcement. The period is the only control, and
 * it is applied by the selector rather than by anything on this screen, so the
 * window a figure covers is decided in one place for all four groups.
 */

import { useCallback, useState } from "react";

import { useDemoQuery } from "@/demo-runtime/react/hooks";

import type { ReportPeriod } from "../../constants";
import { selectReports, type ReportsData } from "../../selectors/overview";
import { read } from "../../services/context";
import { resolvedPayments } from "../../services/payments";
import type { Role } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsSelect from "../OpsSelect";
import {
  ContractValue,
  FleetUtilisation,
  LeadFunnelReport,
  PaymentReport,
} from "./ReportPanels";
import {
  DEFAULT_PERIOD,
  PERIOD_OPTIONS,
  SNAPSHOT_NOTE,
  canOpenReports,
} from "./reports-view";

export default function ReportsScreen() {
  const { ctx, role } = useOperations();
  const mayView = canOpenReports(role);

  const [period, setPeriod] = useState<ReportPeriod>(DEFAULT_PERIOD);
  const [announcement, setAnnouncement] = useState("");

  /* Reports opens no dialog, so the render-time reset the list modules use to
     close one has a smaller job here: a role that can no longer open the
     module must not be left with its predecessor's announcement sitting in the
     live region. Done during render so no frame paints with it. */
  const [gatedFor, setGatedFor] = useState(String(mayView));
  if (gatedFor !== String(mayView)) {
    setGatedFor(String(mayView));
    setAnnouncement("");
  }

  /**
   * One read for the whole page.
   *
   * Four collections, one selector, one answer, and the four are exactly what
   * the four report groups are counted from: nothing is read that nothing on
   * the page shows. Keyed on the role because a role change is a different
   * question and the previous answer is dropped rather than shown while the new
   * one is read (D-058), and on the period because a different window is a
   * different question too.
   */
  const { data } = useDemoQuery(async () => {
    if (!ctx || !mayView) return null;
    const [leads, vehicles, contracts, payments] = await Promise.all([
      read.leads(ctx),
      read.vehicles(ctx),
      read.contracts(ctx),
      resolvedPayments(ctx),
    ]);

    /* The logical clock, never the machine's. The window is measured from the
       demo's own now, so the same seed produces the same report on any day. */
    return selectReports({
      now: ctx.runtime.now(),
      period,
      leads,
      vehicles,
      contracts,
      payments,
    });
  }, [role, period]);

  const changePeriod = useCallback((value: string) => {
    /* Read back off the frozen list rather than cast: an unknown value falls
       to the default instead of reaching the selector as a period it has no
       branch for. */
    const next = PERIOD_OPTIONS.find((o) => o.value === value)?.value ?? DEFAULT_PERIOD;
    setPeriod(next);
    /* The select announces its own new value. What it cannot say is that the
       figures underneath have been recounted, and which one has not. */
    setAnnouncement(
      `Report period ${next}. The panels are recounted, apart from the fleet snapshot.`
    );
  }, []);

  if (!mayView) {
    return <ReportsUnavailable role={role} />;
  }

  return (
    <div className="ops-reports">
      {/* Focusable for the same reason every module heading here is: it is the
          landmark a visitor can be sent to. Reports opens nothing, so nothing
          on this screen claims it. */}
      <h2 className="visually-hidden" tabIndex={-1}>
        Reports
      </h2>

      <div className="ops-reports__head">
        <OpsSelect
          label="Period"
          srLabel="Report period"
          value={period}
          active={period !== DEFAULT_PERIOD}
          onChange={changePeriod}
          options={PERIOD_OPTIONS}
        />
        <p className="ops-reports__note">{SNAPSHOT_NOTE}</p>
      </div>

      <p className="ops-reports__note">
        Every figure here is counted from the synthetic records held in this browser, and
        the period is measured on the demo clock rather than on real time. Nothing is
        compared against a previous period: the dataset does not contain one.
      </p>

      {data ? (
        <ReportGrid data={data} />
      ) : (
        /* The skeleton is for having nothing to show, not for refreshing what
           is already on screen. `useDemoQuery` keeps the previous answer while
           it re-reads, so changing the period updates the figures in place
           instead of blanking the page once per change. */
        <ReportsSkeleton panels={4} />
      )}

      {/* The screen's one live region. It carries the loading state as well as
          the period announcement, because a second status element would be a
          second thing talking over the first. */}
      <p className="visually-hidden" role="status" aria-live="polite">
        {data ? announcement : "Loading reports"}
      </p>
    </div>
  );
}

/**
 * The four panels, in the Overview's own grid, in the specification's order.
 *
 * Every role that can open Reports sees all four, the Finance Analyst
 * included. The CRM Funnel is one of the four frozen groups, not an optional
 * extra, and D-092 is the rule that settles the rest: the thing withheld from a
 * role is the link, never the information. So Finance reads the funnel and is
 * simply given no way into Leads from here, which is the same treatment the
 * Fleet Coordinator gets for a customer's name.
 */
function ReportGrid({ data }: { data: ReportsData }) {
  const panels: React.ReactNode[] = [
    <LeadFunnelReport key="funnel" rows={data.crmFunnel} />,
    <FleetUtilisation key="fleet" data={data.fleetUtilization} />,
    <ContractValue
      key="contracts"
      rows={data.contractStatus}
      values={data.contractValue}
      totals={data.contractTotals}
    />,
    <PaymentReport key="payments" data={data.paymentStatus} />,
  ];

  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < panels.length; i += 2) rows.push(panels.slice(i, i + 2));

  return (
    <div className="ops-overview">
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

function ReportsSkeleton({ panels }: { panels: number }) {
  const rows = Math.ceil(panels / 2);
  return (
    <div className="ops-overview" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <div className="ops-overview__row" key={i}>
          <div className="ops-panel ops-skeleton ops-skeleton--panel" />
          <div className="ops-panel ops-skeleton ops-skeleton--panel" />
        </div>
      ))}
    </div>
  );
}

/**
 * What a role that cannot open Reports sees.
 *
 * The Sales Agent and the Fleet Coordinator land here, and they are the reason
 * this panel is contained rather than a redirect: sending someone elsewhere
 * would hide both that the module exists and that their role is why it is
 * closed. Naming the role is the whole point of the screen.
 */
function ReportsUnavailable({ role }: { role: Role }) {
  return (
    <div className="ops-unavailable" role="note">
      <p className="ops-unavailable__eyebrow">Module unavailable</p>
      <p className="ops-unavailable__text">
        The <strong>{role}</strong> role does not open reports in this simulation. Switch
        the demo role in the bar above to one that does.
      </p>
      <p className="ops-unavailable__note">
        The permission matrix is simulated to show where rules are enforced. It is not
        authentication, and the synthetic records stay in this browser either way.
      </p>
    </div>
  );
}
