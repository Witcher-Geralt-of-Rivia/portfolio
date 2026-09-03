/**
 * Operations demo: contract workflows.
 *
 * No automation rule listens for `contract.activated`, `contract.completed` or
 * `contract.cancelled` today. The wrappers exist anyway, for the reason
 * `reservation-workflows.ts` gives: a screen should ask for one business
 * action, and a rule added later should need no change at the call site.
 *
 * The alternative is a codebase where some screens call services and others
 * call workflows depending on which happens to have a rule behind it, which is
 * precisely how a rule ends up silently not running when one is finally added.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import type { Contract } from "../types";
import { activateContract, cancelContract, completeContract } from "./contracts";
import type { OperationsContext } from "./context";
import { withAutomations, type WorkflowResult } from "./workflows";

export function activateContractWorkflow(
  ctx: OperationsContext,
  contractId: string
): Promise<WorkflowResult<DemoRecord<Contract>>> {
  return withAutomations(ctx, () => activateContract(ctx, contractId));
}

export function completeContractWorkflow(
  ctx: OperationsContext,
  contractId: string
): Promise<WorkflowResult<DemoRecord<Contract>>> {
  return withAutomations(ctx, () => completeContract(ctx, contractId));
}

export function cancelContractWorkflow(
  ctx: OperationsContext,
  contractId: string
): Promise<WorkflowResult<DemoRecord<Contract>>> {
  return withAutomations(ctx, () => cancelContract(ctx, contractId));
}
