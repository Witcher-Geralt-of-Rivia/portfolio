"use client";

/**
 * Operations demo: opening a work order.
 *
 * Create only. The domain offers no update for a work order: what a work order
 * records is a lifecycle, and every change it can undergo after it exists is
 * one of the three transitions the drawer already carries. A form that let
 * someone re-type the vehicle or the priority afterwards would be offering an
 * edit the services would refuse.
 *
 * There is no status field for the same reason there is no vehicle field on a
 * draft reservation: a new work order is Open, the service sets it, and a
 * control that appeared to choose it would be describing a decision the caller
 * does not get to make.
 *
 * The one thing the form does insist on is a summary. It is the line the queue
 * is read by, and an empty one turns a row into an unanswerable question.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { DemoRecord } from "@/demo-runtime/types";

import { vehicleLabelOf } from "../../selectors/reservations-list";
import { createMaintenanceWorkflow } from "../../services/maintenance-workflows";
import type {
  MaintenancePriority,
  MaintenanceType,
  MaintenanceWorkOrder,
  Vehicle,
} from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "../leads/OpsOverlay";
import { useLeadAction } from "../leads/use-lead-action";
import { MAINTENANCE_PRIORITIES, MAINTENANCE_TYPES } from "./maintenance-view";

const SUMMARY_LIMIT = 200;

type Props = {
  vehicles: DemoRecord<Vehicle>[];
  onClose: () => void;
  onCreated: (workOrder: DemoRecord<MaintenanceWorkOrder>) => void;
  onAnnounce: (message: string) => void;
};

export default function MaintenanceForm({
  vehicles,
  onClose,
  onCreated,
  onAnnounce,
}: Props) {
  const { ctx } = useOperations();
  const action = useLeadAction();
  const ids = useId();
  const firstRef = useRef<HTMLButtonElement>(null);

  /* Asset code order, because that is how a fleet list is read off a board
     and how the person opening the order has the machine in mind. */
  const ordered = useMemo(
    () => [...vehicles].sort((a, b) => a.data.assetCode.localeCompare(b.data.assetCode)),
    [vehicles]
  );

  const [vehicleId, setVehicleId] = useState(ordered[0]?.id ?? "");
  const [type, setType] = useState<MaintenanceType>("Inspection");
  const [priority, setPriority] = useState<MaintenancePriority>("Routine");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const errorId = `${ids}-error`;
  /* The service refuses a blank summary too, and its sentence is what gets
     shown if one somehow arrives. This only keeps the button honest. */
  const incomplete = !vehicleId || summary.trim() === "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ctx || action.pending || incomplete) return;

    const done = await action.run(async () => {
      const outcome = await createMaintenanceWorkflow(ctx, {
        vehicleId,
        type,
        priority,
        summary,
      });
      /* The wrapper answers with the mutation's result and whatever the rules
         did with it. The record is what the screen needs. */
      return outcome.result;
    });

    if (done) {
      const assetCode = ordered.find((v) => v.id === vehicleId)?.data.assetCode;
      onAnnounce(assetCode ? `Work order opened on ${assetCode}` : "Work order opened");
      onCreated(done);
    }
  };

  return (
    <OpsOverlay
      variant="sheet"
      label="New work order"
      onClose={onClose}
      busy={action.pending}
      className="ops-form-overlay"
    >
      <form className="ops-form" onSubmit={submit} noValidate>
        <div className="ops-sheet__head">
          <h2 className="ops-sheet__title">New work order</h2>
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
            <span className="ops-field__label">Vehicle</span>
            <OpsSelect
              srLabel="Vehicle"
              value={vehicleId}
              onChange={setVehicleId}
              options={ordered.map((v) => ({ value: v.id, label: vehicleLabelOf(v) }))}
            />
            <span className="ops-field__hint">
              Any vehicle may have work opened against it. The fleet register shows it as
              Maintenance from the moment the order exists.
            </span>
          </div>

          <div className="ops-field ops-field--stacked">
            <span className="ops-field__label">Type</span>
            <OpsSelect
              srLabel="Work type"
              value={type}
              onChange={(v) => setType(v as MaintenanceType)}
              options={MAINTENANCE_TYPES.map((t) => ({ value: t, label: t }))}
            />
          </div>

          <div className="ops-field ops-field--stacked">
            <span className="ops-field__label">Priority</span>
            <OpsSelect
              srLabel="Priority"
              value={priority}
              onChange={(v) => setPriority(v as MaintenancePriority)}
              options={MAINTENANCE_PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
            <span className="ops-field__hint">
              Priority orders the queue. High means before the others, not an emergency.
            </span>
          </div>

          <label className="ops-field ops-field--stacked" htmlFor={`${ids}-summary`}>
            <span className="ops-field__label">Summary</span>
            <textarea
              id={`${ids}-summary`}
              className="ops-textarea"
              value={summary}
              rows={3}
              maxLength={SUMMARY_LIMIT}
              onChange={(e) => setSummary(e.target.value)}
              required
            />
            <span className="ops-field__hint">
              {summary.length} of {SUMMARY_LIMIT} characters
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
            disabled={action.pending || incomplete}
          >
            {action.pending ? "Opening..." : "Open work order"}
          </button>
        </div>
      </form>
    </OpsOverlay>
  );
}
