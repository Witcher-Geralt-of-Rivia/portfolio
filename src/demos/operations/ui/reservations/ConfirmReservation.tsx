"use client";

/**
 * Operations demo: confirming a reservation.
 *
 * The module's centre of gravity. Confirmation is where a booking stops being
 * an intention and takes a vehicle off the fleet, so it is deliberately not a
 * status toggle: the visitor reads who it is for, when it runs and which class
 * was asked for, then picks one vehicle from the set the domain says is free.
 *
 * The eligible set comes from `getEligibleVehicles`. This screen does not
 * filter the fleet itself, and could not do it correctly: eligibility spans
 * contracts, reservations and work orders over an interval, and duplicating
 * that here would be a second implementation to keep in step.
 *
 * The choice is a radio group rather than a select. There are rarely more than
 * a handful of options, each needs two lines to identify itself, and a
 * radiogroup shows all of them at once without hiding the count behind a
 * closed control (D-092).
 *
 * The action goes through `confirmReservationWorkflow`, never the bare
 * service, so Rule 03 runs from the one thing the visitor clicks.
 */

import { useEffect, useRef, useState } from "react";

import type { DemoRecord } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { absoluteDate } from "../../selectors/leads-list";
import { vehicleLabelOf } from "../../selectors/reservations-list";
import { getEligibleVehicles } from "../../services/reservations";
import { confirmReservationWorkflow } from "../../services/reservation-workflows";
import type { Reservation, Vehicle } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import { useLeadAction } from "../leads/use-lead-action";

type Props = {
  reservation: DemoRecord<Reservation>;
  customerName: string;
  onCancel: () => void;
  onConfirmed: (message: string) => void;
};

export default function ConfirmReservation({
  reservation,
  customerName,
  onCancel,
  onConfirmed,
}: Props) {
  const { ctx, role } = useOperations();
  const action = useLeadAction();
  const [chosen, setChosen] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const { data: eligible, loading } = useDemoQuery(async () => {
    if (!ctx) return null;
    return getEligibleVehicles(ctx, {
      vehicleClass: reservation.data.vehicleClass,
      startAt: reservation.data.startAt,
      endAt: reservation.data.endAt,
      ignoreReservationId: reservation.id,
    });
  }, [role, reservation.id]);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const options: DemoRecord<Vehicle>[] = eligible ?? [];
  const none = eligible !== null && options.length === 0;

  const confirm = async () => {
    if (!ctx || !chosen) return;
    /* The workflow, not the service: this is what makes Rule 03 run from one
       visitor action rather than needing a second control (D-088). */
    const done = await action.run(() =>
      confirmReservationWorkflow(ctx, reservation.id, chosen)
    );
    if (done) {
      const vehicle = options.find((v) => v.id === chosen);
      onConfirmed(
        vehicle
          ? `Reservation confirmed with ${vehicle.data.assetCode}`
          : "Reservation confirmed"
      );
    }
  };

  return (
    <OpsOverlay
      variant="sheet"
      label="Confirm reservation"
      onClose={onCancel}
      busy={action.pending}
      className="ops-form-overlay"
    >
      <div className="ops-form">
        <div className="ops-sheet__head">
          <h2 className="ops-sheet__title" tabIndex={-1} ref={headingRef}>
            Confirm reservation
          </h2>
          <button
            type="button"
            className="ops-icon-button"
            onClick={onCancel}
            aria-label="Close"
            disabled={action.pending}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="ops-sheet__body">
          <dl className="ops-facts ops-confirm-res__facts">
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Customer</dt>
              <dd className="ops-facts__value">{customerName}</dd>
            </div>
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Rental period</dt>
              <dd className="ops-facts__value">
                {absoluteDate(reservation.data.startAt)} to{" "}
                {absoluteDate(reservation.data.endAt)}
              </dd>
            </div>
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Requested class</dt>
              <dd className="ops-facts__value">{reservation.data.vehicleClass}</dd>
            </div>
          </dl>

          {action.error && (
            <p className="ops-alert" role="alert">
              {action.error}
            </p>
          )}

          {loading && (
            <p className="ops-empty" role="status">
              Checking which vehicles are free for those dates.
            </p>
          )}

          {none && (
            /* No override, no substitute class, no silent date change. The
               honest answer is that the fleet cannot take this booking. */
            <div className="ops-confirm-res__none">
              <p className="ops-confirm-res__none-title">
                No {reservation.data.vehicleClass} vehicle is free for those dates.
              </p>
              <p className="ops-confirm-res__none-text">
                Every vehicle of that class is already on a rental, held by another
                confirmed reservation, or in the workshop for this period. Change the
                dates or the class on the reservation, or confirm it once a vehicle
                comes free.
              </p>
            </div>
          )}

          {options.length > 0 && (
            <fieldset className="ops-vehicle-choice">
              <legend className="ops-field__label">
                Available vehicles
                <span className="ops-vehicle-choice__count">
                  {options.length} free for these dates
                </span>
              </legend>
              {options.map((vehicle) => (
                <label className="ops-vehicle-option" key={vehicle.id}>
                  <input
                    type="radio"
                    name="eligible-vehicle"
                    className="ops-vehicle-option__input"
                    value={vehicle.id}
                    checked={chosen === vehicle.id}
                    onChange={() => setChosen(vehicle.id)}
                    disabled={action.pending}
                  />
                  <span className="ops-vehicle-option__body">
                    <span className="ops-vehicle-option__name">{vehicleLabelOf(vehicle)}</span>
                    <span className="ops-vehicle-option__meta">
                      {vehicle.data.vehicleClass} · {vehicle.data.odometerKm.toLocaleString("en-GB")} km
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </div>

        <div className="ops-sheet__foot ops-form__foot">
          <button
            type="button"
            className="ops-button ops-button--quiet"
            onClick={onCancel}
            disabled={action.pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ops-button ops-button--primary"
            onClick={confirm}
            disabled={action.pending || !chosen}
          >
            {action.pending ? "Confirming..." : "Confirm reservation"}
          </button>
        </div>
      </div>
    </OpsOverlay>
  );
}
