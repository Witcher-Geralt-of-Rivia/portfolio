/**
 * Stage 09C4.A - Rental Operations core, at the domain layer.
 *
 * Domain only. The three module screens have their own suites; this one asks
 * whether the contract underneath them holds, and it asks it the way 09C4.0
 * did: by running the real bundled services against a real runtime and then
 * comparing every vehicle in the store against its own derivation.
 *
 * Three things are new here and none of them existed before this batch:
 *
 *   1. a vehicle write service, and the asset code allocation it owns
 *   2. Rule 05, which only fires if maintenance completion goes through the
 *      workflow layer rather than the bare service
 *   3. one end-to-end sequence that walks a booking from draft to a finished
 *      rental and out the other side into the workshop, checking coherence at
 *      every step rather than only at the end
 *
 * Needs the domain probe route:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c4a-core.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * Port 3001, never 3200: 3200 belongs to the other application on this host,
 * 3100 is this portfolio's production and 3000 is its development preview.
 */

import { chromium } from "playwright";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3001";
const PROBE = `${BASE}/demos/qa-operations`;

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(58)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

const POLL = { polling: 100, timeout: 20000 };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const res = await page.goto(PROBE, { waitUntil: "networkidle" }).catch(() => null);

if (!res || res.status() !== 200) {
  console.log("\n  SKIP  probe route absent: this suite is domain-only and needs it");
  console.log("\n=== stage 09C4.A core: SKIPPED (0 checks) ===");
  await browser.close();
  process.exit(0);
}

await page.waitForFunction(() => Boolean(window.__opsProbe), null, POLL);

