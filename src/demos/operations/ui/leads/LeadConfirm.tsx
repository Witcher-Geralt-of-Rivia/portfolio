"use client";

/**
 * Operations demo — confirming the two changes that cannot be undone here.
 *
 * Converting creates a customer and closes the lead at Won; archiving takes it
 * out of the working list. Neither has an undo in this product, so both are
 * asked before they are done.
 *
 * The copy says what will actually happen, in the product's own terms. It does
 * not say "deleted" — nothing is deleted, and the demo's reset restores the
 * canonical dataset — and it names the record, with its id, because the
 * synthetic name pool repeats and "Archive Alina Danforth?" would otherwise be
 * ambiguous across three different leads.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { archiveLead, convertLeadToCustomer } from "../../services/leads";
import type { Lead } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "./OpsOverlay";
import { useLeadAction } from "./use-lead-action";

export type ConfirmKind = "convert" | "archive";

const COPY: Record<
  ConfirmKind,
  { title: string; body: string; confirm: string; pending: string }
> = {
  convert: {
    title: "Convert this lead to a customer?",
    body: "A customer record will be created and the lead will move to Won.",
    confirm: "Convert lead",
    pending: "Converting…",
  },
  archive: {
    title: "Archive this lead?",
    body:
      "The lead will be removed from the active working list. Reset demo data restores the canonical dataset.",
    confirm: "Archive lead",
    pending: "Archiving…",
  },
};

export default function LeadConfirm({
  kind,
  lead,
  onCancel,
  onDone,
  onAnnounce,
}: {
  kind: ConfirmKind;
  lead: DemoRecord<Lead>;
  onCancel: () => void;
  onDone: (kind: ConfirmKind) => void;
  onAnnounce: (message: string) => void;
}) {
  const { ctx } = useOperations();
  const action = useLeadAction();
  const copy = COPY[kind];

  const confirm = async () => {
    if (!ctx) return;
    if (kind === "convert") {
      const done = await action.run(() => convertLeadToCustomer(ctx, lead.id));
      if (done) {
        onAnnounce(`${lead.data.displayName} converted to a customer`);
        onDone("convert");
      }
      return;
    }
    const done = await action.run(() => archiveLead(ctx, lead.id));
    if (done) {
      onAnnounce(`${lead.data.displayName} archived`);
      onDone("archive");
    }
  };

  return (
    <OpsOverlay
      variant="dialog"
      label={copy.title}
      onClose={onCancel}
      busy={action.pending}
      className="ops-confirm"
    >
      <h2 className="ops-confirm__title">{copy.title}</h2>
      <p className="ops-confirm__subject">
        {lead.data.displayName} <span className="ops-confirm__id">{lead.id}</span>
      </p>
      <p className="ops-confirm__body">{copy.body}</p>

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
          {action.pending ? copy.pending : copy.confirm}
        </button>
      </div>
    </OpsOverlay>
  );
}
