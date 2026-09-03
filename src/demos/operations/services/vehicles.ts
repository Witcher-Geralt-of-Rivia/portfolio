/**
 * Operations demo: vehicle services.
 *
 * The one entity the visitor may create whose identity is not theirs to choose.
 * An asset code is how a fleet refers to a machine on a worksheet, so it is
 * allocated by the system and never typed: two vehicles sharing a code is a
 * fleet that cannot be talked about.
 *
 * Everything else about a vehicle is either editable (its model, its class, its
 * odometer) or derived and therefore not writable at all. `status`,
 * `currentContractId`, `currentReservationId` and `activeMaintenanceId` are a
 * cache of `deriveVehicleStatus` and `deriveVehicleLinks`, and this module
 * writes them the same way every other service does: by recomputing them from
 * the world rather than by accepting them from a caller.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { C, MODELS_BY_CLASS, P } from "../constants";
import { requireWrite } from "../permissions";
import type { ModelLabel, ServiceArea, Vehicle, VehicleClass } from "../types";
import {
  invalid,
  must,
  read,
  refreshedVehicle,
  type OperationsContext,
} from "./context";

export type CreateVehicleInput = {
  modelLabel: ModelLabel;
  vehicleClass: VehicleClass;
  odometerKm: number;
};

export type UpdateVehicleInput = CreateVehicleInput;

/* =====================================================================
   ASSET CODES
   ===================================================================== */

const ASSET_PATTERN = /^MTR-(\d+)$/;

/**
 * The next free asset code, read from the vehicles that actually exist.
 *
 * Not from the collection's length. Length counts records, and the demo's
 * store is a local database a visitor can mutate: after one deletion the count
 * and the highest code disagree, and the next allocation would collide with a
 * code already in use. The highest numeric suffix is the only thing that
 * answers "what has been handed out", so that is what this reads.
 *
 * The canonical seed ends at `MTR-024`, so the first vehicle a visitor creates
 * is `MTR-025` and the one after it `MTR-026`. Codes are never reused: a
 * suffix, once issued, stays issued for the life of the demo data.
 */
export function nextAssetCode(vehicles: DemoRecord<Vehicle>[]): string {
  const taken = new Set(vehicles.map((v) => v.data.assetCode));

  let highest = 0;
  for (const vehicle of vehicles) {
    const match = ASSET_PATTERN.exec(vehicle.data.assetCode);
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isSafeInteger(value) && value > highest) highest = value;
  }

  /* The loop is the collision guard. A code shaped `MTR-0031` parses to 31 and
     would be missed by a naive `highest + 1` if a differently padded twin
     existed, so the candidate is checked against what is actually taken. */
  let candidate = highest + 1;
  while (taken.has(formatAssetCode(candidate))) candidate += 1;
  return formatAssetCode(candidate);
}

function formatAssetCode(n: number): string {
  return `MTR-${String(n).padStart(3, "0")}`;
}

/**
 * The service area a newly created vehicle joins.
 *
 * The seed spreads its twenty-four across the four areas in order, so a new
 * vehicle continues that rotation rather than piling into one. Derived from the
 * allocated code so the same creation always lands in the same area.
 */
const AREAS: ServiceArea[] = ["Central", "North", "East", "South"];

function areaForAssetCode(assetCode: string): ServiceArea {
  const match = ASSET_PATTERN.exec(assetCode);
  const n = match ? Number(match[1]) : 1;
  return AREAS[(n - 1) % AREAS.length];
}

/* =====================================================================
   VALIDATION
   ===================================================================== */

/**
 * A model belongs to exactly one class (`MODELS_BY_CLASS`), so the pair is
 * either coherent or it is a mistake. Checked here rather than only in a form,
 * because a form is one caller and this rule is the domain's.
 */
function checkModel(vehicleClass: VehicleClass, modelLabel: ModelLabel): void {
  const models = MODELS_BY_CLASS[vehicleClass];
  if (!models.includes(modelLabel)) {
    throw invalid(
      `${modelLabel} is not a ${vehicleClass} model. Choose one of ${models.join(", ")}.`,
      "modelLabel"
    );
  }
}

