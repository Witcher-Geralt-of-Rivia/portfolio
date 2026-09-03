"use client";

/**
 * Operations demo: one reservation, in full.
 *
 * The Leads and Customers drawer geometry and focus behaviour. Four sections:
 * the booking, the vehicle, the notes, and what it became.
 *
 * Where a visitor may go from here depends on what is built, and on what the
 * role may open (D-092). Customers, Fleet and Contracts all exist now, so the
 * customer, the assigned vehicle and the converted contract are each a link
 * for a role that can reach them and a plain fact for one that cannot.
 */

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";

import type { DemoRecord } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { C } from "../../constants";

import { absoluteDate, relativeDate } from "../../selectors/leads-list";
import { selectActivity } from "../../selectors/queries";
import { vehicleLabelOf } from "../../selectors/reservations-list";
import { read } from "../../services/context";
import type { Reservation, Vehicle } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import {
  STATUS_TONE,
  actionsFor,
  canOpenContracts,
  canOpenCustomer,
  canOpenFleet,
  canOpenInbox,
  contractHref,
  conversationHref,
  customerHref,
  vehicleHref,
} from "./reservations-view";

type Props = {
  reservation: DemoRecord<Reservation> | null;
  customerName: string;
  missingId: string | null;
  mayWrite: boolean;
  onClose: () => void;
  onDismissMissing: () => void;
  onEdit: () => void;
  onConfirm: () => void;
  onConvert: () => void;
  onCancel: () => void;
};