const out = await page.evaluate(async () => {
  const P = window.__opsProbe;
  const ops = P.operations;

  /** A private world per scenario: memory adapter, no broadcast, no IndexedDB. */
  const fresh = async () => {
    const rt = P.createDemoRuntime({
      seed: P.buildOperationsSeed(),
      latency: "off",
      broadcast: false,
      adapter: P.createMemoryAdapter(),
    });
    await rt.initialize();
    return rt;
  };

  const code = async (fn) => {
    try {
      await fn();
      return "no-error";
    } catch (e) {
      return P.isDemoError(e) ? e.code : "unknown";
    }
  };

  const message = async (fn) => {
    try {
      await fn();
      return null;
    } catch (e) {
      return e && typeof e.message === "string" ? e.message : String(e);
    }
  };

  /**
   * The invariant, over the whole fleet.
   *
   * Every stored vehicle compared with `deriveVehicleStatus` and
   * `deriveVehicleLinks` over the world the last mutation left behind. Worth
   * more than asserting one expected status, because it catches the vehicle
   * nobody thought to look at.
   */
  const fleetDrift = async (rt) => {
    const [vehicles, contracts, reservations, workOrders] = await Promise.all([
      rt.repository.all("vehicles"),
      rt.repository.all("contracts"),
      rt.repository.all("reservations"),
      rt.repository.all("maintenance"),
    ]);
    const drift = [];
    for (const v of vehicles) {
      const world = { vehicleId: v.id, contracts, reservations, workOrders };
      const status = ops.derive.deriveVehicleStatus(world);
      const links = ops.derive.deriveVehicleLinks(world);
      const same =
        v.data.status === status &&
        v.data.currentContractId === links.currentContractId &&
        v.data.currentReservationId === links.currentReservationId &&
        v.data.activeMaintenanceId === links.activeMaintenanceId;
      if (!same) {
        drift.push(
          `${v.id} stored[${v.data.status},c=${v.data.currentContractId ?? "-"},r=${
            v.data.currentReservationId ?? "-"
          },m=${v.data.activeMaintenanceId ?? "-"}] derived[${status},c=${
            links.currentContractId ?? "-"
          },r=${links.currentReservationId ?? "-"},m=${links.activeMaintenanceId ?? "-"}]`
        );
      }
    }
    return drift;
  };

  const result = {};

  /* ===============================================================
     A. ASSET CODES

     The rule the stage authorised: system-generated, continuing from
     MTR-024, never reused, and read from what exists rather than from
     how many records there happen to be.
     =============================================================== */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");

    const seeded = await rt.repository.all("vehicles");
    const codes = seeded.map((v) => v.data.assetCode).sort();

    const first = await ops.vehicles.createVehicle(admin, {
      modelLabel: "Metro 125",
      vehicleClass: "Urban",
      odometerKm: 0,
    });
    const second = await ops.vehicles.createVehicle(admin, {
      modelLabel: "Cargo 150",
      vehicleClass: "Utility",
      odometerKm: 12,
    });
    const third = await ops.vehicles.createVehicle(admin, {
      modelLabel: "Tour 250",
      vehicleClass: "Touring",
      odometerKm: 999999,
    });

    const after = await rt.repository.all("vehicles");
    const allCodes = after.map((v) => v.data.assetCode);

    /* The pure function, exercised on worlds the seed cannot produce: a gap in
       the middle, a deletion at the top, and a differently padded twin. */
    const pure = ops.vehicles.nextAssetCode;
    const fake = (list) => list.map((assetCode) => ({ id: assetCode, data: { assetCode } }));

    result.assets = {
      seededHighest: codes[codes.length - 1],
      first: first.data.assetCode,
      second: second.data.assetCode,
      third: third.data.assetCode,
      unique: new Set(allCodes).size === allCodes.length,
      count: after.length,
      /* Derived state on a brand new vehicle: nothing points at it. */
      firstStatus: first.data.status,
      firstLinks: [
        first.data.currentContractId,
        first.data.currentReservationId,
        first.data.activeMaintenanceId,
      ].filter(Boolean).length,
      firstArea: first.data.serviceArea,
      emptyFleet: pure([]),
      gapKept: pure(fake(["MTR-001", "MTR-002", "MTR-009"])),
      /* A hole left by a deletion must not be refilled: the highest wins. */
      deletionSafe: pure(fake(["MTR-001", "MTR-024"])),
      /* A four-digit twin parses to the same number, so the guard has to look
         at what is taken rather than trusting highest + 1. */
      paddedTwin: pure(fake(["MTR-024", "MTR-0025"])),
      unparseable: pure(fake(["SPARE", "MTR-007"])),
      drift: await fleetDrift(rt),
    };
  }

  /* ===============================================================
     B. VEHICLE VALIDATION AND PERMISSION
     =============================================================== */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");
    const fleet = ops.contextAs(rt, "Fleet Coordinator");
    const sales = ops.contextAs(rt, "Sales Agent");
    const finance = ops.contextAs(rt, "Finance Analyst");

    const base = { modelLabel: "Metro 125", vehicleClass: "Urban", odometerKm: 100 };
    const vehicles = await rt.repository.all("vehicles");
    const target = vehicles[0];

    result.vehicleRules = {
      wrongClass: await code(() =>
        ops.vehicles.createVehicle(admin, { ...base, vehicleClass: "Touring" })
      ),
      wrongClassMessage: await message(() =>
        ops.vehicles.createVehicle(admin, { ...base, vehicleClass: "Touring" })
      ),
      negative: await code(() =>
        ops.vehicles.createVehicle(admin, { ...base, odometerKm: -1 })
      ),
      fractional: await code(() =>
        ops.vehicles.createVehicle(admin, { ...base, odometerKm: 10.5 })
      ),
      infinite: await code(() =>
        ops.vehicles.createVehicle(admin, { ...base, odometerKm: Number.POSITIVE_INFINITY })
      ),
      notANumber: await code(() =>
        ops.vehicles.createVehicle(admin, { ...base, odometerKm: Number.NaN })
      ),
      zero: await code(() => ops.vehicles.createVehicle(admin, { ...base, odometerKm: 0 })),
      fleetMayCreate: await code(() => ops.vehicles.createVehicle(fleet, base)),
      salesRefused: await code(() => ops.vehicles.createVehicle(sales, base)),
      financeRefused: await code(() => ops.vehicles.createVehicle(finance, base)),
      salesRefusedUpdate: await code(() => ops.vehicles.updateVehicle(sales, target.id, base)),
      unknownVehicle: await code(() =>
        ops.vehicles.updateVehicle(admin, "vehicle_9999", base)
      ),
    };

    /* An edit must not disturb the derived cache. MTR-001 is Rented in the
       canonical seed, so editing its odometer has to leave it Rented and
       still pointing at its contract. */
    const rented = vehicles.find((v) => v.data.status === "Rented");
    const edited = await ops.vehicles.updateVehicle(admin, rented.id, {
      modelLabel: rented.data.modelLabel,
      vehicleClass: rented.data.vehicleClass,
      odometerKm: rented.data.odometerKm + 640,
    });
    result.vehicleEdit = {
      odometer: edited.data.odometerKm,
      expected: rented.data.odometerKm + 640,
      assetCodeKept: edited.data.assetCode === rented.data.assetCode,
      statusKept: edited.data.status === "Rented",
      contractKept: edited.data.currentContractId === rented.data.currentContractId,
      version: edited.version,
      drift: await fleetDrift(rt),
    };

    /* Changing the class carries the model with it, and an incoherent pair is
       refused rather than quietly stored. */
    const spare = (await rt.repository.all("vehicles")).find(
      (v) => v.data.status === "Available" && v.data.vehicleClass === "Utility"
    );
    result.vehicleReclass = {
      coherent: await code(() =>
        ops.vehicles.updateVehicle(admin, spare.id, {
          modelLabel: "Tour 250",
          vehicleClass: "Touring",
          odometerKm: spare.data.odometerKm,
        })
      ),
      incoherent: await code(() =>
        ops.vehicles.updateVehicle(admin, spare.id, {
          modelLabel: "Cargo 150",
          vehicleClass: "Touring",
          odometerKm: spare.data.odometerKm,
        })
      ),
    };
  }

  /* ===============================================================
     C. RULE 05

     The assertion this batch's Maintenance module turns on. The bare
     service emits `maintenance.completed`; only the workflow wrapper
     has a subscriber, so only the wrapper produces the notification.
     =============================================================== */
  {
    /* The bare service, for the contrast. */
    const bare = await fresh();
    const bareAdmin = ops.contextAs(bare, "Admin");
    const bareOrder = (await bare.repository.all("maintenance")).find(
      (w) => w.data.status === "In Progress"
    );
    const bareRunsBefore = (await bare.repository.all("automation_runs")).length;
    const bareNotesBefore = (await bare.repository.all("notifications")).length;
    await ops.maintenance.completeMaintenance(bareAdmin, bareOrder.id);
    const bareRunsAfter = (await bare.repository.all("automation_runs")).length;
    const bareNotesAfter = (await bare.repository.all("notifications")).length;

    /* The workflow, which is what the screen calls. */
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");
    const order = (await rt.repository.all("maintenance")).find(
      (w) => w.data.status === "In Progress"
    );
    const runsBefore = (await rt.repository.all("automation_runs")).length;
    const notesBefore = (await rt.repository.all("notifications")).length;

    const done = await ops.maintenanceWorkflows.completeMaintenanceWorkflow(admin, order.id);

    const runs = await rt.repository.all("automation_runs");
    const notes = await rt.repository.all("notifications");
    const last = runs[runs.length - 1];
    const note = notes[notes.length - 1];
    const vehicle = await rt.repository.get("vehicles", order.data.vehicleId);

    result.rule05 = {
      bareRunDelta: bareRunsAfter - bareRunsBefore,
      bareNoteDelta: bareNotesAfter - bareNotesBefore,
      workOrderId: order.id,
      status: done.result.data.status,
      completedAt: Boolean(done.result.data.completedAt),
      runDelta: runs.length - runsBefore,
      noteDelta: notes.length - notesBefore,
      ruleId: last.data.ruleId,
      runStatus: last.data.status,
      outcomes: done.outcomes.length,
      outcomeRule: done.outcomes[0]?.ruleId ?? null,
      outcomeStatus: done.outcomes[0]?.status ?? null,
      noteCategory: note.data.category,
      noteTitle: note.data.title,
      noteRole: note.data.actorRole,
      noteSourceType: note.data.sourceEntityType,
      noteSourceId: note.data.sourceEntityId,
      /* The workshop released the vehicle, so it is no longer Maintenance. */
      vehicleStatus: vehicle.data.status,
      vehicleWorkOrder: vehicle.data.activeMaintenanceId ?? null,
      drift: await fleetDrift(rt),
    };
  }

  /* ===============================================================
     D. THE ACTIVE-RENTAL CONFLICT

     Preserved exactly as 09C4.0 documented it. Opening a work order on
     a rented vehicle is allowed and makes the vehicle read Maintenance;
     starting the work is refused while the contract is active. The
     tension is frozen and this suite asserts it rather than resolving
     it.
     =============================================================== */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");
    const contracts = await rt.repository.all("contracts");
    const active = contracts.find((c) => c.data.status === "Active");
    const vehicleId = active.data.vehicleId;

    const opened = await ops.maintenanceWorkflows.createMaintenanceWorkflow(admin, {
      vehicleId,
      type: "Inspection",
      priority: "Routine",
      summary: "QA: opened while the vehicle is out",
    });
    const afterOpen = await rt.repository.get("vehicles", vehicleId);

    result.conflict = {
      opened: opened.result.data.status,
      vehicleAfterOpen: afterOpen.data.status,
      pointsAtWorkOrder: afterOpen.data.activeMaintenanceId === opened.result.id,
      /* The contract pointer is still there, and that is the frozen design.
         Only `status` is a precedence; `deriveVehicleLinks` sets all three
         pointers independently, so a rented vehicle with an open work order
         carries both, reads Maintenance, and tells the whole truth about
         itself rather than dropping half of it. */
      contractPointer: afterOpen.data.currentContractId ?? null,
      contractPointerIsTheActiveOne: afterOpen.data.currentContractId === active.id,
      contractStillActive:
        (await rt.repository.get("contracts", active.id)).data.status === "Active",
      startRefused: await code(() =>
        ops.maintenanceWorkflows.startMaintenanceWorkflow(admin, opened.result.id)
      ),
      startMessage: await message(() =>
        ops.maintenanceWorkflows.startMaintenanceWorkflow(admin, opened.result.id)
      ),
      drift: await fleetDrift(rt),
    };
  }

  /* ===============================================================
     E. THE END-TO-END CORE SEQUENCE

     One booking, walked the whole way. Every step asserts the four
     records that should have moved and the fleet invariant over the
     world it left behind.
     =============================================================== */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");
    const steps = [];

    const snapshot = async (label, extra) => {
      steps.push({ label, drift: (await fleetDrift(rt)).length, ...extra });
    };

    const customers = await rt.repository.all("customers");
    const vehiclesAtStart = await rt.repository.all("vehicles");
    /* A Utility vehicle: the class with the most spare capacity in the seed,
       so the sequence never fails for want of a free machine. */
    const free = vehiclesAtStart.find(
      (v) => v.data.status === "Available" && v.data.vehicleClass === "Utility"
    );
    const start = rt.now();
    const end = new Date(Date.parse(start) + 4 * 86400000).toISOString();

    // 1. Draft
    const draft = await ops.reservations.createReservation(admin, {
      customerId: customers[0].id,
      vehicleClass: "Utility",
      startAt: start,
      endAt: end,
      notes: "QA: the core sequence",
    });
    await snapshot("draft", {
      status: draft.data.status,
      vehicle: draft.data.vehicleId ?? null,
    });

    // 2. Confirm, which holds the vehicle and wakes Rule 03
    const confirmed = await ops.reservationWorkflows.confirmReservationWorkflow(
      admin,
      draft.id,
      free.id
    );
    const afterConfirm = await rt.repository.get("vehicles", free.id);
    await snapshot("confirmed", {
      status: confirmed.result.data.status,
      vehicleStatus: afterConfirm.data.status,
      vehiclePointsAtReservation: afterConfirm.data.currentReservationId === draft.id,
      rule03: confirmed.outcomes.map((o) => o.ruleId).join(","),
    });

    // 3. Convert to a Pending contract
    const converted = await ops.reservationWorkflows.convertReservationWorkflow(admin, draft.id);
    const contractId = converted.result.contract.id;
    const afterConvert = await rt.repository.get("vehicles", free.id);
    await snapshot("converted", {
      reservationStatus: (await rt.repository.get("reservations", draft.id)).data.status,
      contractStatus: converted.result.contract.data.status,
      contractVehicle: converted.result.contract.data.vehicleId === free.id,
      contractReservation: converted.result.contract.data.reservationId === draft.id,
      /* Available, and deliberately so. Converting ends the reservation's
         hold, and a Pending contract does not take one: capacity is held by
         activation, the same way it is held by confirmation and not by a
         draft. The vehicle is free until someone starts the rental. */
      vehicleStatus: afterConvert.data.status,
    });

    // 4. Activate, which is when the vehicle actually goes out
    const activated = await ops.contractWorkflows.activateContractWorkflow(admin, contractId);
    const afterActivate = await rt.repository.get("vehicles", free.id);
    await snapshot("activated", {
      contractStatus: activated.result.data.status,
      vehicleStatus: afterActivate.data.status,
      vehiclePointsAtContract: afterActivate.data.currentContractId === contractId,
      /* The reservation is Converted, so it no longer holds the vehicle. */
      reservationPointer: afterActivate.data.currentReservationId ?? null,
    });

    // 5. The rental is running, so the workshop is refused
    const refusedMidRental = await code(() =>
      ops.maintenanceWorkflows.createMaintenanceWorkflow(admin, {
        vehicleId: free.id,
        type: "Repair",
        priority: "Soon",
        summary: "QA: should be allowed to open",
      }).then((r) => ops.maintenanceWorkflows.startMaintenanceWorkflow(admin, r.result.id))
    );
    /* Opening was legal, so undo it before continuing: the sequence is about
       the happy path and an open order would outrank everything after it. */
    const strayOrder = (await rt.repository.all("maintenance")).find(
      (w) => w.data.summary === "QA: should be allowed to open"
    );
    await ops.maintenanceWorkflows.cancelMaintenanceWorkflow(admin, strayOrder.id);
    await snapshot("workshop refused mid-rental", {
      startRefused: refusedMidRental,
      vehicleStatus: (await rt.repository.get("vehicles", free.id)).data.status,
    });

    // 6. Complete the contract and get the vehicle back
    const completed = await ops.contractWorkflows.completeContractWorkflow(admin, contractId);
    const afterComplete = await rt.repository.get("vehicles", free.id);
    await snapshot("contract completed", {
      contractStatus: completed.result.data.status,
      vehicleStatus: afterComplete.data.status,
      contractPointer: afterComplete.data.currentContractId ?? null,
    });

    // 7. Open a work order on the returned vehicle
    const work = await ops.maintenanceWorkflows.createMaintenanceWorkflow(admin, {
      vehicleId: free.id,
      type: "Preventive",
      priority: "Routine",
      summary: "QA: service after the rental",
    });
    const afterOpen = await rt.repository.get("vehicles", free.id);
    await snapshot("work order opened", {
      workStatus: work.result.data.status,
      vehicleStatus: afterOpen.data.status,
      vehiclePointsAtWork: afterOpen.data.activeMaintenanceId === work.result.id,
    });

    // 8. Start it
    const started = await ops.maintenanceWorkflows.startMaintenanceWorkflow(admin, work.result.id);
    await snapshot("work started", {
      workStatus: started.result.data.status,
      startedAt: Boolean(started.result.data.startedAt),
      vehicleStatus: (await rt.repository.get("vehicles", free.id)).data.status,
    });

    // 9. Complete it, which raises the fleet notification
    const notesBefore = (await rt.repository.all("notifications")).length;
    const finished = await ops.maintenanceWorkflows.completeMaintenanceWorkflow(
      admin,
      work.result.id
    );
    const afterFinish = await rt.repository.get("vehicles", free.id);
    const notesAfter = await rt.repository.all("notifications");
    await snapshot("work completed", {
      workStatus: finished.result.data.status,
      vehicleStatus: afterFinish.data.status,
      workPointer: afterFinish.data.activeMaintenanceId ?? null,
      noteDelta: notesAfter.length - notesBefore,
      noteCategory: notesAfter[notesAfter.length - 1].data.category,
      rule: finished.outcomes[0]?.ruleId ?? null,
    });

    const audit = await rt.listAudit();
    result.sequence = {
      steps,
      contractId,
      reservationId: draft.id,
      workOrderId: work.result.id,
      vehicleId: free.id,
      /* Every step wrote its own audit line, in order and about the right
         records. Counted rather than quoted, because the summaries are the
         services' own words and this suite does not own them. */
      auditForContract: audit.filter(
        (e) => e.collection === "contracts" && e.entityId === contractId
      ).length,
      auditForWork: audit.filter(
        (e) => e.collection === "maintenance" && e.entityId === work.result.id
      ).length,
      auditForReservation: audit.filter(
        (e) => e.collection === "reservations" && e.entityId === draft.id
      ).length,
      finalDrift: await fleetDrift(rt),
    };
  }

  /* ===============================================================
     F. CONTRACT TRANSITIONS, STATED
     =============================================================== */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");
    const sales = ops.contextAs(rt, "Sales Agent");
    const fleet = ops.contextAs(rt, "Fleet Coordinator");
    const finance = ops.contextAs(rt, "Finance Analyst");
    const contracts = await rt.repository.all("contracts");

    const pending = contracts.find((c) => c.data.status === "Pending");
    const active = contracts.find((c) => c.data.status === "Active");
    const completed = contracts.find((c) => c.data.status === "Completed");
    const cancelled = contracts.find((c) => c.data.status === "Cancelled");

    result.contractRules = {
      completePending: await code(() =>
        ops.contractWorkflows.completeContractWorkflow(admin, pending.id)
      ),
      activateActive: await code(() =>
        ops.contractWorkflows.activateContractWorkflow(admin, active.id)
      ),
      cancelCompleted: await code(() =>
        ops.contractWorkflows.cancelContractWorkflow(admin, completed.id)
      ),
      cancelCancelled: await code(() =>
        ops.contractWorkflows.cancelContractWorkflow(admin, cancelled.id)
      ),
      cancelActive: await code(() =>
        ops.contractWorkflows.cancelContractWorkflow(admin, active.id)
      ),
      /* Only Admin writes contracts; the other three read them. */
      salesRefused: await code(() =>
        ops.contractWorkflows.activateContractWorkflow(sales, pending.id)
      ),
      fleetRefused: await code(() =>
        ops.contractWorkflows.activateContractWorkflow(fleet, pending.id)
      ),
      financeRefused: await code(() =>
        ops.contractWorkflows.activateContractWorkflow(finance, pending.id)
      ),
      drift: await fleetDrift(rt),
    };
  }

  /* ===============================================================
     G. MAINTENANCE PERMISSION
     =============================================================== */
  {
    const rt = await fresh();
    const fleet = ops.contextAs(rt, "Fleet Coordinator");
    const sales = ops.contextAs(rt, "Sales Agent");
    const finance = ops.contextAs(rt, "Finance Analyst");
    const spare = (await rt.repository.all("vehicles")).find(
      (v) => v.data.status === "Available"
    );
    const input = {
      vehicleId: spare.id,
      type: "Inspection",
      priority: "Routine",
      summary: "QA: permission",
    };

    result.maintenanceRules = {
      fleetMay: await code(() =>
        ops.maintenanceWorkflows.createMaintenanceWorkflow(fleet, input)
      ),
      salesRefused: await code(() =>
        ops.maintenanceWorkflows.createMaintenanceWorkflow(sales, input)
      ),
      financeRefused: await code(() =>
        ops.maintenanceWorkflows.createMaintenanceWorkflow(finance, input)
      ),
      emptySummary: await code(() =>
        ops.maintenanceWorkflows.createMaintenanceWorkflow(fleet, { ...input, summary: "   " })
      ),
      unknownVehicle: await code(() =>
        ops.maintenanceWorkflows.createMaintenanceWorkflow(fleet, {
          ...input,
          vehicleId: "vehicle_9999",
        })
      ),
    };
  }

  /* ===============================================================
     H. THE SELECTORS THREE SCREENS READ THROUGH
     =============================================================== */
  {
    const rt = await fresh();
    const [vehicles, contracts, reservations, workOrders, customers] = await Promise.all([
      rt.repository.all("vehicles"),
      rt.repository.all("contracts"),
      rt.repository.all("reservations"),
      rt.repository.all("maintenance"),
      rt.repository.all("customers"),
    ]);

    const contractRows = ops.contractsList.buildContractRows({ contracts, customers, vehicles });
    const fleetRows = ops.fleetList.buildFleetRows({
      vehicles,
      contracts,
      reservations,
      workOrders,
      customers,
    });
    const workRows = ops.maintenanceList.buildMaintenanceRows({ workOrders, vehicles });

    const money = contractRows.find((r) => r.totalAmount > 0);

    result.selectors = {
      contracts: contractRows.length,
      contractsWithCustomer: contractRows.filter((r) => r.customerName !== "Unknown customer")
        .length,
      contractsWithVehicle: contractRows.filter((r) => r.vehicleLabel !== null).length,
      balanceIsSubtraction: money.remainingBalance === money.totalAmount - money.paidAmount,
      contractTally: ops.contractsList.contractStatusTally(contractRows),

      fleet: fleetRows.length,
      fleetTally: ops.fleetList.fleetStatusTally(fleetRows),
      /* A vehicle with a pointer has a sentence; a free one has none. */
      assignedHaveWords: fleetRows
        .filter((r) => r.status !== "Available")
        .every((r) => typeof r.assignment === "string" && r.assignment.length > 0),
      availableHaveNone: fleetRows
        .filter((r) => r.status === "Available")
        .every((r) => r.assignment === null),
      odometerFormat: ops.fleetList.formatOdometer(11491),

      work: workRows.length,
      workWithVehicle: workRows.filter((r) => r.vehicleLabel !== null).length,
      workTally: ops.maintenanceList.maintenanceStatusTally(workRows),

      /* Paging and search, exercised once each rather than exhaustively: the
         UI suites drive these through the product. */
      contractPage: ops.contractsList.selectContractList(contractRows, {
        ...ops.contractsList.DEFAULT_CONTRACT_QUERY,
      }),
      fleetSearch: ops.fleetList.selectFleetList(fleetRows, {
        ...ops.fleetList.DEFAULT_FLEET_QUERY,
        search: "MTR-024",
      }).total,
      workSearch: ops.maintenanceList.selectMaintenanceList(workRows, {
        ...ops.maintenanceList.DEFAULT_MAINTENANCE_QUERY,
        search: "MTR-012",
      }).total,
    };
  }

  return result;
});

