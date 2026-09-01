/**
 * Operations demo — maintenance services.
 *
 * The rule worth stating: a work order cannot start on a vehicle that is out
 * on an active rental. The vehicle is not there to work on, and allowing it
 * would produce the contradictory state the derived-status rules exist to
 * prevent.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { C, P } from "../constants";
import { requireWrite } from "../permissions";
import type {
  MaintenancePriority,
  MaintenanceType,
  MaintenanceWorkOrder,
} from "../types";
import {
  conflict,
  invalid,
  must,
  read,
  refreshedVehicle,
  withAdded,
  withReplaced,
  type OperationsContext,
} from "./context";

export type CreateMaintenanceInput = {
  vehicleId: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  summary: string;
};

export async function createMaintenance(
  ctx: OperationsContext,
  input: CreateMaintenanceInput
): Promise<DemoRecord<MaintenanceWorkOrder>> {
  requireWrite(ctx.session, "Maintenance");
  await must.vehicle(ctx, input.vehicleId);
  if (!input.summary.trim()) throw invalid("A work order needs a summary.", "summary");

  const result = await ctx.runtime.commit<DemoRecord<MaintenanceWorkOrder>>((m) => {
    const id = m.nextId(C.maintenance, P.maintenance);
    const record = m.record<MaintenanceWorkOrder>(C.maintenance, id, {
      vehicleId: input.vehicleId,
      type: input.type,
      priority: input.priority,
      status: "Open",
      openedAt: m.now(),
      summary: input.summary.trim(),
    });
    return {
      ops: [{ kind: "put", record }],
      events: [
        {
          type: "maintenance.opened",
          entityId: id,
          collection: C.maintenance,
          payload: { workOrderId: id, vehicleId: input.vehicleId },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

export async function startMaintenance(
  ctx: OperationsContext,
  workOrderId: string
): Promise<DemoRecord<MaintenanceWorkOrder>> {
  requireWrite(ctx.session, "Maintenance");
  const workOrder = await must.workOrder(ctx, workOrderId);
  if (workOrder.data.status !== "Open") {
    throw conflict("Only an open work order can be started.", workOrderId);
  }

  const [contracts, reservations, workOrders] = await Promise.all([
    read.contracts(ctx),
    read.reservations(ctx),
    read.maintenance(ctx),
  ]);
  const vehicle = await must.vehicle(ctx, workOrder.data.vehicleId);

  /* The frozen conflict: a vehicle out on an active rental is not available to
     work on. */
  if (
    contracts.some((c) => c.data.vehicleId === vehicle.id && c.data.status === "Active")
  ) {
    throw conflict(
      `${vehicle.data.assetCode} is out on an active rental and cannot start maintenance.`,
      vehicle.id
    );
  }

  const result = await ctx.runtime.commit<DemoRecord<MaintenanceWorkOrder>>((m) => {
    const nextData: MaintenanceWorkOrder = {
      ...workOrder.data,
      status: "In Progress",
      startedAt: m.now(),
    };
    const record = m.record<MaintenanceWorkOrder>(C.maintenance, workOrderId, nextData, workOrder);
    const world = {
      contracts,
      reservations,
      workOrders: withReplaced(workOrders, workOrderId, nextData),
    };

    return {
      ops: [
        { kind: "put", record },
        { kind: "put", record: refreshedVehicle(m, vehicle, world) },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "maintenance.started",
            collection: C.maintenance,
            entityId: workOrderId,
            summary: `Work order started on ${vehicle.data.assetCode}`,
            changes: [{ field: "status", from: "Open", to: "In Progress" }],
          },
        },
      ],
      events: [
        {
          type: "maintenance.started",
          entityId: workOrderId,
          collection: C.maintenance,
          payload: { workOrderId, vehicleId: vehicle.id },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

export async function completeMaintenance(
  ctx: OperationsContext,
  workOrderId: string
): Promise<DemoRecord<MaintenanceWorkOrder>> {
  requireWrite(ctx.session, "Maintenance");
  const workOrder = await must.workOrder(ctx, workOrderId);
  if (workOrder.data.status !== "In Progress") {
    throw conflict("Only a work order in progress can be completed.", workOrderId);
  }

  const [contracts, reservations, workOrders] = await Promise.all([
    read.contracts(ctx),
    read.reservations(ctx),
    read.maintenance(ctx),
  ]);
  const vehicle = await must.vehicle(ctx, workOrder.data.vehicleId);

  const result = await ctx.runtime.commit<DemoRecord<MaintenanceWorkOrder>>((m) => {
    const nextData: MaintenanceWorkOrder = {
      ...workOrder.data,
      status: "Completed",
      completedAt: m.now(),
    };
    const record = m.record<MaintenanceWorkOrder>(C.maintenance, workOrderId, nextData, workOrder);
    const world = {
      contracts,
      reservations,
      workOrders: withReplaced(workOrders, workOrderId, nextData),
    };

    return {
      ops: [
        { kind: "put", record },
        { kind: "put", record: refreshedVehicle(m, vehicle, world) },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "maintenance.completed",
            collection: C.maintenance,
            entityId: workOrderId,
            summary: `Work order completed and ${vehicle.data.assetCode} returned to the fleet`,
            changes: [{ field: "status", from: "In Progress", to: "Completed" }],
          },
        },
      ],
      events: [
        {
          type: "maintenance.completed",
          entityId: workOrderId,
          collection: C.maintenance,
          payload: { workOrderId, vehicleId: vehicle.id },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

export async function cancelMaintenance(
  ctx: OperationsContext,
  workOrderId: string
): Promise<DemoRecord<MaintenanceWorkOrder>> {
  requireWrite(ctx.session, "Maintenance");
  const workOrder = await must.workOrder(ctx, workOrderId);
  if (workOrder.data.status === "Completed" || workOrder.data.status === "Cancelled") {
    throw conflict(`A ${workOrder.data.status.toLowerCase()} work order cannot be cancelled.`, workOrderId);
  }

  const from = workOrder.data.status;
  const [contracts, reservations, workOrders] = await Promise.all([
    read.contracts(ctx),
    read.reservations(ctx),
    read.maintenance(ctx),
  ]);
  const vehicle = await must.vehicle(ctx, workOrder.data.vehicleId);

  const result = await ctx.runtime.commit<DemoRecord<MaintenanceWorkOrder>>((m) => {
    const nextData: MaintenanceWorkOrder = { ...workOrder.data, status: "Cancelled" };
    const record = m.record<MaintenanceWorkOrder>(C.maintenance, workOrderId, nextData, workOrder);
    const world = {
      contracts,
      reservations,
      workOrders: withReplaced(workOrders, workOrderId, nextData),
    };

    return {
      ops: [
        { kind: "put", record },
        { kind: "put", record: refreshedVehicle(m, vehicle, world) },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "maintenance.cancelled",
            collection: C.maintenance,
            entityId: workOrderId,
            summary: "Work order cancelled",
            changes: [{ field: "status", from, to: "Cancelled" }],
          },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

/** Re-export for the seed integrity checker and the fleet selectors. */
export { withAdded };
