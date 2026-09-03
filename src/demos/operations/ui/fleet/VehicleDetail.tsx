"use client";

/**
 * Operations demo: one vehicle, in full.
 *
 * The Leads and Reservations drawer geometry and focus behaviour. Three
 * sections: what the machine is, what it is currently doing, and what has been
 * recorded against it.
 *
 * The middle section is the one this module exists for. A vehicle in this
 * domain does not hold a status because somebody set one; it holds a status
 * because a contract, a reservation or a work order names it. So the drawer
 * shows those relationships as the reason, and each one becomes a link only
 * for a role that may open the module at the other end (D-092). A role that
 * may not gets the reference itself, which is enough to ask a colleague about.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";

import type { DemoRecord } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { C } from "../../constants";
import { formatOdometer } from "../../selectors/fleet-list";
import { absoluteDate, relativeDate } from "../../selectors/leads-list";
import { selectActivity } from "../../selectors/queries";
import type { Vehicle } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import {
  STATUS_TONE,
  canOpenContracts,
  canOpenMaintenance,
  canOpenReservations,
  contractHref,
  maintenanceHref,
  reservationHref,
} from "./fleet-view";

type Props = {
  vehicle: DemoRecord<Vehicle> | null;
  missingId: string | null;
  mayWrite: boolean;
  onClose: () => void;
  onDismissMissing: () => void;
  onEdit: () => void;
};

export default function VehicleDetail({
  vehicle,
  missingId,
  mayWrite,
  onClose,
  onDismissMissing,
  onEdit,
}: Props) {
  const { ctx, role } = useOperations();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const vehicleId = vehicle?.id ?? null;

  /**
   * Keyed on the role as well as the record, so a role change drops the
   * previous answer rather than showing it for a frame (D-058).
   */
  const { data } = useDemoQuery(async () => {
    if (!ctx || !vehicleId) return null;
    const audit = await ctx.runtime.listAudit();
    return { activity: selectActivity(audit, C.vehicles, vehicleId) };
  }, [role, vehicleId]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [vehicleId]);

  if (missingId) {
    return (
      <OpsOverlay variant="drawer" label="Vehicle unavailable" onClose={onDismissMissing}>
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Vehicle unavailable
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
            No vehicle in this demo has the id <code>{missingId}</code>. The demo data may
            have been reset since the link was made.
          </p>
          <button type="button" className="ops-button" onClick={onDismissMissing}>
            Back to the fleet
          </button>
        </div>
      </OpsOverlay>
    );
  }

  if (!vehicle) {
    return (
      <OpsOverlay variant="drawer" label="Vehicle" onClose={onClose} className="ops-detail">
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Vehicle
          </h2>
          <button type="button" className="ops-icon-button" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="ops-detail__body" aria-busy="true">
          <div className="ops-skeleton ops-skeleton--line" />
          <div className="ops-skeleton ops-skeleton--line" />
          <p className="visually-hidden" role="status">
            Loading vehicle
          </p>
        </div>
      </OpsOverlay>
    );
  }

  const now = ctx?.runtime.now() ?? null;
  const v = vehicle.data;
  const reservationId = v.currentReservationId ?? null;
  const contractId = v.currentContractId ?? null;
  const maintenanceId = v.activeMaintenanceId ?? null;
  const idle = !reservationId && !contractId && !maintenanceId;

  return (
    <OpsOverlay
      variant="drawer"
      label={`Vehicle ${v.assetCode}`}
      onClose={onClose}
      className="ops-detail"
    >
      <div className="ops-detail__head">
        <div className="ops-detail__identity">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            {v.assetCode}
          </h2>
          <p className="ops-detail__id">{vehicle.id}</p>
          <p className="ops-detail__marks">
            <span className={`ops-pill ops-pill--${STATUS_TONE[v.status]}`}>{v.status}</span>
            <span className="ops-detail__interest">{v.modelLabel}</span>
            <span className="ops-detail__interest">{v.vehicleClass}</span>
          </p>
        </div>
        <button
          type="button"
          className="ops-icon-button"
          onClick={onClose}
          aria-label="Close vehicle"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="ops-detail__body">
        <section className="ops-detail__section" aria-labelledby="ops-vehicle-facts">
          <h3 className="ops-detail__section-title" id="ops-vehicle-facts">
            Vehicle
          </h3>
          <dl className="ops-facts">
            <Fact label="Model" value={v.modelLabel} />
            <Fact label="Class" value={v.vehicleClass} />
            <Fact label="Odometer" value={formatOdometer(v.odometerKm)} />
            <Fact label="Service area" value={v.serviceArea} />
            <Fact
              label="Updated"
              value={now ? relativeDate(vehicle.updatedAt, now) : "-"}
              title={absoluteDate(vehicle.updatedAt)}
            />
          </dl>
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-vehicle-state">
          <h3 className="ops-detail__section-title" id="ops-vehicle-state">
            Current state
          </h3>
          {idle ? (
            <p className="ops-empty">
              This vehicle is available. Nothing points at it: no reservation, no contract
              and no open work order.
            </p>
          ) : (
            <dl className="ops-facts">
              {reservationId && (
                <div className="ops-facts__row">
                  <dt className="ops-facts__label">Reservation</dt>
                  <dd className="ops-facts__value">
                    {canOpenReservations(role) ? (
                      <Link className="ops-link-button" href={reservationHref(reservationId)}>
                        Open reservation
                      </Link>
                    ) : (
                      /* The reference, always. Only the way through is withheld. */
                      <code className="ops-detail__ref">{reservationId}</code>
                    )}
                  </dd>
                </div>
              )}
              {contractId && (
                <div className="ops-facts__row">
                  <dt className="ops-facts__label">Contract</dt>
                  <dd className="ops-facts__value">
                    {canOpenContracts(role) ? (
                      <Link className="ops-link-button" href={contractHref(contractId)}>
                        Open contract
                      </Link>
                    ) : (
                      <code className="ops-detail__ref">{contractId}</code>
                    )}
                  </dd>
                </div>
              )}
              {maintenanceId && (
                <div className="ops-facts__row">
                  <dt className="ops-facts__label">Work order</dt>
                  <dd className="ops-facts__value">
                    {canOpenMaintenance(role) ? (
                      <Link className="ops-link-button" href={maintenanceHref(maintenanceId)}>
                        Open work order
                      </Link>
                    ) : (
                      <code className="ops-detail__ref">{maintenanceId}</code>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          )}
          <p className="ops-empty">
            The status above is derived from the reservation, contract and work order links a
            vehicle carries, and is never typed into a form.
          </p>
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-vehicle-activity">
          <h3 className="ops-detail__section-title" id="ops-vehicle-activity">
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
              {data ? "Nothing has been recorded against this vehicle yet." : " "}
            </p>
          )}
        </section>
      </div>

      {mayWrite && (
        <div className="ops-detail__actions">
          <div className="ops-detail__buttons">
            {/* One action, and no delete. A vehicle leaves a fleet by being
                sold or written off, which is a record to keep rather than a
                row to remove, and its status is not this drawer to set. */}
            <button type="button" className="ops-button ops-button--quiet" onClick={onEdit}>
              Edit vehicle
            </button>
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