/* =====================================================================
   REPORT
   ===================================================================== */

section("ASSET CODES");
check("the canonical seed ends at MTR-024", out.assets.seededHighest === "MTR-024", out.assets.seededHighest);
check("the first created vehicle is MTR-025", out.assets.first === "MTR-025", out.assets.first);
check("the second is MTR-026", out.assets.second === "MTR-026", out.assets.second);
check("the third is MTR-027", out.assets.third === "MTR-027", out.assets.third);
check("every code in the fleet is unique", out.assets.unique);
check("the fleet grew to 27", out.assets.count === 27, String(out.assets.count));
check("a new vehicle is Available", out.assets.firstStatus === "Available", out.assets.firstStatus);
check("and holds nothing", out.assets.firstLinks === 0, String(out.assets.firstLinks));
check("it joins a service area", Boolean(out.assets.firstArea), out.assets.firstArea);
check("an empty fleet starts at MTR-001", out.assets.emptyFleet === "MTR-001", out.assets.emptyFleet);
check("a gap in the middle is not backfilled", out.assets.gapKept === "MTR-010", out.assets.gapKept);
check("a deleted top record does not free its code", out.assets.deletionSafe === "MTR-025", out.assets.deletionSafe);
check("a differently padded twin is not collided with", out.assets.paddedTwin === "MTR-026", out.assets.paddedTwin);
check("an unparseable code is ignored, not crashed on", out.assets.unparseable === "MTR-008", out.assets.unparseable);
check("creating vehicles leaves the fleet coherent", out.assets.drift.length === 0, out.assets.drift[0] ?? "");

