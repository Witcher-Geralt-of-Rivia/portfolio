/**
 * Operations demo — lead workflows.
 *
 * The layer that was missing between a mutation and the rules it is supposed
 * to wake.
 *
 * `processEvents` in `automations.ts` says of itself: "Called by workflows
 * after the mutation that produced the events." No workflow existed. The lead
 * services build the right domain events and hand them to `runtime.commit`,
 * which publishes them on the runtime's event bus — and nothing subscribed, so
 * creating a website lead never assigned it and qualifying a lead never set a
 * follow-up date. The frozen specification says both happen. The QA harness
 * appeared to prove they did, because it hand-wrote the events itself and
 * called `processEvents` directly; the production path had no equivalent.
 *
 * This module closes that gap without touching the services or their
 * signatures. It listens to the bus the runtime already publishes on, around
 * one awaited mutation, and hands what was published to the rule engine.
 *
 * The rules stay entirely in `automations.ts`. Nothing here knows that a
 * website lead gets assigned or that a qualified lead gets a follow-up date —
 * a screen calling these functions is asking for "the mutation and whatever it
 * sets off", not prescribing what that is.
 */

import type { DomainEvent } from "@/demo-runtime/types";

import { processEvents, type AutomationOutcome } from "./automations";
import { changeLeadStage, createLead, type CreateLeadInput } from "./leads";
import type { OperationsContext } from "./context";
import type { Lead, LeadStage } from "../types";
import type { DemoRecord } from "@/demo-runtime/types";

export type WorkflowResult<T> = {
  result: T;
  /** One per rule that woke. Empty when the mutation triggered nothing. */
  outcomes: AutomationOutcome[];
};

/**
 * Run a mutation, then evaluate the rules its events wake.
 *
 * `runtime.commit` publishes synchronously before it resolves, so everything
 * the mutation emitted has arrived by the time `run()` settles. The
 * subscription is released before the rules run: the rules commit too, and a
 * still-open collector would gather their events and consider feeding them
 * back in. (It would find no trigger for them today. Relying on that is a
 * worse guarantee than not collecting them at all.)
 *
 * A failed mutation wakes nothing, which is why the unsubscribe sits in
 * `finally` and the processing sits after it rather than inside the `try`.
 *
 * One caveat, stated rather than hidden: the bus is per-runtime, not
 * per-caller, so two mutations genuinely in flight together would each collect
 * the other's events. Every caller here is a form or a control that disables
 * itself while its own mutation is pending, so the overlap does not arise.
 */
export async function withAutomations<T>(
  ctx: OperationsContext,
  run: () => Promise<T>
): Promise<WorkflowResult<T>> {
  const collected: DomainEvent[] = [];
  const unsubscribe = ctx.runtime.events.subscribe((event) => {
    collected.push(event);
  });

  let result: T;
  try {
    result = await run();
  } finally {
    unsubscribe();
  }

  const outcomes = collected.length > 0 ? await processEvents(ctx, collected) : [];
  return { result, outcomes };
}

/**
 * Create a lead and let the rules see it.
 *
 * A lead from the website wakes Rule 01, which assigns it to a sales agent and
 * raises a CRM notification. Every other source wakes nothing — not because
 * this function checks the source, but because `createLead` emits a different
 * event for it and no rule is listening.
 */
export function createLeadWorkflow(
  ctx: OperationsContext,
  input: CreateLeadInput
): Promise<WorkflowResult<DemoRecord<Lead>>> {
  return withAutomations(ctx, () => createLead(ctx, input));
}

/**
 * Move a lead to a new stage and let the rules see it.
 *
 * Qualifying wakes Rule 02, which sets the follow-up two days out and raises a
 * notification. The other stages emit `lead.stage_changed`, which no rule
 * listens for.
 */
export function changeLeadStageWorkflow(
  ctx: OperationsContext,
  leadId: string,
  stage: LeadStage
): Promise<WorkflowResult<DemoRecord<Lead>>> {
  return withAutomations(ctx, () => changeLeadStage(ctx, leadId, stage));
}
