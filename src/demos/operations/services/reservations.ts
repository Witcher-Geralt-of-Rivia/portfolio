/**
 * Operations demo — reservation services, and vehicle availability.
 *
 * Availability is the interesting part. A vehicle is eligible only when
 * nothing else claims its dates: no overlapping active contract, no
 * overlapping confirmed reservation, and no work order holding it. One overlap
 * helper serves all three, because two nearly-identical versions is how a
 * booking system ends up allowing a double-booking down exactly one path.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { C, P } from "../constants";
import { requireWrite } from "../permissions";
import { contractTotalCents, dailyRateForVehicle, isActiveWorkOrder, overlaps } from "../selectors/derive";
import type { Contract, Interval, Reservation, Vehicle, VehicleClass } from "../types";
import {
  conflict,
  invalid,
  must,
  read,
  refreshedVehicle,
  withReplaced,
  type OperationsContext,
} from "./context";

/* =====================================================================
   AVAILABILITY
   ===================================================================== */

export type EligibilityInput = {
  vehicleClass: VehicleClass;
  startAt: string;
  endAt: string;
  /** Ignore this reservation's own hold when re-checking it. */
  ignoreReservationId?: string;
};

/**
 * Vehicles of the right class that nothing else claims for the period.
 *
 * Deterministic: the result is ordered by id, so the same query always offers
 * the same list in the same order.
 */