section("VEHICLE RULES");
check("a model outside its class is refused", out.vehicleRules.wrongClass === "VALIDATION", out.vehicleRules.wrongClass);
check("and the refusal names the class", /Touring/.test(out.vehicleRules.wrongClassMessage ?? ""), out.vehicleRules.wrongClassMessage ?? "");
check("a negative odometer is refused", out.vehicleRules.negative === "VALIDATION", out.vehicleRules.negative);
check("a fractional odometer is refused", out.vehicleRules.fractional === "VALIDATION", out.vehicleRules.fractional);
check("an infinite odometer is refused", out.vehicleRules.infinite === "VALIDATION", out.vehicleRules.infinite);
check("NaN is refused", out.vehicleRules.notANumber === "VALIDATION", out.vehicleRules.notANumber);
check("zero is accepted", out.vehicleRules.zero === "no-error", out.vehicleRules.zero);
check("the Fleet Coordinator may create", out.vehicleRules.fleetMayCreate === "no-error", out.vehicleRules.fleetMayCreate);
check("Sales may not", out.vehicleRules.salesRefused === "FORBIDDEN", out.vehicleRules.salesRefused);
check("Finance may not", out.vehicleRules.financeRefused === "FORBIDDEN", out.vehicleRules.financeRefused);
check("nor may Sales edit", out.vehicleRules.salesRefusedUpdate === "FORBIDDEN", out.vehicleRules.salesRefusedUpdate);
check("an unknown vehicle is NOT_FOUND", out.vehicleRules.unknownVehicle === "NOT_FOUND", out.vehicleRules.unknownVehicle);

