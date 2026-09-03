/**
 * Operations demo: payment workflows.
 *
 * Two entry points, and the second is the interesting one.
 *
 * `recordPaymentWorkflow` is the ordinary wrapper: no rule listens for
 * `payment.recorded` today, and it exists anyway so a screen calls one kind of
 * thing for every mutation and a rule added later needs no change at the call
 * site.
 *
 * `reconcileOverdueWorkflow` is how Rule 04 ever fires. A payment does not
 * become overdue because anything happened to it: it becomes overdue because
 * the clock passed its due date, and no mutation accompanies that. The
 * alternatives are a poll, an interval or a read of the wall clock, and all
 * three are forbidden here: the demo runs on a logical clock and is meant to be
 * idle at rest.
 *
 * So the transition is raised explicitly. `reconcileTimeDerivedState` finds the
 * payments the clock has passed, skips the ones already reported, synthesises
 * `payment.overdue` for the rest and hands them to `processEvents`. It is
 * idempotent by construction: a payment whose Finance notification already
 * exists is not raised again, so entering the module twice does not produce two
 * alerts.
 *
 * The wrapper is here rather than in a component because a screen should not
 * reach into the automation service. This is the application boundary the rest
 * of the product already talks to, and the Payments module talks to it the same
 * way every other module talks to its own (D-088).
 */

import type { OperationsContext } from "./context";
import {
  reconcileTimeDerivedState,
  type AutomationOutcome,
} from "./automations";
import { recordPayment, type RecordPaymentInput, type RecordPaymentResult } from "./payments";
import { withAutomations, type WorkflowResult } from "./workflows";

export function recordPaymentWorkflow(
  ctx: OperationsContext,
  input: RecordPaymentInput
): Promise<WorkflowResult<RecordPaymentResult>> {
  return withAutomations(ctx, () => recordPayment(ctx, input));
}

/**
 * Bring time-derived payment state up to date, and let Rule 04 see it.
 *
 * Called when the Payments module opens and after a payment is recorded. Not on
 * a timer: there is no timer anywhere in this product, and adding one to catch
 * a transition nobody is watching would be the wrong trade.
 *
 * Returns the outcomes so a caller can say what happened, and an empty array
 * when there was nothing to reconcile, which is the ordinary case.
 */
export function reconcileOverdueWorkflow(
  ctx: OperationsContext
): Promise<AutomationOutcome[]> {
  return reconcileTimeDerivedState(ctx);
}
