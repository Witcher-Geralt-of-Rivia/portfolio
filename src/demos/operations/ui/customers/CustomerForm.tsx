"use client";

/**
 * Operations demo: creating and editing a customer.
 *
 * One form for both, in the Leads form's language. Four fields, and no source
 * lead among them: a customer acquires that pointer by being converted from a
 * lead, and offering it here would let someone claim a provenance that never
 * happened.
 */

import { useEffect, useId, useRef, useState } from "react";

import type { DemoRecord } from "@/demo-runtime/types";

import { createCustomer, updateCustomer } from "../../services/customers";
import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_STATUSES,
  type Customer,
  type CustomerSegment,
  type CustomerStatus,
} from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "../leads/OpsOverlay";
import { useLeadAction } from "../leads/use-lead-action";

/** Long enough for a real internal note, short enough to stay readable. */
const NOTES_LIMIT = 400;

type Props = {
  mode: "create" | "edit";
  customer: DemoRecord<Customer> | null;
  onClose: () => void;
  onCreated: (customer: DemoRecord<Customer>) => void;
  onSaved: () => void;
  onAnnounce: (message: string) => void;
};

export default function CustomerForm({
  mode,
  customer,
  onClose,
  onCreated,
  onSaved,
  onAnnounce,
}: Props) {
  const { ctx } = useOperations();
  const action = useLeadAction();
  const ids = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(customer?.data.displayName ?? "");
  const [segment, setSegment] = useState<CustomerSegment>(customer?.data.segment ?? "Standard");
  const [status, setStatus] = useState<CustomerStatus>(customer?.data.status ?? "Active");
  const [notes, setNotes] = useState(customer?.data.notes ?? "");

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const nameEmpty = displayName.trim().length === 0;
  const errorId = `${ids}-error`;
  const title = mode === "create" ? "New customer" : "Edit customer";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ctx || action.pending) return;

    if (mode === "create") {
      const done = await action.run(() =>
        createCustomer(ctx, { displayName, segment, status, notes })
      );
      if (done) {
        onAnnounce(`Customer ${done.data.displayName} created`);
        onCreated(done);
      }
      return;
    }

    if (!customer) return;
    const done = await action.run(() =>
      updateCustomer(ctx, customer.id, { displayName, segment, status, notes })
    );
    if (done) {
      onAnnounce(`Customer ${done.data.displayName} updated`);
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

          <label className="ops-field ops-field--stacked" htmlFor={`${ids}-name`}>
            <span className="ops-field__label">Customer name</span>
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
            <span className="ops-field__label">Segment</span>
            <OpsSelect
              srLabel="Segment"
              value={segment}
              onChange={(v) => setSegment(v as CustomerSegment)}
              options={CUSTOMER_SEGMENTS.map((s) => ({ value: s, label: s }))}
            />
          </div>

          <div className="ops-field ops-field--stacked">
            <span className="ops-field__label">Status</span>
            <OpsSelect
              srLabel="Status"
              value={status}
              onChange={(v) => setStatus(v as CustomerStatus)}
              options={CUSTOMER_STATUSES.map((s) => ({ value: s, label: s }))}
            />
          </div>

          <label className="ops-field ops-field--stacked" htmlFor={`${ids}-notes`}>
            <span className="ops-field__label">Notes</span>
            <textarea
              id={`${ids}-notes`}
              className="ops-textarea"
              value={notes}
              rows={4}
              maxLength={NOTES_LIMIT}
              onChange={(e) => setNotes(e.target.value)}
            />
            {/* A stated limit rather than a silent truncation. The domain
                imposes none, so this is the interface being honest about the
                one it applies. */}
            <span className="ops-field__hint">
              {notes.length} of {NOTES_LIMIT} characters
            </span>
          </label>
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
            disabled={action.pending || nameEmpty}
          >
            {action.pending
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create customer"
                : "Save changes"}
          </button>
        </div>
      </form>
    </OpsOverlay>
  );
}