section("EDITING A VEHICLE");
check("the odometer moves", out.vehicleEdit.odometer === out.vehicleEdit.expected, `${out.vehicleEdit.odometer} vs ${out.vehicleEdit.expected}`);
check("the asset code does not", out.vehicleEdit.assetCodeKept);
check("a rented vehicle stays Rented", out.vehicleEdit.statusKept);
check("and keeps its contract pointer", out.vehicleEdit.contractKept);
check("the record version advances", out.vehicleEdit.version >= 2, String(out.vehicleEdit.version));
check("the edit leaves the fleet coherent", out.vehicleEdit.drift.length === 0, out.vehicleEdit.drift[0] ?? "");
check("a class change with a matching model is accepted", out.vehicleReclass.coherent === "no-error", out.vehicleReclass.coherent);
check("and one with a mismatched model is refused", out.vehicleReclass.incoherent === "VALIDATION", out.vehicleReclass.incoherent);

section("RULE 05 - MAINTENANCE COMPLETION");
check("the bare service wakes no rule", out.rule05.bareRunDelta === 0, String(out.rule05.bareRunDelta));
check("and writes no notification", out.rule05.bareNoteDelta === 0, String(out.rule05.bareNoteDelta));
check("the workflow completes the work order", out.rule05.status === "Completed", out.rule05.status);
check("and stamps when", out.rule05.completedAt);
check("one AutomationRun is written", out.rule05.runDelta === 1, String(out.rule05.runDelta));
check("it is Rule 05", out.rule05.ruleId === "automation_rule_0005", out.rule05.ruleId);
check("and it succeeded", out.rule05.runStatus === "Success", out.rule05.runStatus);
check("the workflow reports the outcome", out.rule05.outcomes === 1, String(out.rule05.outcomes));
check("naming the same rule", out.rule05.outcomeRule === "automation_rule_0005", String(out.rule05.outcomeRule));
check("one notification is raised", out.rule05.noteDelta === 1, String(out.rule05.noteDelta));
check("in the Maintenance category", out.rule05.noteCategory === "Maintenance", out.rule05.noteCategory);
check("addressed to the Fleet Coordinator", out.rule05.noteRole === "Fleet Coordinator", String(out.rule05.noteRole));
check("and pointing at the work order", out.rule05.noteSourceId === out.rule05.workOrderId, `${out.rule05.noteSourceId} vs ${out.rule05.workOrderId}`);
check("the vehicle leaves the workshop", out.rule05.vehicleStatus !== "Maintenance", out.rule05.vehicleStatus);
check("and drops its work order pointer", out.rule05.vehicleWorkOrder === null, String(out.rule05.vehicleWorkOrder));
check("completion leaves the fleet coherent", out.rule05.drift.length === 0, out.rule05.drift[0] ?? "");

