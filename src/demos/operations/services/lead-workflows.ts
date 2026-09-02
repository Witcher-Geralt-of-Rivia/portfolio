/**
 * Operations demo: lead workflows.
 *
 * The layer that was missing between a lead mutation and the rules it is
 * supposed to wake.
 *
 * `processEvents` in `automations.ts` says of itself: "Called by workflows
 * after the mutation that produced the events." No workflow existed. The lead
 * services build the right domain events and hand them to `runtime.commit`,
 * which publishes them on the runtime's event bus, and nothing subscribed, so
 * creating a website lead never assigned it and qualifying a lead never set a
 * follow-up date. The frozen specification says both happen. The QA harness
 * appeared to prove they did, because it hand-wrote the events itself and
 * called `processEvents` directly; the production path had no equivalent
 * (D-063).
 *
 * The mechanism that closes it now lives in `workflows.ts`, because
 * reservations need the same join and a file named for leads was the wrong
 * home for something two modules depend on (D-088). What remains here is the
 * two lead-shaped wrappers and nothing else.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { changeLeadStage, createLead, type CreateLeadInput } from "./leads";
import type { OperationsContext } from "./context";
import type { Lead, LeadStage } from "../types";
import { withAutomations, type WorkflowResult } from "./workflows";

/* Re-exported so the 09C3.1 import path keeps working: the Leads screen and
   the QA suites that name it are approved and should not have to move. */
export { withAutomations };
export type { WorkflowResult };

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
