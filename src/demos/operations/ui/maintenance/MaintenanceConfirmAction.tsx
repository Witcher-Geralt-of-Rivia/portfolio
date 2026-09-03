"use client";

/**
 * Operations demo: confirming a work order transition.
 *
 * Three transitions, one dialog, because they share a shape: state what will
 * happen, name the record, and let the service refuse in its own words if it
 * is going to.
 *
 * All three go through the workflow layer rather than the bare services, and
 * completion is why that is not a stylistic preference. `completeMaintenance`
 * emits its event whether or not anyone is listening, and the only subscriber
 * in the product is the one `withAutomations` opens around a single awaited
 * mutation. A screen calling the bare service would close the work order, free
 * the vehicle, pass every domain assertion, and leave the fleet notification
 * unwritten. That is the defect the workflow layer exists to prevent (D-088),
 * and the other two are wrapped alongside it so the screen depends on the
 * application boundary rather than on which service happens to have a rule
 * behind it this week.
 *
 * Nothing here is worded as an alarm. Starting, finishing and calling off a
 * job are the three ordinary things that happen to planned work.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import {
  cancelMaintenanceWorkflow,
  completeMaintenanceWorkflow,
  startMaintenanceWorkflow,
} from "../../services/maintenance-workflows";
import type { MaintenanceWorkOrder } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import { useLeadAction } from "../leads/use-lead-action";

export type MaintenanceConfirmKind = "start" | "complete" | "cancel";

const COPY: Record<
  MaintenanceConfirmKind,
  { title: string; body: string; action: string; pending: string; done: string }
> = {
  start: {
    title: "Start this work order?",
    body:
      "The work order moves to In Progress and the vehicle stays out of service while the job runs. The domain refuses this while the vehicle is out on an active rental, and says so here if that is the case.",
    action: "Start work",
    pending: "Starting...",
    done: "Work order started",
  },
  complete: {
    title: "Complete this work order?",
    body:
      "The work order closes and the vehicle's status is recomputed rather than simply freed, so a booking or another open order still holding it keeps it. Completing also raises the fleet notification.",
    action: "Complete work",
    pending: "Completing...",
    done: "Work order completed",
  },
  cancel: {
    title: "Cancel this work order?",
    body:
      "The work order is kept and marked cancelled, and the vehicle's status is recomputed from whatever still holds it. Reset demo data restores the canonical dataset.",
    action: "Cancel work order",
    pending: "Cancelling...",
    done: "Work order cancelled",
  },
};

type Props = {
  kind: MaintenanceConfirmKind;
  workOrder: DemoRecord<MaintenanceWorkOrder>;
  vehicleLabel: string;
  onCancel: () => void;
  onDone: (message: string) => void;
};

export default function MaintenanceConfirmAction({
  kind,
  workOrder,
  vehicleLabel,
  onCancel,
  onDone,
}: Props) {
  const { ctx } = useOperations();
  const action = useLeadAction();
  const copy = COPY[kind];

  const run = async () => {
    if (!ctx) return;
    /* The three wrappers answer with a workflow result over the same record,
       and none of those payloads is used here: the screen re-reads from the
       store. So the call is narrowed to "it happened" rather than widened to
       a union. */
    const done = await action.run(async () => {
      if (kind === "start") await startMaintenanceWorkflow(ctx, workOrder.id);
      else if (kind === "complete") await completeMaintenanceWorkflow(ctx, workOrder.id);
      else await cancelMaintenanceWorkflow(ctx, workOrder.id);
      return true;
    });
    if (done) onDone(copy.done);
    /* A refusal leaves the dialog open carrying the service's own sentence.
       This is where the active-rental conflict is read, and closing would hide
       the one thing the visitor needs. */
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
        {vehicleLabel} <span className="ops-confirm__id">{workOrder.id}</span>
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