section("THE ACTIVE-RENTAL TENSION, PRESERVED");
check("a work order may be opened on a rented vehicle", out.conflict.opened === "Open", out.conflict.opened);
check("and the vehicle reads Maintenance", out.conflict.vehicleAfterOpen === "Maintenance", out.conflict.vehicleAfterOpen);
check("pointing at the new work order", out.conflict.pointsAtWorkOrder);
check("while still naming its contract", out.conflict.contractPointerIsTheActiveOne, String(out.conflict.contractPointer));
check("while the contract itself stays Active", out.conflict.contractStillActive);
check("starting the work is refused", out.conflict.startRefused === "CONFLICT", out.conflict.startRefused);
check("and the refusal says why", /active rental/.test(out.conflict.startMessage ?? ""), out.conflict.startMessage ?? "");
check("the contradiction leaves no drift", out.conflict.drift.length === 0, out.conflict.drift[0] ?? "");

section("THE CORE SEQUENCE, END TO END");
{
  const s = Object.fromEntries(out.sequence.steps.map((step) => [step.label, step]));
  check("1 a draft holds no vehicle", s.draft.status === "Draft" && s.draft.vehicle === null, JSON.stringify(s.draft));
  check("2 confirming holds one", s.confirmed.status === "Confirmed" && s.confirmed.vehicleStatus === "Reserved", JSON.stringify(s.confirmed));
  check("  and wakes Rule 03", s.confirmed.rule03 === "automation_rule_0003", s.confirmed.rule03);
  check("3 converting creates a Pending contract", s.converted.contractStatus === "Pending", s.converted.contractStatus);
  check("  on the same vehicle", s.converted.contractVehicle);
  check("  naming the reservation", s.converted.contractReservation);
  check("  and a pending contract holds no vehicle", s.converted.vehicleStatus === "Available", s.converted.vehicleStatus);
  check("4 activating starts it", s.activated.contractStatus === "Active" && s.activated.vehicleStatus === "Rented", JSON.stringify(s.activated));
  check("  the vehicle points at the contract", s.activated.vehiclePointsAtContract);
  check("  and no longer at the reservation", s.activated.reservationPointer === null, String(s.activated.reservationPointer));
  check("5 the workshop is refused mid-rental", s["workshop refused mid-rental"].startRefused === "CONFLICT", s["workshop refused mid-rental"].startRefused);
  check("6 completing returns the vehicle", s["contract completed"].contractStatus === "Completed" && s["contract completed"].vehicleStatus === "Available", JSON.stringify(s["contract completed"]));
  check("  and clears the contract pointer", s["contract completed"].contractPointer === null, String(s["contract completed"].contractPointer));
  check("7 a work order takes it out of service", s["work order opened"].vehicleStatus === "Maintenance", s["work order opened"].vehicleStatus);
  check("8 starting stamps it", s["work started"].workStatus === "In Progress" && s["work started"].startedAt, JSON.stringify(s["work started"]));
  check("9 completing frees it", s["work completed"].workStatus === "Completed" && s["work completed"].vehicleStatus === "Available", JSON.stringify(s["work completed"]));
  check("  and raises the fleet notification", s["work completed"].noteDelta === 1 && s["work completed"].noteCategory === "Maintenance", JSON.stringify(s["work completed"]));
  check("  through Rule 05", s["work completed"].rule === "automation_rule_0005", String(s["work completed"].rule));

  const drifted = out.sequence.steps.filter((step) => step.drift > 0).map((step) => step.label);
  check("no step left the fleet incoherent", drifted.length === 0, drifted.join(", "));
  check("the contract was audited at every move", out.sequence.auditForContract >= 2, String(out.sequence.auditForContract));
  check("and so was the work order", out.sequence.auditForWork >= 2, String(out.sequence.auditForWork));
  check("and the reservation", out.sequence.auditForReservation >= 2, String(out.sequence.auditForReservation));
  check("the world ends coherent", out.sequence.finalDrift.length === 0, out.sequence.finalDrift[0] ?? "");
}

