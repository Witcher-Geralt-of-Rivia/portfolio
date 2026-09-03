"use client";

/**
 * Operations demo: the Payments module.
 *
 * The list grammar the earlier modules settled on, inherited rather than
 * reinvented: the same table and card pair, the same drawer, the same approved
 * selects, the same URL contract for selection, the same role gate and the same
 * single polite announcement.
 *
 * Two things belong to this module alone.
 *
 * The first is that Overdue is not a stored value. A payment record only ever
 * says Pending or Paid; `derivePaymentStatus` compares the due date with the
 * demo's logical clock and produces the third state at read time (D-053). So
 * the filter, the sort, the tally and every pill on this page read the derived
 * status, and a reset or a change of clock can never leave a stale flag behind.
 *
 * The second follows from the first, and is the reason this screen has an
 * effect at all. Rule 04 listens for `payment.overdue`, and no mutation ever
 * raises it: nothing happens to a payment when it becomes late except that time
 * passes. `reconcileOverdueWorkflow` is how that transition is announced to the
 * automation layer, and it is called when the module opens and again after a
 * payment is recorded. Not on a timer: there is no timer anywhere in this
 * product, and the wall clock is never read.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { read } from "../../services/context";
import { reconcileOverdueWorkflow } from "../../services/payment-workflows";
import {
  DEFAULT_PAYMENT_QUERY,
  buildPaymentRows,
  isDefaultPaymentQuery,
  outstandingCents,
  paymentStatusTally,
  selectPaymentList,
  type PaymentListQuery,
  type PaymentRow,
} from "../../selectors/payments-list";
import type { Role } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsPagination from "../OpsPagination";
import PaymentDetail from "./PaymentDetail";
import PaymentsMobileList from "./PaymentsMobileList";
import PaymentsTable from "./PaymentsTable";
import PaymentsToolbar from "./PaymentsToolbar";
import RecordPaymentForm from "./RecordPaymentForm";
import { canOpenPayments, canWorkPayments } from "./payments-view";

type Overlay =
  | { kind: "none" }
  | { kind: "filters" }
  /* The contract travels on the overlay so a caller that arrives holding one
     can open the form against it. The toolbar has none in hand. */
  | { kind: "record"; contractId: string | null };

const CLOSED: Overlay = { kind: "none" };

