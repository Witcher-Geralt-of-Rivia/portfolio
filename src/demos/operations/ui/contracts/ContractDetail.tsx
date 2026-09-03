"use client";

/**
 * Operations demo: one contract, in full.
 *
 * The drawer geometry and focus behaviour the earlier modules settled on, with
 * four sections: the rental, the money, where the contract came from, and what
 * has happened to it.
 *
 * It is handed the joined row rather than the stored record. A contract stores
 * a customer id and a vehicle id and no names, and the list already resolved
 * both for the whole page; reading them again here would be a second join that
 * could disagree with the row a visitor just clicked. The one thing the row
 * cannot carry is the audit trail, so that is the only read this component
 * makes.
 *
 * Where a visitor may go from here depends on the role (D-092). Customers,
 * Reservations and Fleet each become a link for a role that can open them and a
 * plain fact for one that cannot, which is why a Finance Analyst sees the
 * originating reservation as a reference and not as a door.
 */

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";

import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { C } from "../../constants";
import type { ContractRow } from "../../selectors/contracts-list";
import { absoluteDate, relativeDate } from "../../selectors/leads-list";
import { selectActivity } from "../../selectors/queries";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import {
  STATUS_TONE,
  actionsFor,
  canOpenCustomer,
  canOpenFleet,
  canOpenReservations,
  customerHref,
  formatCents,
  reservationHref,
  vehicleHref,
} from "./contracts-view";

type Props = {
  contract: ContractRow | null;
  missingId: string | null;
  mayWrite: boolean;
  onClose: () => void;
  onDismissMissing: () => void;
  onActivate: () => void;
  onComplete: () => void;
  onCancel: () => void;
};

/** Cents are stored, money is shown. The conversion happens once, here. */
const money = (cents: number) => `USD ${formatCents(cents)}`;