section("CONTRACT TRANSITIONS");
check("a pending contract cannot be completed", out.contractRules.completePending === "CONFLICT", out.contractRules.completePending);
check("an active one cannot be activated again", out.contractRules.activateActive === "CONFLICT", out.contractRules.activateActive);
check("a completed one cannot be cancelled", out.contractRules.cancelCompleted === "CONFLICT", out.contractRules.cancelCompleted);
check("nor a cancelled one", out.contractRules.cancelCancelled === "CONFLICT", out.contractRules.cancelCancelled);
check("an active one can be", out.contractRules.cancelActive === "no-error", out.contractRules.cancelActive);
check("Sales cannot move a contract", out.contractRules.salesRefused === "FORBIDDEN", out.contractRules.salesRefused);
check("nor can the Fleet Coordinator", out.contractRules.fleetRefused === "FORBIDDEN", out.contractRules.fleetRefused);
check("nor Finance", out.contractRules.financeRefused === "FORBIDDEN", out.contractRules.financeRefused);
check("and none of it drifted the fleet", out.contractRules.drift.length === 0, out.contractRules.drift[0] ?? "");

section("MAINTENANCE PERMISSION");
check("the Fleet Coordinator may open work", out.maintenanceRules.fleetMay === "no-error", out.maintenanceRules.fleetMay);
check("Sales may not", out.maintenanceRules.salesRefused === "FORBIDDEN", out.maintenanceRules.salesRefused);
check("Finance may not", out.maintenanceRules.financeRefused === "FORBIDDEN", out.maintenanceRules.financeRefused);
check("a blank summary is refused", out.maintenanceRules.emptySummary === "VALIDATION", out.maintenanceRules.emptySummary);
check("an unknown vehicle is NOT_FOUND", out.maintenanceRules.unknownVehicle === "NOT_FOUND", out.maintenanceRules.unknownVehicle);

