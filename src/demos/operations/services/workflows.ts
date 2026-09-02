/**
 * Operations demo: the workflow layer.
 *
 * A service writes records and publishes events. Something has to notice those
 * events and wake the automation rules, and the runtime deliberately does not:
 * its bus is fire-and-forget, with no buffer and no replay, so an event
 * published while nobody is listening is delivered to nobody.
 *
 * That join lives here. A screen asks for "this mutation and whatever it sets
 * off" without knowing what that is, and the rules stay entirely in
 * `automations.ts` (D-063).
 *
 * This module is deliberately neutral. It was written for Leads in 09C3.1 and
 * lived in `lead-workflows.ts`, which was accurate while leads were the only
 * mutations with rules behind them. Reservations have one too: confirming a
 * reservation is Rule 03's trigger. Leaving the mechanism in a file named for
 * leads would have meant either a reservation workflow importing from
 * `lead-workflows`, which is false, or a second copy, which is worse (D-088).
 */

import type { DomainEvent } from "@/demo-runtime/types";

import { processEvents, type AutomationOutcome } from "./automations";
import type { OperationsContext } from "./context";

export type WorkflowResult<T> = {
  result: T;
  outcomes: AutomationOutcome[];
};

/**
 * Run a mutation and process whatever rules its events wake.
 *
 * The collector is unsubscribed before the rules run, so the rules' own
 * commits are not fed back in.
 *
 * The bus is per-runtime rather than per-caller, so two mutations genuinely in
 * flight together would each collect the other's events. Every caller is a
 * control that disables itself while its own mutation is pending; that is the
 * discipline this depends on, and it is stated here rather than left to be
 * discovered.
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