export default function ContractDetail({
  contract,
  missingId,
  mayWrite,
  onClose,
  onDismissMissing,
  onActivate,
  onComplete,
  onCancel,
}: Props) {
  const { ctx, role } = useOperations();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const contractId = contract?.id ?? null;

  /**
   * The audit trail, and nothing else.
   *
   * Keyed on the role as well as the record, so a role change drops the
   * previous answer rather than showing it for a frame (D-058).
   */
  const { data } = useDemoQuery(async () => {
    if (!ctx || !contractId) return null;
    const audit = await ctx.runtime.listAudit();
    return { activity: selectActivity(audit, C.contracts, contractId) };
  }, [role, contractId]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [contractId]);

  const actions = useMemo(() => (contract ? actionsFor(contract.status) : null), [contract]);

  if (missingId) {
    return (
      <OpsOverlay variant="drawer" label="Contract unavailable" onClose={onDismissMissing}>
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Contract unavailable
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
            No contract in this demo has the id <code>{missingId}</code>. The demo data
            may have been reset since the link was made.
          </p>
          <button type="button" className="ops-button" onClick={onDismissMissing}>
            Back to the list
          </button>
        </div>
      </OpsOverlay>
    );
  }

  if (!contract) {
    return (
      <OpsOverlay variant="drawer" label="Contract" onClose={onClose} className="ops-detail">
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Contract
          </h2>
          <button type="button" className="ops-icon-button" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="ops-detail__body" aria-busy="true">
          <div className="ops-skeleton ops-skeleton--line" />
          <div className="ops-skeleton ops-skeleton--line" />
          <p className="visually-hidden" role="status">
            Loading contract
          </p>
        </div>
      </OpsOverlay>
    );
  }

  const now = ctx?.runtime.now() ?? null;
  const settled = contract.remainingBalance === 0;

  return (
    <OpsOverlay
      variant="drawer"
      label={`Contract for ${contract.customerName}`}
      onClose={onClose}
      className="ops-detail"
    >
      <div className="ops-detail__head">
        <div className="ops-detail__identity">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            {contract.customerName}
          </h2>
          <p className="ops-detail__id">{contract.id}</p>
          <p className="ops-detail__marks">
            <span className={`ops-pill ops-pill--${STATUS_TONE[contract.status]}`}>
              {contract.status}
            </span>
            <span className="ops-detail__interest">
              {contract.vehicleClass ?? "Class not resolved"}
            </span>
            {/* Money in the header as a word, not a figure: the header answers
                whether this contract needs attention, and the Money section
                below answers how much. */}
            <span className="ops-detail__interest">{settled ? "Settled" : "Balance due"}</span>
          </p>
        </div>
        <button
          type="button"
          className="ops-icon-button"
          onClick={onClose}
          aria-label="Close contract"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="ops-detail__body">
        <section className="ops-detail__section" aria-labelledby="ops-contract-rental">
          <h3 className="ops-detail__section-title" id="ops-contract-rental">
            Rental
          </h3>
          <dl className="ops-facts">
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Customer</dt>
              <dd className="ops-facts__value">
                {canOpenCustomer(role) ? (
                  <Link className="ops-link-button" href={customerHref(contract.customerId)}>
                    {contract.customerName}
                  </Link>
                ) : (
                  /* The name, always. Only the way through is withheld. */
                  contract.customerName
                )}
              </dd>
            </div>
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Vehicle</dt>
              <dd className="ops-facts__value">
                {canOpenFleet(role) && contract.vehicleLabel ? (
                  <Link className="ops-link-button" href={vehicleHref(contract.vehicleId)}>
                    {contract.vehicleLabel}
                  </Link>
                ) : (
                  /* A link whose text is "Not resolved" tells nobody where it
                     leads, so an unresolved vehicle stays a plain fact even for
                     a role that could open Fleet. */
                  (contract.vehicleLabel ?? "Not resolved")
                )}
              </dd>
            </div>
            <Fact label="Starts" value={absoluteDate(contract.startAt)} />
            <Fact label="Ends" value={absoluteDate(contract.endAt)} />
            <Fact
              label="Updated"
              value={now ? relativeDate(contract.updatedAt, now) : "-"}
              title={absoluteDate(contract.updatedAt)}
            />
          </dl>
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-contract-money">
          <h3 className="ops-detail__section-title" id="ops-contract-money">
            Money
          </h3>
          <dl className="ops-facts">
            <Fact label="Daily rate" value={money(contract.dailyRate)} />
            <Fact label="Total" value={money(contract.totalAmount)} />
            <Fact label="Paid" value={money(contract.paidAmount)} />
            {/* The subtraction belongs to the selector and is made from the two
                figures above it, so the balance can never drift from them. */}
            <Fact label="Remaining balance" value={money(contract.remainingBalance)} />
          </dl>
        </section>

        {contract.reservationId && (
          <section className="ops-detail__section" aria-labelledby="ops-contract-origin">
            <h3 className="ops-detail__section-title" id="ops-contract-origin">
              Origin
            </h3>
            <dl className="ops-facts">
              <div className="ops-facts__row">
                <dt className="ops-facts__label">Reservation</dt>
                <dd className="ops-facts__value">
                  {canOpenReservations(role) ? (
                    <Link
                      className="ops-link-button"
                      href={reservationHref(contract.reservationId)}
                    >
                      Open reservation
                    </Link>
                  ) : (
                    /* A Finance Analyst does not work bookings, so the booking
                       is named and not opened: the reference is still what ties
                       a figure here to a decision made elsewhere. */
                    <code className="ops-detail__ref">{contract.reservationId}</code>
                  )}
                </dd>
              </div>
            </dl>
          </section>
        )}

        <section className="ops-detail__section" aria-labelledby="ops-contract-activity">
          <h3 className="ops-detail__section-title" id="ops-contract-activity">
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
              {data ? "Nothing has happened to this contract yet." : " "}
            </p>
          )}
        </section>

        {!mayWrite && (
          /* Said plainly, once, at the foot of a complete record. Hiding a
             section instead would leave a reader wondering what was missing
             rather than knowing why nothing can be moved. */
          <p className="ops-contracts__readonly">
            The <strong>{role}</strong> role reads contracts in this simulation and does not
            move them, so no lifecycle action is offered here. Everything above is the live
            record: nothing is withheld to signal the restriction.
          </p>
        )}
      </div>

      {mayWrite && actions && (actions.activate || actions.complete || actions.cancel) && (
        <div className="ops-detail__actions">
          <div className="ops-detail__buttons">
            {actions.activate && (
              <button type="button" className="ops-button ops-button--primary" onClick={onActivate}>
                Activate contract
              </button>
            )}
            {actions.complete && (
              <button type="button" className="ops-button ops-button--primary" onClick={onComplete}>
                Complete contract
              </button>
            )}
            {actions.cancel && (
              <button type="button" className="ops-button ops-button--quiet" onClick={onCancel}>
                Cancel contract
              </button>
            )}
          </div>
        </div>
      )}
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
