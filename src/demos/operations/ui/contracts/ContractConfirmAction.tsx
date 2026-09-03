"use client";

/**
 * Operations demo: confirming a contract lifecycle move.
 *
 * Three transitions that deserve a deliberate second step, sharing one dialog
 * because they share a shape: state what will happen, name the record, and let
 * the service refuse in its own words if it is going to.
 *
 * The bodies describe what the services actually do, including the parts that
 * are easy to get wrong. Activation can be refused, and saying so before the
 * click is kinder than an alert after it. Completion recomputes the vehicle
 * rather than freeing it, because a confirmed reservation or an open work order
 * may already be waiting, and a dialog that promised "the vehicle becomes
 * available" would be describing a simpler product than this one.
 *
 * All three go through the contract workflow layer rather than the bare
 * services. No rule listens for any of these events today, and that is exactly
 * why the wrapper is used: the screen depends on the application boundary
 * rather than on which service happens to have a rule behind it this week
 * (D-088).
 */

import type { ContractRow } from "../../selectors/contracts-list";
import {
  activateContractWorkflow,
  cancelContractWorkflow,
  completeContractWorkflow,
} from "../../services/contract-workflows";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import { useLeadAction } from "../leads/use-lead-action";

export type ContractConfirmKind = "activate" | "complete" | "cancel";

const COPY: Record<
  ContractConfirmKind,
  { title: string; body: string; action: string; pending: string; done: string }
> = {
  activate: {
    title: "Activate this contract?",
    body:
      "The rental starts, and the vehicle reads Rented for as long as the contract runs. Activation is refused if the vehicle is in maintenance, or if it already has an active contract over these dates.",
    action: "Activate contract",
    pending: "Activating...",
    done: "Contract activated",
  },
  complete: {
    title: "Complete this contract?",
    body:
      "The contract closes and the vehicle is recomputed rather than simply freed, because a confirmed reservation or an open work order may already be waiting for it.",
    action: "Complete contract",
    pending: "Completing...",
    done: "Contract completed",
  },
  cancel: {
    title: "Cancel this contract?",
    body:
      "The contract is kept and marked cancelled, and the vehicle it was holding is released. Reset demo data restores the canonical dataset.",
    action: "Cancel contract",
    pending: "Cancelling...",
    done: "Contract cancelled",
  },
};

type Props = {
  kind: ContractConfirmKind;
  contract: ContractRow;
  onCancel: () => void;
  onDone: (message: string) => void;
};

export default function ContractConfirmAction({ kind, contract, onCancel, onDone }: Props) {
  const { ctx } = useOperations();
  const action = useLeadAction();
  const copy = COPY[kind];

  const run = async () => {
    if (!ctx) return;
    /* The three wrappers return a workflow result over a different payload, and
       none of the payloads is used here: the screen re-reads from the store. So
       the call is narrowed to "it happened" rather than widened to a union. */
    const done = await action.run(async () => {
      if (kind === "activate") await activateContractWorkflow(ctx, contract.id);
      else if (kind === "complete") await completeContractWorkflow(ctx, contract.id);
      else await cancelContractWorkflow(ctx, contract.id);
      return true;
    });
    if (done) onDone(copy.done);
    /* A refusal leaves the dialog open carrying the service's own sentence:
       closing would hide the one thing the visitor needs to read. */
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
        {contract.customerName} <span className="ops-confirm__id">{contract.id}</span>
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
          Back
        </button>
        <button
          type="button"
          className="ops-button ops-button--primary"
          onClick={run}
          disabled={action.pending}
        >
          {action.pending ? copy.pending : copy.action}
        </button>
      </div>
    </OpsOverlay>
  );
}
