"use client";

/**
 * Operations demo: creating and editing a lead.
 *
 * One form for both, because they take the same four fields and a second
 * component would be the same markup with a different verb.
 *
 * Stage is not among them. A new lead begins at New and moves by the stage
 * control in the detail, and Won is only ever reached by converting: putting
 * a stage picker in a create form would let someone invent a Won lead with no
 * customer behind it before the record even exists.
 *
 * Vehicle interest is a closed list rather than free text. The domain types it
 * as `VehicleClass`, and a text box here would be the one place in the product
 * where a visitor could type a manufacturer's name into synthetic data.
 */

import { useEffect, useId, useRef, useState } from "react";

import type { DemoRecord } from "@/demo-runtime/types";

import { createLeadWorkflow } from "../../services/lead-workflows";
import { updateLead } from "../../services/leads";
import {
  LEAD_SOURCES,
  PRIORITIES,
  VEHICLE_CLASSES,
  type Lead,
  type LeadSource,
  type Priority,
  type VehicleClass,
} from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "./OpsOverlay";
import { useLeadAction } from "./use-lead-action";

type Props = {
  mode: "create" | "edit";
  lead: DemoRecord<Lead> | null;
  onClose: () => void;
  onCreated: (lead: DemoRecord<Lead>) => void;
  onSaved: () => void;
  onAnnounce: (message: string) => void;
};

export default function LeadForm({
  mode,
  lead,
  onClose,
  onCreated,
  onSaved,
  onAnnounce,
}: Props) {
  const { ctx } = useOperations();
  const action = useLeadAction();
  const ids = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(lead?.data.displayName ?? "");
  const [source, setSource] = useState<LeadSource>(lead?.data.source ?? "Website");
  const [vehicleInterest, setInterest] = useState<VehicleClass>(
    lead?.data.vehicleInterest ?? "Urban"
  );
  const [priority, setPriority] = useState<Priority>(lead?.data.priority ?? "Normal");

  /* The name is where the visitor starts in both modes. `<dialog>` focuses the
     first focusable element on open, which would be the close button. */
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const nameEmpty = displayName.trim().length === 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ctx || action.pending) return;

    if (mode === "create") {
      const done = await action.run(async () => {
        const outcome = await createLeadWorkflow(ctx, {
          displayName,
          source,
          vehicleInterest,
          priority,
        });
        return outcome;
      });
      if (done) {
        /* Rule 01 assigns a website lead as part of this workflow, so the
           announcement says what actually happened rather than assuming. */
        const assigned = done.outcomes.some((o) => o.status === "Success");
        onAnnounce(
          assigned
            ? `Lead ${done.result.data.displayName} created and assigned automatically`
            : `Lead ${done.result.data.displayName} created`
        );
        onCreated(done.result);
      }
      return;
    }

    if (!lead) return;
    const done = await action.run(() =>
      updateLead(ctx, lead.id, { displayName, source, vehicleInterest, priority })
    );
    if (done) {
      onAnnounce(`Lead ${done.data.displayName} updated`);
      onSaved();
    }
  };

  const title = mode === "create" ? "New lead" : "Edit lead";
  const errorId = `${ids}-error`;

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

          <label className="ops-field ops-field--stacked" htmlFor={`${ids}-name`}>
            <span className="ops-field__label">Lead name</span>
            <input
              id={`${ids}-name`}
              ref={nameRef}
              className="ops-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              aria-required="true"
              aria-invalid={action.errorField === "displayName" ? true : undefined}
              aria-describedby={action.errorField === "displayName" ? errorId : undefined}
              autoComplete="off"
            />
          </label>

          <div className="ops-field ops-field--stacked">
            <span className="ops-field__label">Source</span>
            <OpsSelect
              srLabel="Source"
              value={source}
              onChange={(v) => setSource(v as LeadSource)}
              options={LEAD_SOURCES.map((option) => ({ value: option, label: option }))}
            />
            {mode === "create" && source === "Website" && (
              <span className="ops-field__hint">
                Website leads are assigned to a sales agent automatically.
              </span>
            )}
          </div>

          <div className="ops-field ops-field--stacked">
            <span className="ops-field__label">Vehicle interest</span>
            <OpsSelect
              srLabel="Vehicle interest"
              value={vehicleInterest}
              onChange={(v) => setInterest(v as VehicleClass)}
              options={VEHICLE_CLASSES.map((option) => ({ value: option, label: option }))}
            />
          </div>

          <div className="ops-field ops-field--stacked">
            <span className="ops-field__label">Priority</span>
            <OpsSelect
              srLabel="Priority"
              value={priority}
              onChange={(v) => setPriority(v as Priority)}
              options={PRIORITIES.map((option) => ({ value: option, label: option }))}
            />
          </div>

          {mode === "create" && (
            <p className="ops-field__hint ops-form__note">
              New leads start at the New stage.
            </p>
          )}
        </div>

        <div className="ops-sheet__foot ops-form__foot">
          <button
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
            /* Disabled on an empty name so the button is never a lie, and
               while a commit is in flight so a second press cannot start a
               second one. The service validates again regardless. */
            disabled={action.pending || nameEmpty}
          >
            {action.pending
              ? mode === "create"
                ? "Creating…"
                : "Saving…"
              : mode === "create"
                ? "Create lead"
                : "Save changes"}
          </button>
        </div>
      </form>
    </OpsOverlay>
  );
}