/** Whole kilometres, never negative, never infinite. An odometer is a counter. */
function checkOdometer(odometerKm: number): void {
  if (!Number.isFinite(odometerKm)) {
    throw invalid("An odometer reading has to be a number.", "odometerKm");
  }
  if (!Number.isInteger(odometerKm)) {
    throw invalid("An odometer reading is a whole number of kilometres.", "odometerKm");
  }
  if (odometerKm < 0) {
    throw invalid("An odometer reading cannot be negative.", "odometerKm");
  }
}

/* =====================================================================
   MUTATIONS
   ===================================================================== */

export async function createVehicle(
  ctx: OperationsContext,
  input: CreateVehicleInput
): Promise<DemoRecord<Vehicle>> {
  requireWrite(ctx.session, "Fleet");
  checkModel(input.vehicleClass, input.modelLabel);
  checkOdometer(input.odometerKm);

  const vehicles = await read.vehicles(ctx);
  const assetCode = nextAssetCode(vehicles);

  const result = await ctx.runtime.commit<DemoRecord<Vehicle>>((m) => {
    const id = m.nextId(C.vehicles, P.vehicle);
    const record = m.record<Vehicle>(C.vehicles, id, {
      assetCode,
      modelLabel: input.modelLabel,
      vehicleClass: input.vehicleClass,
      /* Nothing points at a vehicle that did not exist a moment ago, so the
         derivation can only say Available. It is written through the same
         helper anyway: a status this module set by hand would be the one place
         the cache was not a cache. */
      status: "Available",
      odometerKm: input.odometerKm,
      serviceArea: areaForAssetCode(assetCode),
    });

    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "vehicle.created",
            collection: C.vehicles,
            entityId: id,
            summary: `${assetCode} ${input.modelLabel} added to the fleet`,
          },
        },
      ],
      events: [
        {
          type: "vehicle.created",
          entityId: id,
          collection: C.vehicles,
          payload: { vehicleId: id, assetCode },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

/**
 * Change what a vehicle is, never what it is doing.
 *
 * The three editable fields are the ones a person knows about a machine. The
 * relationship pointers and the status are recomputed from the world on the way
 * out, so an edit cannot leave a vehicle claiming to be Available while an
 * active contract still names it.
 */
export async function updateVehicle(
  ctx: OperationsContext,
  vehicleId: string,
  input: UpdateVehicleInput
): Promise<DemoRecord<Vehicle>> {
  requireWrite(ctx.session, "Fleet");
  const vehicle = await must.vehicle(ctx, vehicleId);
  checkModel(input.vehicleClass, input.modelLabel);
  checkOdometer(input.odometerKm);

  const [contracts, reservations, workOrders] = await Promise.all([
    read.contracts(ctx),
    read.reservations(ctx),
    read.maintenance(ctx),
  ]);

  const before = vehicle.data;

  const result = await ctx.runtime.commit<DemoRecord<Vehicle>>((m) => {
    const edited: DemoRecord<Vehicle> = {
      ...vehicle,
      data: {
        ...before,
        modelLabel: input.modelLabel,
        vehicleClass: input.vehicleClass,
        odometerKm: input.odometerKm,
      },
    };
    const record = refreshedVehicle(m, edited, { contracts, reservations, workOrders });

    const changes = [
      before.modelLabel !== input.modelLabel
        ? { field: "modelLabel", from: before.modelLabel, to: input.modelLabel }
        : null,
      before.vehicleClass !== input.vehicleClass
        ? { field: "vehicleClass", from: before.vehicleClass, to: input.vehicleClass }
        : null,
      before.odometerKm !== input.odometerKm
        ? {
            field: "odometerKm",
            from: String(before.odometerKm),
            to: String(input.odometerKm),
          }
        : null,
    ].filter((c): c is { field: string; from: string; to: string } => c !== null);

    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "vehicle.updated",
            collection: C.vehicles,
            entityId: vehicleId,
            summary: `${before.assetCode} details updated`,
            changes,
          },
        },
      ],
      data: record,
    };
  });

  return result.data;
}
