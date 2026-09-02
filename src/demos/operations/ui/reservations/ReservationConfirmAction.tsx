"use client";

/**
 * Operations demo: confirming a cancel or a conversion.
 *
 * Two lifecycle transitions that deserve a deliberate second step, sharing one
 * dialog because they share a shape: state what will happen, name the record,
 * and let the service refuse in its own words if it is going to.
 *
 * Both go through the reservation workflow layer rather than the bare
 * services. No rule listens for either event today, and that is exactly why
 * the wrapper is used: the screen depends on the application boundary rather
 * than on which of the services happens to have a rule behind it this week
 * (D-088).
 */

import type { DemoRecord } from "@/demo-runtime/types";

import {
  cancelReservationWorkflow,
  convertReservationWorkflow,
} from "../../services/reservation-workflows";
import type { Reservation } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import { useLeadAction } from "../leads/use-lead-action";

export type ReservationConfirmKind = "cancel" | "convert";

const COPY: Record<
  ReservationConfirmKind,
  { title: string; body: string; action: string; pending: string; done: string }
> = {
  cancel: {
    title: "Cancel this reservation?",
    body:
      "The reservation is kept and marked cancelled, and any vehicle it was holding goes back to the fleet. Reset demo data restores the canonical dataset.",
    action: "Cancel reservation",
    pending: "Cancelling...",
    done: "Reservation cancelled",
  },
  convert: {
    title: "Convert to a contract?",
    body:
      "The reservation becomes converted and a contract is created for it in Pending. The rental does not start yet: a pending contract has to be activated before the vehicle is out on hire.",
    action: "Convert to contract",
    pending: "Converting...",
    done: "Reservation converted to a contract",
  },
};

type Props = {
  kind: ReservationConfirmKind;
  reservation: DemoRecord<Reservation>;
  customerName: string;
  onCancel: () => void;
  onDone: (message: string) => void;
};

export default function ReservationConfirmAction({
  kind,
  reservation,
  customerName,
  onCancel,
  onDone,
}: Props) {
  const { ctx } = useOperations();
  const action = useLeadAction();
  const copy = COPY[kind];

  const run = async () => {
    if (!ctx) return;
    /* Both wrappers return a workflow result over a different payload, and
       neither payload is used here: the screen re-reads from the store. So the
       call is narrowed to "it happened" rather than widened to a union. */
    const done = await action.run(async () => {
      if (kind === "cancel") await cancelReservationWorkflow(ctx, reservation.id);
      else await convertReservationWorkflow(ctx, reservation.id);
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
        {customerName} <span className="ops-confirm__id">{reservation.id}</span>
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
