/**
 * Operations demo — contract services.
 *
 * Activation and completion are where a vehicle changes hands, so both end by
 * recomputing the vehicle rather than writing a status directly. Completion in
 * particular must not assume Available: a confirmed reservation or an open
 * work order may be waiting, and blindly writing Available would contradict
 * both.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { C } from "../constants";
import { requireWrite } from "../permissions";
import { isActiveWorkOrder, overlaps } from "../selectors/derive";
import type { Contract } from "../types";
import {
  conflict,
  must,
  read,
  refreshedVehicle,
  withReplaced,
  type OperationsContext,
} from "./context";

export async function activateContract(
  ctx: OperationsContext,
  contractId: string
): Promise<DemoRecord<Contract>> {
  requireWrite(ctx.session, "Contracts");
  const contract = await must.contract(ctx, contractId);

  if (contract.data.status !== "Pending") {
    throw conflict(`A ${contract.data.status.toLowerCase()} contract cannot be activated.`, contractId);
  }

  const [contracts, reservations, workOrders] = await Promise.all([
    read.contracts(ctx),
    read.reservations(ctx),
    read.maintenance(ctx),
  ]);
  const vehicle = await must.vehicle(ctx, contract.data.vehicleId);

  if (
    workOrders.some(
      (w) => w.data.vehicleId === vehicle.id && isActiveWorkOrder(w.data)
    )
  ) {
    throw conflict(
      `${vehicle.data.assetCode} is in maintenance and cannot start a rental.`,
      vehicle.id
    );
  }

  const clash = contracts.find(
    (c) =>
      c.id !== contractId &&
      c.data.vehicleId === vehicle.id &&
      c.data.status === "Active" &&
      overlaps(
        { startAt: contract.data.startAt, endAt: contract.data.endAt },
        { startAt: c.data.startAt, endAt: c.data.endAt }
      )
  );
  if (clash) {
    throw conflict(
      `${vehicle.data.assetCode} already has an active contract over these dates.`,
      clash.id
    );
  }

  const result = await ctx.runtime.commit<DemoRecord<Contract>>((m) => {
    const nextData: Contract = { ...contract.data, status: "Active" };
    const record = m.record<Contract>(C.contracts, contractId, nextData, contract);
    const world = {
      contracts: withReplaced(contracts, contractId, nextData),
      reservations,
      workOrders,
    };

    return {
      ops: [
        { kind: "put", record },
        { kind: "put", record: refreshedVehicle(m, vehicle, world) },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "contract.activated",
            collection: C.contracts,
            entityId: contractId,
            summary: `Contract activated on ${vehicle.data.assetCode}`,
            changes: [{ field: "status", from: "Pending", to: "Active" }],
          },
        },
      ],
      events: [
        {
          type: "contract.activated",
          entityId: contractId,
          collection: C.contracts,
          payload: { contractId, vehicleId: vehicle.id },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

export async function completeContract(
  ctx: OperationsContext,
  contractId: string
): Promise<DemoRecord<Contract>> {
  requireWrite(ctx.session, "Contracts");
  const contract = await must.contract(ctx, contractId);
  if (contract.data.status !== "Active") {
    throw conflict("Only an active contract can be completed.", contractId);
  }

  const [contracts, reservations, workOrders] = await Promise.all([
    read.contracts(ctx),
    read.reservations(ctx),
    read.maintenance(ctx),
  ]);
  const vehicle = await must.vehicle(ctx, contract.data.vehicleId);

  const result = await ctx.runtime.commit<DemoRecord<Contract>>((m) => {
    const nextData: Contract = { ...contract.data, status: "Completed" };
    const record = m.record<Contract>(C.contracts, contractId, nextData, contract);
    /* The vehicle is recomputed, not set to Available: a confirmed
       reservation or an open work order may already be waiting for it. */
    const world = {
      contracts: withReplaced(contracts, contractId, nextData),
      reservations,
      workOrders,
    };

    return {
      ops: [
        { kind: "put", record },
        { kind: "put", record: refreshedVehicle(m, vehicle, world) },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "contract.completed",
            collection: C.contracts,
            entityId: contractId,
            summary: `Contract completed and ${vehicle.data.assetCode} returned`,
            changes: [{ field: "status", from: "Active", to: "Completed" }],
          },
        },
      ],
      events: [
        {
          type: "contract.completed",
          entityId: contractId,
          collection: C.contracts,
          payload: { contractId, vehicleId: vehicle.id },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

export async function cancelContract(
  ctx: OperationsContext,
  contractId: string
): Promise<DemoRecord<Contract>> {
  requireWrite(ctx.session, "Contracts");
  const contract = await must.contract(ctx, contractId);
  if (contract.data.status === "Cancelled") {
    throw conflict("This contract is already cancelled.", contractId);
  }
  if (contract.data.status === "Completed") {
    throw conflict("A completed contract cannot be cancelled.", contractId);
  }

  const from = contract.data.status;
  const [contracts, reservations, workOrders] = await Promise.all([
    read.contracts(ctx),
    read.reservations(ctx),
    read.maintenance(ctx),
  ]);
  const vehicle = await must.vehicle(ctx, contract.data.vehicleId);

  const result = await ctx.runtime.commit<DemoRecord<Contract>>((m) => {
    const nextData: Contract = { ...contract.data, status: "Cancelled" };
    const record = m.record<Contract>(C.contracts, contractId, nextData, contract);
    const world = {
      contracts: withReplaced(contracts, contractId, nextData),
      reservations,
      workOrders,
    };

    return {
      ops: [
        { kind: "put", record },
        { kind: "put", record: refreshedVehicle(m, vehicle, world) },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "contract.cancelled",
            collection: C.contracts,
            entityId: contractId,
            summary: "Contract cancelled and the vehicle released",
            changes: [{ field: "status", from, to: "Cancelled" }],
          },
        },
      ],
      events: [
        {
          type: "contract.cancelled",
          entityId: contractId,
          collection: C.contracts,
          payload: { contractId },
        },
      ],
      data: record,
    };
  });

  return result.data;
}
