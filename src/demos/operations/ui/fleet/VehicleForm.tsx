"use client";

/**
 * Operations demo: adding a vehicle and editing one.
 *
 * One form for both, in the Leads form language.
 *
 * Three fields, because a vehicle has exactly three things a person knows
 * about it. The other four stored fields are the cached derivation, and a
 * control that wrote one would put the demo back into the state
 * `deriveVehicleStatus` exists to make impossible.
 *
 * The class and the model are one decision in two controls: a model belongs to
 * exactly one class, so changing the class re-offers the models and drops a
 * selection the new class does not have. The service checks the pair as well,
 * because a form is one caller of a domain rule.
 *
 * These two mutations call the vehicle services directly rather than a
 * workflow wrapper, and none is missing: no automation rule has a vehicle
 * trigger and the `AutomationTrigger` union is frozen, so there is no
 * application boundary here for a wrapper to stand at (D-088).
 */

import { useEffect, useId, useRef, useState } from "react";

import type { DemoRecord } from "@/demo-runtime/types";

import { createVehicle, updateVehicle } from "../../services/vehicles";
import type { ModelLabel, Vehicle, VehicleClass } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "../leads/OpsOverlay";
import { useLeadAction } from "../leads/use-lead-action";
import { VEHICLE_CLASSES, modelsFor } from "./fleet-view";

/**
 * The same three refusals `checkOdometer` makes, said before the round trip.
 *
 * Mirrored rather than shared because the service raises them as errors with a
 * field name and this needs a sentence to sit under an input. The service
 * stays the authority: it runs these checks again for every caller.
 */
function odometerProblem(text: string): string | null {
  if (text.trim() === "") return "Enter the odometer reading in kilometres.";
  const value = Number(text);
  if (!Number.isFinite(value)) return "An odometer reading has to be a number.";
  if (!Number.isInteger(value)) return "An odometer reading is a whole number of kilometres.";
  if (value < 0) return "An odometer reading cannot be negative.";
  return null;
}

type Props = {
  mode: "create" | "edit";
  vehicle: DemoRecord<Vehicle> | null;
  onClose: () => void;
  onCreated: (vehicle: DemoRecord<Vehicle>) => void;
  onSaved: () => void;
  onAnnounce: (message: string) => void;
};

export default function VehicleForm({
  mode,
  vehicle,
  onClose,
  onCreated,
  onSaved,
  onAnnounce,
}: Props) {
  const { ctx } = useOperations();
  const action = useLeadAction();
  const ids = useId();
  const firstRef = useRef<HTMLButtonElement>(null);

  const openingClass: VehicleClass = vehicle?.data.vehicleClass ?? "Urban";
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>(openingClass);
  const [modelLabel, setModelLabel] = useState<ModelLabel>(
    vehicle?.data.modelLabel ?? modelsFor(openingClass)[0]
  );
  const [odometer, setOdometer] = useState(vehicle ? String(vehicle.data.odometerKm) : "0");

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const title = mode === "create" ? "New vehicle" : "Edit vehicle";
  const errorId = `${ids}-error`;
  const odometerError = odometerProblem(odometer);
  const models = modelsFor(vehicleClass);

  /**
   * Changing the class re-homes the model in the same event.
   *
   * Done here rather than in an effect: an effect would let one frame render
   * with a model the new class does not contain, and the repository forbids
   * setting state from an effect for exactly that reason. Falling back to the
   * first model of the new class means the form can never submit a pair the
   * service would refuse.
   */
  const changeClass = (next: VehicleClass) => {
    setVehicleClass(next);
    const allowed = modelsFor(next);
    if (!allowed.includes(modelLabel)) setModelLabel(allowed[0]);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ctx || action.pending || odometerError) return;
    const odometerKm = Number(odometer);

    if (mode === "create") {
      const created = await action.run(() =>
        createVehicle(ctx, { modelLabel, vehicleClass, odometerKm })
      );
      if (created) {
        /* The allocated code, read back from the record rather than guessed:
           it is the one thing about the new vehicle nobody chose. */
        onAnnounce(`Vehicle ${created.data.assetCode} added`);
        onCreated(created);
      }
      return;
    }

    if (!vehicle) return;
    const saved = await action.run(() =>
      updateVehicle(ctx, vehicle.id, { modelLabel, vehicleClass, odometerKm })
    );
    if (saved) {
      onAnnounce(`Vehicle ${saved.data.assetCode} updated`);
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
            <span className="ops-field__label">Vehicle class</span>
            <OpsSelect
              srLabel="Vehicle class"
              value={vehicleClass}
              onChange={(v) => changeClass(v as VehicleClass)}
              options={VEHICLE_CLASSES.map((c) => ({ value: c, label: c }))}
            />
          </div>

          <div className="ops-field ops-field--stacked">
            <span className="ops-field__label">Model</span>
            <OpsSelect
              srLabel="Model"
              value={modelLabel}
              onChange={(v) => setModelLabel(v as ModelLabel)}
              options={models.map((m) => ({ value: m, label: m }))}
            />
            <span className="ops-field__hint">
              Each model belongs to one class, so this list follows the class above.
            </span>
          </div>

          <label className="ops-field ops-field--stacked" htmlFor={`${ids}-odometer`}>
            <span className="ops-field__label">Odometer</span>
            <input
              id={`${ids}-odometer`}
              type="number"
              className="ops-input"
              min={0}
              step={1}
              inputMode="numeric"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
              aria-invalid={odometerError ? true : undefined}
              aria-describedby={odometerError ? `${ids}-odometer-error` : undefined}
            />
            {odometerError ? (
              <span className="ops-field__error" id={`${ids}-odometer-error`}>
                {odometerError}
              </span>
            ) : (
              <span className="ops-field__hint">Whole kilometres on the clock.</span>
            )}
          </label>

          <div className="ops-field ops-field--stacked">
            <span className="ops-field__label">Asset code</span>
            {mode === "edit" && vehicle ? (
              <>
                <p className="ops-field__static">
                  <span className="ops-vehicles__code">{vehicle.data.assetCode}</span>
                </p>
                <span className="ops-field__hint">
                  Fixed for the life of the vehicle. A code that moved would make every
                  worksheet that quotes it wrong.
                </span>
              </>
            ) : (
              /* No predicted code. Working one out here would be a second
                 implementation of the allocation rule, and the two would
                 disagree the moment anyone added a vehicle in another tab. */
              <span className="ops-field__hint">
                The asset code is issued by the system when the vehicle is added, continuing
                the numbering the fleet already uses.
              </span>
            )}
          </div>
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
            disabled={action.pending || odometerError !== null}
          >
            {action.pending
              ? mode === "create"
                ? "Adding..."
                : "Saving..."
              : mode === "create"
                ? "Add vehicle"
                : "Save changes"}
          </button>
        </div>
      </form>
    </OpsOverlay>
  );
}