section("SELECTORS");
check("14 contract rows", out.selectors.contracts === 14, String(out.selectors.contracts));
check("every one resolves its customer", out.selectors.contractsWithCustomer === 14, String(out.selectors.contractsWithCustomer));
check("and its vehicle", out.selectors.contractsWithVehicle === 14, String(out.selectors.contractsWithVehicle));
check("the balance is the domain's subtraction", out.selectors.balanceIsSubtraction);
check("the contract tally matches the seed", JSON.stringify(out.selectors.contractTally) === JSON.stringify({ Active: 7, Completed: 3, Pending: 3, Cancelled: 1 }), JSON.stringify(out.selectors.contractTally));
check("24 fleet rows", out.selectors.fleet === 24, String(out.selectors.fleet));
check("the fleet tally matches the seed", JSON.stringify(out.selectors.fleetTally) === JSON.stringify({ Rented: 7, Reserved: 4, Maintenance: 3, Available: 10 }), JSON.stringify(out.selectors.fleetTally));
check("an occupied vehicle says why", out.selectors.assignedHaveWords);
check("and a free one says nothing", out.selectors.availableHaveNone);
check("the odometer is grouped and suffixed", out.selectors.odometerFormat === "11,491 km", out.selectors.odometerFormat);
check("10 work order rows", out.selectors.work === 10, String(out.selectors.work));
check("every one resolves its vehicle", out.selectors.workWithVehicle === 10, String(out.selectors.workWithVehicle));
check("the work tally matches the seed", JSON.stringify(out.selectors.workTally) === JSON.stringify({ Open: 2, "In Progress": 1, Completed: 6, Cancelled: 1 }), JSON.stringify(out.selectors.workTally));
check("contracts page at ten", out.selectors.contractPage.pageSize === 10 && out.selectors.contractPage.items.length === 10 && out.selectors.contractPage.pageCount === 2, JSON.stringify({ p: out.selectors.contractPage.pageSize, n: out.selectors.contractPage.items.length, c: out.selectors.contractPage.pageCount }));
check("an asset code finds exactly one vehicle", out.selectors.fleetSearch === 1, String(out.selectors.fleetSearch));
check("and a vehicle's code finds its work orders", out.selectors.workSearch >= 1, String(out.selectors.workSearch));

await browser.close();

console.log(
  `\n=== stage 09C4.A core: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
