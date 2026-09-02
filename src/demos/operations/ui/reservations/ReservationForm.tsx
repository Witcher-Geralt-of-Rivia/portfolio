"use client";

/**
 * Operations demo: creating and editing a reservation.
 *
 * One form for both, in the Leads form's language.
 *
 * There is no vehicle field here, and that is the decision this module turns
 * on. A draft does not hold fleet capacity, so a vehicle chosen now could be
 * reserved, rented or in the workshop by the time anyone confirms, and the
 * field would have shown an allocation that was never made. The choice belongs
 * to confirmation, where eligibility is evaluated against the dates (D-091).
 *
 * Editing narrows further: the domain lets a draft change its class, its dates
 * and its notes, and not its customer. The form offers exactly that rather
 * than rendering a control the service would refuse.
 */

import { useEffect, useId, useRef, useState } from "react";

import type { DemoRecord } from "@/demo-runtime/types";

import { createReservation, updateDraftReservation } from "../../services/reservations";
import type { Customer, Reservation, VehicleClass } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "../leads/OpsOverlay";
import { useLeadAction } from "../leads/use-lead-action";
import { VEHICLE_CLASSES } from "./reservations-view";

const NOTES_LIMIT = 400;

/** `2026-09-04T09:00:00.000Z` to `2026-09-04T09:00`, which is what the input wants. */
const toLocalInput = (iso: string) => iso.slice(0, 16);
/** And back. The demo's clock is UTC, so the value is read as UTC (D-053). */
const toIso = (value: string) => `${value}:00.000Z`;

type Props = {
  mode: "create" | "edit";
  reservation: DemoRecord<Reservation> | null;
  customers: DemoRecord<Customer>[];
  onClose: () => void;
  onCreated: (reservation: DemoRecord<Reservation>) => void;
  onSaved: () => void;
  onAnnounce: (message: string) => void;
};

export default function ReservationForm({
  mode,
  reservation,
  customers,
  onClose,
  onCreated,
  onSaved,
  onAnnounce,
}: Props) {
  const { ctx } = useOperations();
  const action = useLeadAction();
  const ids = useId();
  const firstRef = useRef<HTMLButtonElement>(null);

  const [customerId, setCustomerId] = useState(
    reservation?.data.customerId ?? customers[0]?.id ?? ""
  );
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>(
    reservation?.data.vehicleClass ?? "Urban"
  );
  const [startAt, setStartAt] = useState(
    toLocalInput(reservation?.data.startAt ?? ctx?.runtime.now() ?? "")
  );
  const [endAt, setEndAt] = useState(toLocalInput(reservation?.data.endAt ?? ""));
  const [notes, setNotes] = useState(reservation?.data.notes ?? "");

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const title = mode === "create" ? "New reservation" : "Edit reservation";
  const errorId = `${ids}-error`;
  const incomplete = !customerId || !startAt || !endAt;
  /* A local check so the obvious mistake is caught before a round trip. The
     service still validates it and its message is what gets shown. */
  const badRange = Boolean(startAt && endAt && Date.parse(toIso(endAt)) <= Date.parse(toIso(startAt)));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ctx || action.pending || incomplete || badRange) return;

    if (mode === "create") {
      const done = await action.run(() =>
        createReservation(ctx, {
          customerId,
          vehicleClass,
          startAt: toIso(startAt),
          endAt: toIso(endAt),
          notes,
        })
      );
      if (done) {
        onAnnounce("Reservation created");
        onCreated(done);
      }
      return;
    }

    if (!reservation) return;
    const done = await action.run(() =>
      updateDraftReservation(ctx, reservation.id, {
        vehicleClass,
        startAt: toIso(startAt),
        endAt: toIso(endAt),
        notes,
      })
    );
    if (done) {
      onAnnounce("Reservation updated");
      onSaved();
    }
  };

  return (
    <OpsOverlay
      variant="sheet"
      label={title}
      onClose={onClose}
      busy={action.pending}
      className="ops-form-overlay"
    >
      <form className="ops-form" onSubmit={submit} noValidate>
        <div className="ops-sheet__head">
          <h2 className="ops-sheet__title">{title}</h2>
          <button
            type="button"
            className="ops-icon-button"
            onClick={onClose}
            aria-label="Close"
            disabled={action.pending}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="ops-sheet__body">
          {action.error && (
            <p className="ops-alert" id={errorId} role="alert">
              {action.error}
            </p>
          )}

          <div className="ops-field ops-field--stacked">
            <span className="ops-field__label">Customer</span>
            {mode === "create" ? (
              <OpsSelect
                srLabel="Customer"
                value={customerId}
                onChange={setCustomerId}
                options={customers.map((c) => ({ value: c.id, label: c.data.displayName }))}
              />
            ) : (
              /* The domain does not move a reservation between customers, so
                 the name is shown rather than offered as a control. */
              <p className="ops-field__static">
                {customers.find((c) => c.id === customerId)?.data.displayName ??
                  "Unknown customer"}
              </p>
            )}
          </div>

          <div className="ops-field ops-field--stacked">
            <span className="ops-field__label">Vehicle class</span>
            <OpsSelect
              srLabel="Vehicle class"
              value={vehicleClass}
              onChange={(v) => setVehicleClass(v as VehicleClass)}
              options={VEHICLE_CLASSES.map((c) => ({ value: c, label: c }))}
            />
            <span className="ops-field__hint">
              The vehicle itself is chosen when the reservation is confirmed.
            </span>
          </div>

          <div className="ops-field__pair">
            <label className="ops-field ops-field--stacked" htmlFor={`${ids}-start`}>
              <span className="ops-field__label">Start</span>
              <input
                id={`${ids}-start`}
                type="datetime-local"
                className="ops-input"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
              />
            </label>

            <label className="ops-field ops-field--stacked" htmlFor={`${ids}-end`}>
              <span className="ops-field__label">End</span>
              <input
                id={`${ids}-end`}
                type="datetime-local"
                className="ops-input"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
                aria-invalid={badRange ? true : undefined}
                aria-describedby={badRange ? `${ids}-range` : undefined}
              />
              {badRange && (
                <span className="ops-field__error" id={`${ids}-range`}>
                  A reservation must end after it starts.
                </span>
              )}
            </label>
          </div>

          <label className="ops-field ops-field--stacked" htmlFor={`${ids}-notes`}>
            <span className="ops-field__label">Notes</span>
            <textarea
              id={`${ids}-notes`}
              className="ops-textarea"
              value={notes}
              rows={3}
              maxLength={NOTES_LIMIT}
              onChange={(e) => setNotes(e.target.value)}
            />
            <span className="ops-field__hint">
              {notes.length} of {NOTES_LIMIT} characters
            </span>
          </label>
        </div>

        <div className="ops-sheet__foot ops-form__foot">
          <button
            ref={firstRef}
            type="button"
            className="ops-button ops-button--quiet"
            onClick={onClose}
            disabled={action.pending}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="ops-button ops-button--primary"
            disabled={action.pending || incomplete || badRange}
          >
            {action.pending
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create reservation"
                : "Save changes"}
          </button>
        </div>
      </form>
    </OpsOverlay>
  );
}