export default function PaymentsScreen() {
  const { ctx, role } = useOperations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");

  const mayView = canOpenPayments(role);
  const mayWrite = canWorkPayments(role);

  const [query, setQuery] = useState<PaymentListQuery>(DEFAULT_PAYMENT_QUERY);
  const [overlay, setOverlay] = useState<Overlay>(CLOSED);
  const [announcement, setAnnouncement] = useState("");

  const returnFocusRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<"heading" | HTMLElement | null>(null);

  /* A role that can no longer open the module, or no longer write in it, must
     not be left looking at a live form. Done during render so no frame paints
     with it. */
  const [gatedFor, setGatedFor] = useState(`${mayView}:${mayWrite}`);
  if (gatedFor !== `${mayView}:${mayWrite}`) {
    setGatedFor(`${mayView}:${mayWrite}`);
    setOverlay((current) => (current.kind === "filters" && mayView ? current : CLOSED));
  }

  /**
   * One role-keyed query for everything the screen joins.
   *
   * A payment names a customer and a contract and carries neither name nor
   * status, so both collections are read here and joined once for the whole
   * page. The logical instant is read inside the query rather than during
   * render, so the derived Overdue state is computed against the same clock the
   * records were read at, and a commit that advances the clock re-runs this.
   * Keyed on the role because a role change is a different question (D-058).
   */
  const { data, loading } = useDemoQuery(async () => {
    if (!ctx || !mayView) return null;
    const [payments, customers, contracts] = await Promise.all([
      read.payments(ctx),
      read.customers(ctx),
      read.contracts(ctx),
    ]);
    return { payments, customers, contracts, now: ctx.runtime.now() };
  }, [role, mayView]);

  const rows = useMemo(() => (data ? buildPaymentRows(data) : null), [data]);
  const tally = useMemo(() => (rows ? paymentStatusTally(rows) : {}), [rows]);
  const result = useMemo(
    () => (rows ? selectPaymentList(rows, query) : null),
    [rows, query]
  );

  /**
   * What is still owed across everything the filters matched.
   *
   * Over the whole matched set rather than the page on screen: paging is how
   * the list is read, not what the figure is about, and a total that changed
   * when someone turned a page would be describing the viewport. `pageSize: 0`
   * is the selector's own way of asking for no paging.
   */
  const outstanding = useMemo(() => {
    if (!rows) return null;
    const matched = selectPaymentList(rows, { ...query, page: 1, pageSize: 0 }).items;
    return {
      cents: outstandingCents(matched),
      count: matched.filter((r) => r.effectiveStatus !== "Paid").length,
    };
  }, [rows, query]);

  /* The joined row rather than the stored record: the customer name and the
     effective status are both products of the join, and the drawer wants the
     resolved version the visitor just clicked. */
  const selected: PaymentRow | null = useMemo(() => {
    if (!selectedId || !rows) return null;
    return rows.find((r) => r.id === selectedId) ?? null;
  }, [selectedId, rows]);

  /* "Not a payment" and "not read yet" are different answers. */
  const missingId = selectedId && !selected && !loading ? selectedId : null;

  /* The names the record-payment form needs to label a contract. Built from the
     customers this page already read, so the form makes no second join. */
  const customerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const customer of data?.customers ?? []) {
      map.set(customer.id, customer.data.displayName);
    }
    return map;
  }, [data]);

  const announceOverdue = useCallback((count: number) => {
    if (count === 0) return;
    const line =
      count === 1
        ? "1 payment passed its due date and Finance was notified"
        : `${count} payments passed their due date and Finance was notified`;
    /* Appended rather than replacing. A reconciliation that follows a recorded
       payment must not swallow the confirmation the visitor is waiting for. */
    setAnnouncement((current) => (current ? `${current}. ${line}` : line));
  }, []);

  /**
   * The reconciliation currently in flight, so a second call queues behind it.
   *
   * `reconcileTimeDerivedState` is idempotent because it skips any payment that
   * already carries a Finance notification, and that guard only works if the
   * previous pass has finished writing them. Two overlapping calls both read
   * the world before either has committed, so both raise the same events and
   * the visitor gets the alert twice.
   *
   * The module reconciles when it opens and again after a payment is recorded,
   * and raising three events takes several commits, so a visitor who records
   * one promptly can start the second pass before the first has finished. The
   * guard is cheap and the failure it prevents is a duplicated Finance alert.
   *
   * Serialised rather than dropped. Dropping the second call would be wrong in
   * the one case that matters: every mutation advances the logical clock, so
   * recording a payment can itself tip another payment past its due date, and
   * that transition deserves the pass it would have had.
   */
  const inFlight = useRef<Promise<void>>(Promise.resolve());

  /**
   * Raise the overdue transition, and say so if it produced anything.
   *
   * The state is set in the promise's continuation rather than in the effect
   * body, which is the one place a screen in this codebase is allowed to write
   * state from an effect: the write happens after the await, not during the
   * synchronous pass that would cascade a render.
   */
  const reconcile = useCallback(() => {
    if (!ctx) return;
    inFlight.current = inFlight.current
      .catch(() => {})
      .then(() => reconcileOverdueWorkflow(ctx))
      .then((outcomes) => announceOverdue(outcomes.length))
      .catch(() => {
        /* Nothing is said. The list is already correct without this: Overdue is
           derived on every read, so a failed reconciliation costs the Finance
           notification and nothing a visitor is looking at. */
      });
  }, [ctx, announceOverdue]);

  /**
   * Once per role, when the module opens.
   *
   * The ref is what makes React 19's double mount in development a single call.
   * The workflow is idempotent by construction anyway, since a payment whose
   * Finance notification already exists is never raised again, so a second call
   * would produce no second alert; the guard keeps it from producing a second
   * commit either.
   */
  const reconciledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ctx || !mayWrite) return;
    if (reconciledFor.current === role) return;
    reconciledFor.current = role;
    reconcile();
  }, [ctx, mayWrite, role, reconcile]);

  const select = useCallback(
    (id: string | null, trigger?: HTMLElement | null) => {
      if (trigger) returnFocusRef.current = trigger;
      const next = id ? `${pathname}?selected=${encodeURIComponent(id)}` : pathname;
      router.push(next, { scroll: false });
    },
    [pathname, router]
  );

  const clearSelection = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  /* Focus is claimed once the navigation has landed: the router moves focus
     after the drawer unmounts, so claiming it earlier is undone. */
  useEffect(() => {
    if (selectedId) return;
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target !== "heading" && target.isConnected) target.focus();
    else headingRef.current?.focus();
  }, [selectedId]);

  const patch = useCallback((next: Partial<PaymentListQuery>) => {
    setQuery((current) => ({
      ...current,
      ...next,
      page: "page" in next ? (next.page as number) : 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    /* Sort and page size survive: they are how the visitor reads the list, not
       what they are looking for in it. */
    setQuery((current) => ({
      ...DEFAULT_PAYMENT_QUERY,
      sort: current.sort,
      direction: current.direction,
      pageSize: current.pageSize,
    }));
    setAnnouncement("Filters cleared");
  }, []);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  if (!mayView) {
    return <PaymentsUnavailable role={role} />;
  }

  const isDefault = isDefaultPaymentQuery(query);

  return (
    <div className="ops-payments">
      <h2 className="visually-hidden" ref={headingRef} tabIndex={-1}>
        Payments
      </h2>

      <PaymentsToolbar
        query={query}
        total={result?.total ?? null}
        tally={tally}
        outstanding={outstanding}
        mayWrite={mayWrite}
        filtersOpen={overlay.kind === "filters"}
        onPatch={patch}
        onClear={clearFilters}
        onOpenFilters={() => setOverlay({ kind: "filters" })}
        onCloseFilters={() => setOverlay(CLOSED)}
        onRecord={() => setOverlay({ kind: "record", contractId: null })}
      />

      {result && result.total === 0 ? (
        <div className="ops-leads__empty">
          <p className="ops-leads__empty-text">
            {isDefault
              ? "There are no payments yet. One appears here when a payment is recorded against a contract."
              : "No payments match these filters."}
          </p>
          {!isDefault && (
            <button type="button" className="ops-button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <PaymentsTable
            rows={result?.items ?? null}
            selectedId={selectedId}
            sort={query.sort}
            direction={query.direction}
            onSort={(sort, direction) => patch({ sort, direction })}
            onSelect={select}
          />
          <PaymentsMobileList
            rows={result?.items ?? null}
            selectedId={selectedId}
            onSelect={select}
          />
          <OpsPagination
            result={result}
            pageSize={query.pageSize}
            onPage={(page) => patch({ page })}
            onPageSize={(pageSize) => patch({ pageSize })}
          />
        </>
      )}

      {selectedId && (
        <PaymentDetail
          payment={selected}
          missingId={missingId}
          onClose={() => {
            pendingFocus.current = returnFocusRef.current ?? "heading";
            select(null);
          }}
          onDismissMissing={clearSelection}
        />
      )}

      {overlay.kind === "record" && (
        <RecordPaymentForm
          contracts={data?.contracts ?? []}
          customerNameById={customerNameById}
          initialContractId={overlay.contractId}
          onClose={() => setOverlay(CLOSED)}
          onRecorded={() => {
            setOverlay(CLOSED);
            /* Recording advances the logical clock, which can carry another
               payment past its due date, so the transition is raised again. */
            reconcile();
          }}
          onAnnounce={announce}
        />
      )}

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/**
 * What a role that cannot open Payments sees.
 *
 * Two of the four roles land here. A Sales Agent works the pipeline and a Fleet
 * Coordinator works the vehicles, and neither has any business in the ledger,
 * so the module is closed to both rather than shown inert. It is contained
 * rather than a redirect, for the reason every module here gives: sending
 * someone elsewhere hides both that the module exists and that their role is
 * why it is closed.
 */
function PaymentsUnavailable({ role }: { role: Role }) {
  return (
    <div className="ops-unavailable" role="note">
      <p className="ops-unavailable__eyebrow">Module unavailable</p>
      <p className="ops-unavailable__text">
        The <strong>{role}</strong> role does not open Payments in this simulation. Switch
        the demo role in the bar above to Admin or Finance Analyst to see the ledger.
      </p>
      <p className="ops-unavailable__note">
        The permission matrix is simulated to show where rules are enforced. It is not
        authentication, and the synthetic records stay in this browser either way.
      </p>
    </div>
  );
}
