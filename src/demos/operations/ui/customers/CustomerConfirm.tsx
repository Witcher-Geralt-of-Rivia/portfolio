"use client";

/**
 * Operations demo: confirming an archive.
 *
 * The copy says what the product will do and what would stop it. The rule
 * itself belongs to `archiveCustomer`, which refuses while an Active contract
 * or a Confirmed reservation exists; this only explains it beforehand and
 * reports the service's own words if the attempt is refused.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { archiveCustomer } from "../../services/customers";
import type { Customer } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import { useLeadAction } from "../leads/use-lead-action";

export default function CustomerConfirm({
  customer,
  onCancel,
  onDone,
  onAnnounce,
}: {
  customer: DemoRecord<Customer>;
  onCancel: () => void;
  onDone: () => void;
  onAnnounce: (message: string) => void;
}) {
  const { ctx } = useOperations();
  const action = useLeadAction();

  const confirm = async () => {
    if (!ctx) return;
    const done = await action.run(() => archiveCustomer(ctx, customer.id));
    if (done) {
      onAnnounce(`${customer.data.displayName} archived`);
      onDone();
    }
    /* A refusal leaves the dialog open with the reason on it: closing would
       hide the one thing the visitor needs to read. */
  };

  return (
    <OpsOverlay
      variant="dialog"
      label="Archive this customer?"
      onClose={onCancel}
      busy={action.pending}
      className="ops-confirm"
    >
      <h2 className="ops-confirm__title">Archive this customer?</h2>
      <p className="ops-confirm__subject">
        {customer.data.displayName} <span className="ops-confirm__id">{customer.id}</span>
      </p>
      <p className="ops-confirm__body">
        The customer will be removed from the active working list. A customer with an active
        contract or a confirmed reservation cannot be archived. Reset demo data restores the
        canonical dataset.
      </p>

      {action.error && (
        <p className="ops-alert" role="alert">
          {action.error}
        </p>
      )}

      <div className="ops-confirm__actions">
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
          disabled={action.pending}
        >
          {action.pending ? "Archiving..." : "Archive customer"}
        </button>
      </div>
    </OpsOverlay>
  );
}
