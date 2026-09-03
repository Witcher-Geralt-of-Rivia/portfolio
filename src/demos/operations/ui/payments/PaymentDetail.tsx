"use client";

/**
 * Operations demo: one payment, in full.
 *
 * The drawer geometry and focus behaviour the earlier modules settled on, with
 * three sections: the payment, its status, and what has happened to it.
 *
 * It is handed the joined row rather than the stored record, for the reason the
 * Contracts drawer gives: the customer name and the derived status are products
 * of the join the list already made, and reading them again here would be a
 * second join that could disagree with the row a visitor just clicked. The one
 * thing the row cannot carry is the audit trail, so that is the only read this
 * component makes.
 *
 * There are no action buttons, and that absence is the design. The domain has
 * no update and no delete for a single payment: the ledger is append-only, and
 * a contract's balance moves by recording another payment against it. A button
 * here would be a promise the services cannot keep.
 *
 * The Status section is the point of the module. It prints what is stored
 * beside what the clock says, because those two are allowed to differ and the
 * difference is the whole design (D-053).
 */

import { useEffect, useRef } from "react";
import Link from "next/link";

import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { C } from "../../constants";
import { absoluteDate, relativeDate } from "../../selectors/leads-list";
import type { PaymentRow } from "../../selectors/payments-list";
import { selectActivity } from "../../selectors/queries";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import {
  STATUS_TONE,
  canOpenContracts,
  canOpenCustomer,
  contractHref,
  customerHref,
  formatCents,
} from "./payments-view";

type Props = {
  payment: PaymentRow | null;
  missingId: string | null;
  onClose: () => void;
  onDismissMissing: () => void;
};

export default function PaymentDetail({
  payment,
  missingId,
  onClose,
  onDismissMissing,
}: Props) {
  const { ctx, role } = useOperations();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const paymentId = payment?.id ?? null;

  /**
   * The audit trail, and nothing else.
   *
   * Keyed on the role as well as the record, so a role change drops the
   * previous answer rather than showing it for a frame (D-058).
   */
  const { data } = useDemoQuery(async () => {
    if (!ctx || !paymentId) return null;
    const audit = await ctx.runtime.listAudit();
    return { activity: selectActivity(audit, C.payments, paymentId) };
  }, [role, paymentId]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [paymentId]);

  if (missingId) {
    return (
      <OpsOverlay variant="drawer" label="Payment unavailable" onClose={onDismissMissing}>
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Payment unavailable
          </h2>
          <button
            type="button"
            className="ops-icon-button"
            onClick={onDismissMissing}
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="ops-detail__body">
          <p className="ops-detail__missing">
            No payment in this demo has the id <code>{missingId}</code>. The demo data
            may have been reset since the link was made.
          </p>
          <button type="button" className="ops-button" onClick={onDismissMissing}>
            Back to the list
          </button>
        </div>
      </OpsOverlay>
    );
  }

  if (!payment) {
    return (
      <OpsOverlay variant="drawer" label="Payment" onClose={onClose} className="ops-detail">
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Payment
          </h2>
          <button type="button" className="ops-icon-button" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="ops-detail__body" aria-busy="true">
          <div className="ops-skeleton ops-skeleton--line" />
          <div className="ops-skeleton ops-skeleton--line" />
          <p className="visually-hidden" role="status">
            Loading payment
          </p>
        </div>
      </OpsOverlay>
    );
  }

  const now = ctx?.runtime.now() ?? null;

  return (
    <OpsOverlay
      variant="drawer"
      label={`Payment from ${payment.customerName}`}
      onClose={onClose}
      className="ops-detail"
    >
      <div className="ops-detail__head">
        <div className="ops-detail__identity">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            {payment.customerName}
          </h2>
          <p className="ops-detail__id">{payment.id}</p>
          <p className="ops-detail__marks">
            <span className={`ops-pill ops-pill--${STATUS_TONE[payment.effectiveStatus]}`}>
              {payment.effectiveStatus}
            </span>
            <span className="ops-detail__interest">{payment.category}</span>
            {/* Whether the money has been taken down, said as a word. The date
                it happened on is a fact in the section below. */}
            <span className="ops-detail__interest">
              {payment.paidAt ? "Recorded" : "Awaiting payment"}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="ops-icon-button"
          onClick={onClose}
          aria-label="Close payment"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="ops-detail__body">
        <section className="ops-detail__section" aria-labelledby="ops-payment-facts">
          <h3 className="ops-detail__section-title" id="ops-payment-facts">
            Payment
          </h3>
          <dl className="ops-facts">
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Customer</dt>
              <dd className="ops-facts__value">
                {canOpenCustomer(role) ? (
                  <Link className="ops-link-button" href={customerHref(payment.customerId)}>
                    {payment.customerName}
                  </Link>
                ) : (
                  /* The name, always. Only the way through is withheld. */
                  payment.customerName
                )}
              </dd>
            </div>
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Contract</dt>
              <dd className="ops-facts__value">
                {canOpenContracts(role) ? (
                  <Link className="ops-link-button" href={contractHref(payment.contractId)}>
                    {payment.contractId}
                  </Link>
                ) : (
                  /* Named and not opened, which is still what ties this figure
                     to the agreement it was filed against. */
                  <code className="ops-detail__ref">{payment.contractId}</code>
                )}
              </dd>
            </div>
            <Fact label="Amount" value={`USD ${formatCents(payment.amount)}`} />
            <Fact label="Category" value={payment.category} />
            <Fact label="Due date" value={absoluteDate(payment.dueAt)} />
            <Fact
              label="Paid date"
              value={payment.paidAt ? absoluteDate(payment.paidAt) : "Not recorded"}
            />
            <Fact
              label="Updated"
              value={now ? relativeDate(payment.updatedAt, now) : "-"}
              title={absoluteDate(payment.updatedAt)}
            />
          </dl>
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-payment-status">
          <h3 className="ops-detail__section-title" id="ops-payment-status">
            Status
          </h3>
          <dl className="ops-facts">
            <Fact label="Stored" value={payment.storedStatus} />
            <Fact label="Effective" value={payment.effectiveStatus} />
          </dl>
          {/* The most interesting thing about this module, said plainly where a
              reader can see the two values it is talking about. */}
          <p className="ops-payments__note">
            A payment record only ever stores Pending or Paid. Overdue is worked out on
            every read by comparing the due date with the demo&apos;s own clock, so it is
            never written to the record and a reset or a change of clock cannot leave it
            stale.
          </p>
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-payment-activity">
          <h3 className="ops-detail__section-title" id="ops-payment-activity">
            Activity
          </h3>
          {data && data.activity.length > 0 ? (
            <ol className="ops-activity">
              {data.activity.map((entry) => (
                <li className="ops-activity__item" key={entry.sequence}>
                  <p className="ops-activity__summary">{entry.summary}</p>
                  <p className="ops-activity__meta">
                    <span className="ops-activity__actor">{entry.actor}</span>
                    <span className="ops-activity__dot" aria-hidden="true">
                      ·
                    </span>
                    <time dateTime={absoluteDate(entry.occurredAt)}>
                      {now ? relativeDate(entry.occurredAt, now) : ""}
                    </time>
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ops-empty">
              {data ? "Nothing has happened to this payment yet." : " "}
            </p>
          )}
        </section>
      </div>
    </OpsOverlay>
  );
}

function Fact({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="ops-facts__row">
      <dt className="ops-facts__label">{label}</dt>
      <dd className="ops-facts__value" title={title}>
        {value}
      </dd>
    </div>
  );
}
