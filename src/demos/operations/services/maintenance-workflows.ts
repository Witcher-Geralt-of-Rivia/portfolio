/**
 * Operations demo: maintenance workflows.
 *
 * Completing a work order is Rule 05's trigger. `completeMaintenance` has
 * always emitted `maintenance.completed` and `runtime.commit` has always
 * published it, but the bus is fire-and-forget: an event published while
 * nobody is listening reaches nobody, and the only subscriber in the product is
 * the one `withAutomations` opens around a single awaited mutation.
 *
 * So a Maintenance screen calling `completeMaintenance` directly would leave
 * the canonical maintenance notification unwritten while every domain
 * assertion still passed. That is the defect D-063 named for leads and D-088
 * named for reservations, arriving a third time in the same shape, and the
 * answer is the same one: the screen asks for the business action and the
 * wrapper is where the rules get to see it.
 *
 * The other three are wrapped as well. No rule listens for opening, starting or
 * cancelling a work order today, and that is exactly why: the screen depends on
 * the application boundary rather than on which of the four services happens to
 * have a rule behind it this week.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import type { MaintenanceWorkOrder } from "../types";
import type { OperationsContext } from "./context";
import {
  cancelMaintenance,
  completeMaintenance,
  createMaintenance,
  startMaintenance,
  type CreateMaintenanceInput,
} from "./maintenance";
import { withAutomations, type WorkflowResult } from "./workflows";

export function createMaintenanceWorkflow(
  ctx: OperationsContext,
  input: CreateMaintenanceInput
): Promise<WorkflowResult<DemoRecord<MaintenanceWorkOrder>>> {
  return withAutomations(ctx, () => createMaintenance(ctx, input));
}

export function startMaintenanceWorkflow(
  ctx: OperationsContext,
  workOrderId: string
): Promise<WorkflowResult<DemoRecord<MaintenanceWorkOrder>>> {
  return withAutomations(ctx, () => startMaintenance(ctx, workOrderId));
}

/**
 * Complete a work order and let the rules see it.
 *
 * Wakes Rule 05, which raises the Maintenance notification addressed to the
 * Fleet Coordinator. One visitor action, one complete result.
 */
export function completeMaintenanceWorkflow(
  ctx: OperationsContext,
  workOrderId: string
): Promise<WorkflowResult<DemoRecord<MaintenanceWorkOrder>>> {
  return withAutomations(ctx, () => completeMaintenance(ctx, workOrderId));
}

export function cancelMaintenanceWorkflow(
  ctx: OperationsContext,
  workOrderId: string
): Promise<WorkflowResult<DemoRecord<MaintenanceWorkOrder>>> {
  return withAutomations(ctx, () => cancelMaintenance(ctx, workOrderId));
}
