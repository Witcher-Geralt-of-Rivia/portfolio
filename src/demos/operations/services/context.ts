/**
 * Operations demo — service context and shared plumbing.
 *
 * Every mutating service takes a context carrying the runtime and the current
 * simulated session, and enforces its own permission. A service that trusted
 * its caller to have checked would be a service whose rules live in whichever
 * screen happened to call it — which is exactly the pattern that makes
 * frontend role handling decorative.
 */

import type { DemoRuntime, MutationContext } from "@/demo-runtime/runtime";
import type { DemoRecord } from "@/demo-runtime/types";
import { DemoError } from "@/demo-runtime/types";

import { C } from "../constants";
import { deriveVehicleLinks, deriveVehicleStatus } from "../selectors/derive";
import type {
  Actor,
  Contract,
  Conversation,
  Customer,
  Lead,
  MaintenanceWorkOrder,
  Message,
  OperationsSession,
  Payment,
  Reservation,
  Vehicle,
} from "../types";

export type OperationsContext = {
  runtime: DemoRuntime;
  session: OperationsSession;
};

/** Typed collection reads. Services go through these rather than raw strings. */
export const read = {
  /* Actors are read by the Leads owner control, which has to name the people a
     lead can belong to. Reaching for the collection string in a screen is what
     this map exists to prevent. */
  actors: (ctx: OperationsContext) => ctx.runtime.repository.all<Actor>(C.actors),
  leads: (ctx: OperationsContext) => ctx.runtime.repository.all<Lead>(C.leads),
  customers: (ctx: OperationsContext) => ctx.runtime.repository.all<Customer>(C.customers),
  vehicles: (ctx: OperationsContext) => ctx.runtime.repository.all<Vehicle>(C.vehicles),
  reservations: (ctx: OperationsContext) =>
    ctx.runtime.repository.all<Reservation>(C.reservations),
  contracts: (ctx: OperationsContext) => ctx.runtime.repository.all<Contract>(C.contracts),
  payments: (ctx: OperationsContext) => ctx.runtime.repository.all<Payment>(C.payments),
  maintenance: (ctx: OperationsContext) =>
    ctx.runtime.repository.all<MaintenanceWorkOrder>(C.maintenance),
  conversations: (ctx: OperationsContext) =>
    ctx.runtime.repository.all<Conversation>(C.conversations),
  messages: (ctx: OperationsContext) => ctx.runtime.repository.all<Message>(C.messages),
};

/** Single reads that raise NOT_FOUND rather than returning null. */
export const must = {
  lead: (ctx: OperationsContext, id: string) => ctx.runtime.repository.require<Lead>(C.leads, id),
  customer: (ctx: OperationsContext, id: string) =>
    ctx.runtime.repository.require<Customer>(C.customers, id),
  vehicle: (ctx: OperationsContext, id: string) =>
    ctx.runtime.repository.require<Vehicle>(C.vehicles, id),
  reservation: (ctx: OperationsContext, id: string) =>
    ctx.runtime.repository.require<Reservation>(C.reservations, id),
  contract: (ctx: OperationsContext, id: string) =>
    ctx.runtime.repository.require<Contract>(C.contracts, id),
  payment: (ctx: OperationsContext, id: string) =>
    ctx.runtime.repository.require<Payment>(C.payments, id),
  workOrder: (ctx: OperationsContext, id: string) =>
    ctx.runtime.repository.require<MaintenanceWorkOrder>(C.maintenance, id),
  conversation: (ctx: OperationsContext, id: string) =>
    ctx.runtime.repository.require<Conversation>(C.conversations, id),
};

export function conflict(message: string, detail?: string): DemoError {
  return new DemoError("CONFLICT", message, detail);
}

export function invalid(message: string, field?: string): DemoError {
  return new DemoError("VALIDATION", message, field);
}

/**
 * Everything needed to recompute one vehicle's derived state.
 *
 * The caller passes the collections it has already read, with its own pending
 * change applied, so the refresh reflects the mutation being built rather than
 * the state before it.
 */
export type VehicleWorld = {
  contracts: DemoRecord<Contract>[];
  reservations: DemoRecord<Reservation>[];
  workOrders: DemoRecord<MaintenanceWorkOrder>[];
};

/**
 * The vehicle record a mutation should write, with status and relationship
 * pointers recomputed.
 *
 * Every service that touches a contract, reservation or work order calls this,
 * which is what keeps the stored status a cache of the derivation. Pointers are
 * cleared as well as set: a stale `currentContractId` on an Available vehicle
 * is the same class of lie as a stale status.
 */
export function refreshedVehicle(
  mutation: MutationContext,
  vehicle: DemoRecord<Vehicle>,
  world: VehicleWorld
): DemoRecord<Vehicle> {
  const ctx = {
    vehicleId: vehicle.id,
    contracts: world.contracts,
    reservations: world.reservations,
    workOrders: world.workOrders,
  };
  const status = deriveVehicleStatus(ctx);
  const links = deriveVehicleLinks(ctx);

  return mutation.record<Vehicle>(
    C.vehicles,
    vehicle.id,
    {
      ...vehicle.data,
      status,
      currentContractId: links.currentContractId,
      currentReservationId: links.currentReservationId,
      activeMaintenanceId: links.activeMaintenanceId,
    },
    vehicle
  );
}

/** Replace one row in a list, for building the post-change world. */
export function withReplaced<T>(
  rows: DemoRecord<T>[],
  id: string,
  data: T
): DemoRecord<T>[] {
  return rows.map((r) => (r.id === id ? { ...r, data } : r));
}

/** Add a row to a list, for building the post-change world. */
export function withAdded<T>(rows: DemoRecord<T>[], record: DemoRecord<T>): DemoRecord<T>[] {
  return [...rows, record];
}