export async function getEligibleVehicles(
  ctx: OperationsContext,
  input: EligibilityInput
): Promise<DemoRecord<Vehicle>[]> {
  const period: Interval = { startAt: input.startAt, endAt: input.endAt };
  const [vehicles, contracts, reservations, workOrders] = await Promise.all([
    read.vehicles(ctx),
    read.contracts(ctx),
    read.reservations(ctx),
    read.maintenance(ctx),
  ]);

  return vehicles
    .filter((v) => v.data.vehicleClass === input.vehicleClass)
    .filter((v) => {
      const held = workOrders.some(
        (w) => w.data.vehicleId === v.id && isActiveWorkOrder(w.data)
      );
      if (held) return false;

      const contractClash = contracts.some(
        (c) =>
          c.data.vehicleId === v.id &&
          (c.data.status === "Active" || c.data.status === "Pending") &&
          overlaps(period, { startAt: c.data.startAt, endAt: c.data.endAt })
      );
      if (contractClash) return false;

      const reservationClash = reservations.some(
        (r) =>
          r.data.vehicleId === v.id &&
          r.id !== input.ignoreReservationId &&
          r.data.status === "Confirmed" &&
          overlaps(period, { startAt: r.data.startAt, endAt: r.data.endAt })
      );
      return !reservationClash;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/* =====================================================================
   SERVICES
   ===================================================================== */

export type CreateReservationInput = {
  customerId: string;
  vehicleClass: VehicleClass;
  startAt: string;
  endAt: string;
  vehicleId?: string;
  notes?: string;
};

export async function createReservation(
  ctx: OperationsContext,
  input: CreateReservationInput
): Promise<DemoRecord<Reservation>> {
  requireWrite(ctx.session, "Reservations");
  await must.customer(ctx, input.customerId);

  if (Date.parse(input.endAt) <= Date.parse(input.startAt)) {
    throw invalid("A reservation must end after it starts.", "endAt");
  }

  const result = await ctx.runtime.commit<DemoRecord<Reservation>>((m) => {
    const id = m.nextId(C.reservations, P.reservation);
    const record = m.record<Reservation>(C.reservations, id, {
      customerId: input.customerId,
      ...(input.vehicleId ? { vehicleId: input.vehicleId } : {}),
      vehicleClass: input.vehicleClass,
      startAt: input.startAt,
      endAt: input.endAt,
      status: "Draft",
      notes: input.notes ?? "",
    });
    return {
      ops: [{ kind: "put", record }],
      events: [
        {
          type: "reservation.created",
          entityId: id,
          collection: C.reservations,
          payload: { reservationId: id },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

export type UpdateDraftInput = {
  startAt?: string;
  endAt?: string;
  vehicleClass?: VehicleClass;
  notes?: string;
};

export async function updateDraftReservation(
  ctx: OperationsContext,
  reservationId: string,
  input: UpdateDraftInput
): Promise<DemoRecord<Reservation>> {
  requireWrite(ctx.session, "Reservations");
  const reservation = await must.reservation(ctx, reservationId);
  if (reservation.data.status !== "Draft") {
    throw conflict("Only a draft reservation can be edited.", reservationId);
  }

  const startAt = input.startAt ?? reservation.data.startAt;
  const endAt = input.endAt ?? reservation.data.endAt;
  if (Date.parse(endAt) <= Date.parse(startAt)) {
    throw invalid("A reservation must end after it starts.", "endAt");
  }

  const result = await ctx.runtime.commit<DemoRecord<Reservation>>((m) => {
    const record = m.record<Reservation>(
      C.reservations,
      reservationId,
      {
        ...reservation.data,
        startAt,
        endAt,
        ...(input.vehicleClass ? { vehicleClass: input.vehicleClass } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      reservation
    );
    return { ops: [{ kind: "put", record }], data: record };
  });

  return result.data;
}

/**
 * Confirm a reservation against an explicitly chosen vehicle.
 *
 * The vehicle is a required argument. Auto-assigning one at service level
 * would hide the decision the visitor is supposed to make, and would make the
 * demo's confirmation step meaningless.
 */
export async function confirmReservation(
  ctx: OperationsContext,
  reservationId: string,
  vehicleId: string
): Promise<DemoRecord<Reservation>> {
  requireWrite(ctx.session, "Reservations");
  const reservation = await must.reservation(ctx, reservationId);
  if (reservation.data.status !== "Draft") {
    throw conflict("Only a draft reservation can be confirmed.", reservationId);
  }

  const vehicle = await must.vehicle(ctx, vehicleId);
  if (vehicle.data.vehicleClass !== reservation.data.vehicleClass) {
    throw conflict(
      `That vehicle is ${vehicle.data.vehicleClass}, but the reservation is for ${reservation.data.vehicleClass}.`,
      vehicleId
    );
  }

  const eligible = await getEligibleVehicles(ctx, {
    vehicleClass: reservation.data.vehicleClass,
    startAt: reservation.data.startAt,
    endAt: reservation.data.endAt,
    ignoreReservationId: reservationId,
  });
  if (!eligible.some((v) => v.id === vehicleId)) {
    throw conflict("That vehicle is not available for these dates.", vehicleId);
  }

  const [contracts, reservations, workOrders] = await Promise.all([
    read.contracts(ctx),
    read.reservations(ctx),
    read.maintenance(ctx),
  ]);

  const result = await ctx.runtime.commit<DemoRecord<Reservation>>((m) => {
    const nextData: Reservation = {
      ...reservation.data,
      vehicleId,
      status: "Confirmed",
    };
    const record = m.record<Reservation>(C.reservations, reservationId, nextData, reservation);
    const world = {
      contracts,
      reservations: withReplaced(reservations, reservationId, nextData),
      workOrders,
    };
    const refreshed = refreshedVehicle(m, vehicle, world);

    return {
      ops: [
        { kind: "put", record },
        { kind: "put", record: refreshed },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "reservation.confirmed",
            collection: C.reservations,
            entityId: reservationId,
            summary: `Reservation confirmed on ${vehicle.data.assetCode}`,
            changes: [{ field: "status", from: "Draft", to: "Confirmed" }],
          },
        },
      ],
      events: [
        {
          type: "reservation.confirmed",
          entityId: reservationId,
          collection: C.reservations,
          payload: {
            reservationId,
            vehicleId,
            customerId: reservation.data.customerId,
          },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

export async function cancelReservation(
  ctx: OperationsContext,
  reservationId: string
): Promise<DemoRecord<Reservation>> {
  requireWrite(ctx.session, "Reservations");
  const reservation = await must.reservation(ctx, reservationId);
  if (reservation.data.status === "Converted") {
    throw conflict("A converted reservation cannot be cancelled.", reservationId);
  }
  if (reservation.data.status === "Cancelled") {
    throw conflict("This reservation is already cancelled.", reservationId);
  }

  const from = reservation.data.status;
  const [contracts, reservations, workOrders, vehicles] = await Promise.all([
    read.contracts(ctx),
    read.reservations(ctx),
    read.maintenance(ctx),
    read.vehicles(ctx),
  ]);
  const vehicle = reservation.data.vehicleId
    ? vehicles.find((v) => v.id === reservation.data.vehicleId)
    : undefined;

  const result = await ctx.runtime.commit<DemoRecord<Reservation>>((m) => {
    const nextData: Reservation = { ...reservation.data, status: "Cancelled" };
    const record = m.record<Reservation>(C.reservations, reservationId, nextData, reservation);
    const world = {
      contracts,
      reservations: withReplaced(reservations, reservationId, nextData),
      workOrders,
    };

    return {
      ops: [
        { kind: "put", record },
        ...(vehicle ? [{ kind: "put" as const, record: refreshedVehicle(m, vehicle, world) }] : []),
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "reservation.cancelled",
            collection: C.reservations,
            entityId: reservationId,
            summary: "Reservation cancelled and the vehicle released",
            changes: [{ field: "status", from, to: "Cancelled" }],
          },
        },
      ],
      events: [
        {
          type: "reservation.cancelled",
          entityId: reservationId,
          collection: C.reservations,
          payload: { reservationId },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

export type ConversionResult = {
  reservation: DemoRecord<Reservation>;
  contract: DemoRecord<Contract>;
};

/** Turn a confirmed reservation into a Pending contract, in one commit. */
export async function convertReservationToContract(
  ctx: OperationsContext,
  reservationId: string
): Promise<ConversionResult> {
  requireWrite(ctx.session, "Reservations");
  const reservation = await must.reservation(ctx, reservationId);

  if (reservation.data.status !== "Confirmed") {
    throw conflict("Only a confirmed reservation can be converted.", reservationId);
  }
  if (!reservation.data.vehicleId) {
    throw conflict("This reservation has no vehicle assigned.", reservationId);
  }

  const vehicle = await must.vehicle(ctx, reservation.data.vehicleId);
  const vehicleIndex = Number(vehicle.id.split("_")[1]) - 1;
  const dailyRate = dailyRateForVehicle(vehicle.data.vehicleClass, vehicleIndex);

  const result = await ctx.runtime.commit<ConversionResult>((m) => {
    const contractId = m.nextId(C.contracts, P.contract);
    const contract = m.record<Contract>(C.contracts, contractId, {
      customerId: reservation.data.customerId,
      vehicleId: vehicle.id,
      reservationId,
      status: "Pending",
      startAt: reservation.data.startAt,
      endAt: reservation.data.endAt,
      dailyRate,
      totalAmount: contractTotalCents(dailyRate, reservation.data.startAt, reservation.data.endAt),
      paidAmount: 0,
    });
    const converted = m.record<Reservation>(
      C.reservations,
      reservationId,
      { ...reservation.data, status: "Converted", convertedContractId: contractId },
      reservation
    );

    return {
      ops: [
        { kind: "put", record: contract },
        { kind: "put", record: converted },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "reservation.converted",
            collection: C.reservations,
            entityId: reservationId,
            summary: "Reservation converted to a contract",
            changes: [{ field: "status", from: "Confirmed", to: "Converted" }],
          },
        },
      ],
      events: [
        {
          type: "reservation.converted",
          entityId: reservationId,
          collection: C.reservations,
          payload: { reservationId, contractId },
        },
        {
          type: "contract.created",
          entityId: contractId,
          collection: C.contracts,
          payload: { contractId },
        },
      ],
      data: { reservation: converted, contract },
    };
  });

  return result.data;
}