export default function ReservationDetail({
  reservation,
  customerName,
  missingId,
  mayWrite,
  onClose,
  onDismissMissing,
  onEdit,
  onConfirm,
  onConvert,
  onCancel,
}: Props) {
  const { ctx, role } = useOperations();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reservationId = reservation?.id ?? null;
  const customerId = reservation?.data.customerId ?? null;
  const vehicleId = reservation?.data.vehicleId ?? null;

  /**
   * Keyed on the role as well as the record, so a role change drops the
   * previous answer rather than showing it for a frame (D-058).
   */
  const { data } = useDemoQuery(async () => {
    if (!ctx || !reservationId) return null;
    const seesInbox = canOpenInbox(role);
    const [vehicles, conversations, audit] = await Promise.all([
      vehicleId ? read.vehicles(ctx) : Promise.resolve([] as DemoRecord<Vehicle>[]),
      seesInbox && customerId ? read.conversations(ctx) : Promise.resolve([]),
      ctx.runtime.listAudit(),
    ]);
    return {
      vehicle: vehicleId ? (vehicles.find((v) => v.id === vehicleId) ?? null) : null,
      /* The customer's own thread, so a confirmation that just appended a
         system message has somewhere to be read. */
      conversation:
        conversations.find(
          (c) => c.data.subjectType === "Customer" && c.data.subjectId === customerId
        ) ?? null,
      activity: selectActivity(audit, C.reservations, reservationId),
    };
  }, [role, reservationId, vehicleId, customerId]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [reservationId]);

  const actions = useMemo(
    () => (reservation ? actionsFor(reservation.data.status) : null),
    [reservation]
  );

  if (missingId) {
    return (
      <OpsOverlay variant="drawer" label="Reservation unavailable" onClose={onDismissMissing}>
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Reservation unavailable
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
            No reservation in this demo has the id <code>{missingId}</code>. The demo data
            may have been reset since the link was made.
          </p>
          <button type="button" className="ops-button" onClick={onDismissMissing}>
            Back to the list
          </button>
        </div>
      </OpsOverlay>
    );
  }

  if (!reservation) {
    return (
      <OpsOverlay variant="drawer" label="Reservation" onClose={onClose} className="ops-detail">
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Reservation
          </h2>
          <button type="button" className="ops-icon-button" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="ops-detail__body" aria-busy="true">
          <div className="ops-skeleton ops-skeleton--line" />
          <div className="ops-skeleton ops-skeleton--line" />
          <p className="visually-hidden" role="status">
            Loading reservation
          </p>
        </div>
      </OpsOverlay>
    );
  }

  const now = ctx?.runtime.now() ?? null;
  const r = reservation.data;

  return (
    <OpsOverlay
      variant="drawer"
      label={`Reservation for ${customerName}`}
      onClose={onClose}
      className="ops-detail"
    >
      <div className="ops-detail__head">
        <div className="ops-detail__identity">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            {customerName}
          </h2>
          <p className="ops-detail__id">{reservation.id}</p>
          <p className="ops-detail__marks">
            <span className={`ops-pill ops-pill--${STATUS_TONE[r.status]}`}>{r.status}</span>
            <span className="ops-detail__interest">{r.vehicleClass}</span>
            <span className="ops-detail__interest">
              {r.vehicleId ? "Vehicle assigned" : "No vehicle yet"}
            </span>
          </p>
        </div>
        <button
          type="button"
          className="ops-icon-button"
          onClick={onClose}
          aria-label="Close reservation"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="ops-detail__body">
        <section className="ops-detail__section" aria-labelledby="ops-res-booking">
          <h3 className="ops-detail__section-title" id="ops-res-booking">
            Booking
          </h3>
          <dl className="ops-facts">
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Customer</dt>
              <dd className="ops-facts__value">
                {canOpenCustomer(role) ? (
                  <Link className="ops-link-button" href={customerHref(r.customerId)}>
                    {customerName}
                  </Link>
                ) : (
                  /* The name, always. Only the way through is withheld. */
                  customerName
                )}
              </dd>
            </div>
            <Fact label="Starts" value={absoluteDate(r.startAt)} />
            <Fact label="Ends" value={absoluteDate(r.endAt)} />
            <Fact label="Requested class" value={r.vehicleClass} />
            <Fact
              label="Updated"
              value={now ? relativeDate(reservation.updatedAt, now) : "-"}
              title={absoluteDate(reservation.updatedAt)}
            />
          </dl>
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-res-vehicle">
          <h3 className="ops-detail__section-title" id="ops-res-vehicle">
            Vehicle
          </h3>
          {r.vehicleId ? (
            data?.vehicle ? (
              <dl className="ops-facts">
                <div className="ops-facts__row">
                  <dt className="ops-facts__label">Assigned</dt>
                  <dd className="ops-facts__value">
                    {canOpenFleet(role) ? (
                      <Link className="ops-link-button" href={vehicleHref(data.vehicle.id)}>
                        {vehicleLabelOf(data.vehicle)}
                      </Link>
                    ) : (
                      /* The Sales Agent works reservations and not the fleet
                         register, so they get the machine's name and not the
                         way into it (D-092). */
                      vehicleLabelOf(data.vehicle)
                    )}
                  </dd>
                </div>
                <Fact label="Class" value={data.vehicle.data.vehicleClass} />
                <Fact label="Fleet status" value={data.vehicle.data.status} />
              </dl>
            ) : (
              <p className="ops-empty">Loading the assigned vehicle.</p>
            )
          ) : (
            <p className="ops-empty">
              No vehicle is assigned. A draft does not hold one: the vehicle is chosen when
              the reservation is confirmed.
            </p>
          )}
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-res-notes">
          <h3 className="ops-detail__section-title" id="ops-res-notes">
            Notes
          </h3>
          {r.notes ? (
            <p className="ops-customers__notes">{r.notes}</p>
          ) : (
            <p className="ops-empty">No notes on this reservation.</p>
          )}
        </section>

        {(r.convertedContractId || data?.conversation) && (
          <section className="ops-detail__section" aria-labelledby="ops-res-related">
            <h3 className="ops-detail__section-title" id="ops-res-related">
              Related
            </h3>
            <dl className="ops-facts">
              {r.convertedContractId && (
                <div className="ops-facts__row">
                  <dt className="ops-facts__label">Converted contract</dt>
                  <dd className="ops-facts__value">
                    {canOpenContracts(role) ? (
                      <Link
                        className="ops-link-button"
                        href={contractHref(r.convertedContractId)}
                      >
                        {r.convertedContractId}
                      </Link>
                    ) : (
                      <code className="ops-detail__ref">{r.convertedContractId}</code>
                    )}
                  </dd>
                </div>
              )}
              {data?.conversation && (
                <div className="ops-facts__row">
                  <dt className="ops-facts__label">Conversation</dt>
                  <dd className="ops-facts__value">
                    <Link
                      className="ops-link-button"
                      href={conversationHref(data.conversation.id)}
                    >
                      Open conversation
                    </Link>
                  </dd>
                </div>
              )}
            </dl>
          </section>
        )}

        <section className="ops-detail__section" aria-labelledby="ops-res-activity">
          <h3 className="ops-detail__section-title" id="ops-res-activity">
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
              {data ? "Nothing has happened to this reservation yet." : " "}
            </p>
          )}
        </section>
      </div>

      {mayWrite && actions && (actions.edit || actions.confirm || actions.convert || actions.cancel) && (
        <div className="ops-detail__actions">
          <div className="ops-detail__buttons">
            {actions.confirm && (
              <button type="button" className="ops-button ops-button--primary" onClick={onConfirm}>
                Confirm reservation
              </button>
            )}
            {actions.convert && (
              <button type="button" className="ops-button ops-button--primary" onClick={onConvert}>
                Convert to contract
              </button>
            )}
            {actions.edit && (
              <button type="button" className="ops-button ops-button--quiet" onClick={onEdit}>
                Edit
              </button>
            )}
            {actions.cancel && (
              <button type="button" className="ops-button ops-button--quiet" onClick={onCancel}>
                Cancel reservation
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
