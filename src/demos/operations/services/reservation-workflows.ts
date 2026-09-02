/**
 * Operations demo: reservation workflows.
 *
 * Confirming a reservation is Rule 03's trigger: the rule appends a System
 * message to the customer's conversation and marks it unread. The service has
 * always emitted `reservation.confirmed` and `runtime.commit` has always
 * published it, but the bus is fire-and-forget, so an event published while
 * nobody is listening reaches nobody.
 *
 * Until 09C4.0 nobody was listening. The only production subscriber in the
 * repository was the one `withAutomations` opens, and only the two lead
 * workflows used it, so a Reservations screen calling `confirmReservation`
 * directly would have reproduced the exact defect D-063 describes for leads:
 * a rule the frozen contract requires, which the QA appeared to prove because
 * the QA did the join by hand.
 *
 * These wrappers are what a Reservations screen calls. They exist so the
 * screen asks for one business action, "Confirm reservation", rather than for
 * a confirmation followed by a second control that runs the automation
 * (D-088).
 */

import type { DemoRecord } from "@/demo-runtime/types";

import type { Reservation } from "../types";
import type { OperationsContext } from "./context";
import {
  cancelReservation,
  confirmReservation,
  convertReservationToContract,
  type ConversionResult,
} from "./reservations";
import { withAutomations, type WorkflowResult } from "./workflows";

/**
 * Confirm a reservation and let the rules see it.
 *
 * Wakes Rule 03, which appends a System message to the customer's
 * conversation, opening one if the customer has none, and marks it unread.
 */
export function confirmReservationWorkflow(
  ctx: OperationsContext,
  reservationId: string,
  vehicleId: string
): Promise<WorkflowResult<DemoRecord<Reservation>>> {
  return withAutomations(ctx, () => confirmReservation(ctx, reservationId, vehicleId));
}

/**
 * Convert a confirmed reservation into a pending contract.
 *
 * No rule listens for `reservation.converted` or `contract.created` today.
 * The wrapper exists anyway so a screen calls one kind of thing for every
 * reservation mutation, and so a rule added later needs no change at the call
 * site.
 */
export function convertReservationWorkflow(
  ctx: OperationsContext,
  reservationId: string
): Promise<WorkflowResult<ConversionResult>> {
  return withAutomations(ctx, () => convertReservationToContract(ctx, reservationId));
}

/** Cancel a reservation. No rule listens for it today; see above. */
export function cancelReservationWorkflow(
  ctx: OperationsContext,
  reservationId: string
): Promise<WorkflowResult<DemoRecord<Reservation>>> {
  return withAutomations(ctx, () => cancelReservation(ctx, reservationId));
}
