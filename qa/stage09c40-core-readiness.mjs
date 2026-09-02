/**
 * Stage 09C4.0 - Rental Operations core readiness QA.
 *
 * Domain only. There is no Reservations, Contracts, Fleet, Maintenance or
 * Payments screen yet, and this suite does not want one: its whole purpose is
 * to establish that the contract those five screens will depend on actually
 * holds before any of them is written.
 *
 * The central assertion is a world invariant rather than a string comparison.
 * After every mutation, every vehicle in the store is compared against
 * `deriveVehicleStatus` and `deriveVehicleLinks` computed over the world that
 * mutation left behind. A stored vehicle that disagrees with its own
 * derivation is the failure mode the frozen contract exists to prevent, and it
 * is worth far more than asserting one expected status string, because it
 * catches the vehicle nobody thought to look at.
 *
 * Needs the domain probe route:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run build
 *   npx next start --hostname 127.0.0.1 --port 3001
 *   node qa/stage09c40-core-readiness.mjs
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
  console.log("\n=== stage 09C4.0 readiness: SKIPPED (0 checks) ===");
  await browser.close();
  process.exit(0);
}

await page.waitForFunction(() => Boolean(window.__opsProbe), null, POLL);

/**
 * Everything runs inside one page.evaluate.
 *
 * The domain is browser code and the runtime persists to a real IndexedDB or a
 * real memory adapter, so driving it from Node would be testing a different
 * thing. Each scenario builds its own runtime from the canonical seed.
 */
const out = await page.evaluate(async () => {
  const P = window.__opsProbe;
  const ops = P.operations;

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

  /**
   * The invariant, over the whole fleet.
   *
   * Returns the vehicles whose stored status or pointers disagree with what
   * derivation says about the current world, so a failure names the vehicle
   * and both sides rather than just saying "false".
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
      const stored = {
        status: v.data.status,
        currentContractId: v.data.currentContractId,
        currentReservationId: v.data.currentReservationId,
        activeMaintenanceId: v.data.activeMaintenanceId,
      };
      const expected = {
        status,
        currentContractId: links.currentContractId,
        currentReservationId: links.currentReservationId,
        activeMaintenanceId: links.activeMaintenanceId,
      };
      const same =
        stored.status === expected.status &&
        stored.currentContractId === expected.currentContractId &&
        stored.currentReservationId === expected.currentReservationId &&
        stored.activeMaintenanceId === expected.activeMaintenanceId;
      if (!same) {
        drift.push(
          `${v.id} stored[${stored.status},c=${stored.currentContractId ?? "-"},r=${
            stored.currentReservationId ?? "-"
          },m=${stored.activeMaintenanceId ?? "-"}] derived[${expected.status},c=${
            expected.currentContractId ?? "-"
          },r=${expected.currentReservationId ?? "-"},m=${expected.activeMaintenanceId ?? "-"}]`
        );
      }
    }
    return drift;
  };

  const result = {};

  /* ---------------------------------------------------------------
     A. The seed already satisfies the invariant.
     --------------------------------------------------------------- */
  {
    const rt = await fresh();
    result.seedDrift = await fleetDrift(rt);
  }

  /* ---------------------------------------------------------------
     B. Rule 03 through the production workflow, with no manual join.
     --------------------------------------------------------------- */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");

    const reservations = await rt.repository.all("reservations");
    const vehicles = await rt.repository.all("vehicles");
    const conversations = await rt.repository.all("conversations");
    const draft = reservations.find(
      (r) =>
        r.data.status === "Draft" &&
        vehicles.some(
          (v) => v.data.status === "Available" && v.data.vehicleClass === r.data.vehicleClass
        ) &&
        conversations.some(
          (c) => c.data.subjectType === "Customer" && c.data.subjectId === r.data.customerId
        )
    );
    const free = vehicles.find(
      (v) => v.data.status === "Available" && v.data.vehicleClass === draft.data.vehicleClass
    );
    const thread = conversations.find(
      (c) => c.data.subjectType === "Customer" && c.data.subjectId === draft.data.customerId
    );

    const messagesBefore = (await rt.repository.all("messages")).filter(
      (m) => m.data.conversationId === thread.id
    ).length;
    const runsBefore = (await rt.repository.all("automation_runs")).length;

    /* The whole point: one call, no processEvents, no manual subscription. */
    const wf = await ops.reservationWorkflows.confirmReservationWorkflow(
      admin,
      draft.id,
      free.id
    );

    const messagesAfter = (await rt.repository.all("messages")).filter(
      (m) => m.data.conversationId === thread.id
    );
    const system = messagesAfter.filter((m) => m.data.authorType === "System");
    const touched = await rt.repository.get("conversations", thread.id);
    const runs = await rt.repository.all("automation_runs");

    result.rule03 = {
      outcome: wf.outcomes.find((o) => o.ruleId === "automation_rule_0003")?.status ?? "none",
      outcomeCount: wf.outcomes.length,
      reservationStatus: wf.result.data.status,
      messagesAdded: messagesAfter.length - messagesBefore,
      systemCount: system.length,
      systemBody: system.length ? system[system.length - 1].data.body : "",
      unread: touched.data.unread,
      runsAdded: runs.length - runsBefore,
      drift: await fleetDrift(rt),
    };

    /* And the bare service still wakes nothing, which is what makes the
       workflow layer the thing that closed the gap rather than a coincidence. */
    const rt2 = await fresh();
    const admin2 = ops.contextAs(rt2, "Admin");
    const r2 = (await rt2.repository.all("reservations")).find((r) => r.id === draft.id);
    const runsBefore2 = (await rt2.repository.all("automation_runs")).length;
    await ops.reservations.confirmReservation(admin2, r2.id, free.id);
    result.bareServiceRuns =
      (await rt2.repository.all("automation_runs")).length - runsBefore2;
  }

  /* ---------------------------------------------------------------
     C. Lead automation is unchanged by the workflow extraction.
     --------------------------------------------------------------- */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");

    const web = await ops.leadWorkflows.createLeadWorkflow(admin, {
      displayName: "QA Website Lead",
      source: "Website",
      vehicleInterest: "Urban",
      priority: "Normal",
    });
    const webLead = await rt.repository.get("leads", web.result.id);

    const ref = await ops.leadWorkflows.createLeadWorkflow(admin, {
      displayName: "QA Referral Lead",
      source: "Referral",
      vehicleInterest: "Touring",
      priority: "Normal",
    });
    const refLead = await rt.repository.get("leads", ref.result.id);

    await ops.leadWorkflows.changeLeadStageWorkflow(admin, ref.result.id, "Contacted");
    const qualified = await ops.leadWorkflows.changeLeadStageWorkflow(
      admin,
      ref.result.id,
      "Qualified"
    );
    const qualifiedLead = await rt.repository.get("leads", ref.result.id);

    result.leadRules = {
      rule01Status: web.outcomes.find((o) => o.ruleId === "automation_rule_0001")?.status ?? "none",
      websiteAssigned: Boolean(webLead.data.assignedActorId),
      referralUnassigned: refLead.data.assignedActorId,
      rule02Status:
        qualified.outcomes.find((o) => o.ruleId === "automation_rule_0002")?.status ?? "none",
      followUpSet: Boolean(qualifiedLead.data.nextFollowUpAt),
    };
  }

  /* ---------------------------------------------------------------
     D. The integrated rental sequence, invariant checked at each step.
     --------------------------------------------------------------- */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");
    const steps = [];
    const at = async (label) => {
      steps.push({ label, drift: await fleetDrift(rt) });
    };

    const customers = await rt.repository.all("customers");
    const vehicles = await rt.repository.all("vehicles");
    const free = vehicles.find((v) => v.data.status === "Available");

    const draft = await ops.reservations.createReservation(admin, {
      customerId: customers[0].id,
      vehicleClass: free.data.vehicleClass,
      startAt: rt.now(),
      endAt: P.operations.offsetDays
        ? P.operations.offsetDays(rt.now(), 3)
        : new Date(Date.parse(rt.now()) + 3 * 86400000).toISOString(),
      notes: "QA readiness sequence",
    });
    await at("draft created");

    const confirmed = await ops.reservationWorkflows.confirmReservationWorkflow(
      admin,
      draft.id,
      free.id
    );
    await at("confirmed");
    const afterConfirm = await rt.repository.get("vehicles", free.id);

    const converted = await ops.reservationWorkflows.convertReservationWorkflow(admin, draft.id);
    await at("converted");
    const afterConvert = await rt.repository.get("vehicles", free.id);
    const convertedReservation = await rt.repository.get("reservations", draft.id);

    await ops.contracts.activateContract(admin, converted.result.contract.id);
    await at("activated");
    const afterActivate = await rt.repository.get("vehicles", free.id);

    await ops.contracts.completeContract(admin, converted.result.contract.id);
    await at("completed");
    const afterComplete = await rt.repository.get("vehicles", free.id);

    result.sequence = {
      steps,
      draftStatus: draft.data.status,
      confirmStatus: confirmed.result.data.status,
      afterConfirmStatus: afterConfirm.data.status,
      afterConfirmReservationLink: afterConfirm.data.currentReservationId ?? null,
      convertedStatus: convertedReservation.data.status,
      convertedContractId: convertedReservation.data.convertedContractId ?? null,
      contractReservationId: converted.result.contract.data.reservationId ?? null,
      contractStatus: converted.result.contract.data.status,
      afterConvertStatus: afterConvert.data.status,
      afterConvertReservationLink: afterConvert.data.currentReservationId ?? null,
      afterActivateStatus: afterActivate.data.status,
      afterActivateContractLink: afterActivate.data.currentContractId ?? null,
      afterCompleteStatus: afterComplete.data.status,
      afterCompleteContractLink: afterComplete.data.currentContractId ?? null,
    };
  }

  /* ---------------------------------------------------------------
     E. The maintenance sequence.
     --------------------------------------------------------------- */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");
    const steps = [];
    const at = async (label) => {
      steps.push({ label, drift: await fleetDrift(rt) });
    };

    const free = (await rt.repository.all("vehicles")).find(
      (v) => v.data.status === "Available"
    );

    const work = await ops.maintenance.createMaintenance(admin, {
      vehicleId: free.id,
      type: "Inspection",
      priority: "Routine",
      summary: "QA readiness inspection",
    });
    await at("work order created");
    const afterCreate = await rt.repository.get("vehicles", free.id);

    await ops.maintenance.startMaintenance(admin, work.id);
    await at("started");
    const afterStart = await rt.repository.get("vehicles", free.id);

    await ops.maintenance.completeMaintenance(admin, work.id);
    await at("completed");
    const afterComplete = await rt.repository.get("vehicles", free.id);

    result.maintenance = {
      steps,
      createdStatus: work.data.status,
      afterCreateStatus: afterCreate.data.status,
      afterCreateLink: afterCreate.data.activeMaintenanceId ?? null,
      afterStartStatus: afterStart.data.status,
      afterCompleteStatus: afterComplete.data.status,
      afterCompleteLink: afterComplete.data.activeMaintenanceId ?? null,
    };
  }

  /* ---------------------------------------------------------------
     F. Payments.
     --------------------------------------------------------------- */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");
    const contracts = await rt.repository.all("contracts");
    const target = contracts.find(
      (c) => c.data.status === "Active" && c.data.paidAmount < c.data.totalAmount
    );
    const before = target.data;
    const remaining = before.totalAmount - before.paidAmount;

    const auditBefore = (await rt.listAudit()).length;
    await ops.payments.recordPayment(admin, {
      contractId: target.id,
      amount: 1000,
      category: "Rental",
    });
    const afterPay = await rt.repository.get("contracts", target.id);
    const auditAfter = (await rt.listAudit()).length;

    const over = await code(() =>
      ops.payments.recordPayment(admin, {
        contractId: target.id,
        amount: remaining * 10,
        category: "Rental",
      })
    );
    const zero = await code(() =>
      ops.payments.recordPayment(admin, { contractId: target.id, amount: 0, category: "Rental" })
    );
    const fractional = await code(() =>
      ops.payments.recordPayment(admin, {
        contractId: target.id,
        amount: 10.5,
        category: "Rental",
      })
    );

    const cancelled = contracts.find((c) => c.data.status === "Cancelled");
    const onCancelled = cancelled
      ? await code(() =>
          ops.payments.recordPayment(admin, {
            contractId: cancelled.id,
            amount: 100,
            category: "Rental",
          })
        )
      : "no-cancelled-contract";

    result.payments = {
      paidRose: afterPay.data.paidAmount - before.paidAmount,
      integerCents: Number.isInteger(afterPay.data.paidAmount),
      balance: ops.derive.contractBalance(afterPay.data).remainingBalance,
      expectedBalance: before.totalAmount - before.paidAmount - 1000,
      audited: auditAfter - auditBefore,
      over,
      zero,
      fractional,
      onCancelled,
      drift: await fleetDrift(rt),
    };
  }

  /* ---------------------------------------------------------------
     G. Draft reservations validate the vehicle they name.
     --------------------------------------------------------------- */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");
    const customers = await rt.repository.all("customers");
    const vehicles = await rt.repository.all("vehicles");
    const urban = vehicles.find((v) => v.data.vehicleClass === "Urban");
    const start = rt.now();
    const end = new Date(Date.parse(start) + 2 * 86400000).toISOString();

    result.draftValidation = {
      unknownVehicle: await code(() =>
        ops.reservations.createReservation(admin, {
          customerId: customers[0].id,
          vehicleClass: "Urban",
          startAt: start,
          endAt: end,
          vehicleId: "vehicle_9999",
        })
      ),
      wrongClass: await code(() =>
        ops.reservations.createReservation(admin, {
          customerId: customers[0].id,
          vehicleClass: "Touring",
          startAt: start,
          endAt: end,
          vehicleId: urban.id,
        })
      ),
      matchingClass: await code(() =>
        ops.reservations.createReservation(admin, {
          customerId: customers[0].id,
          vehicleClass: "Urban",
          startAt: start,
          endAt: end,
          vehicleId: urban.id,
        })
      ),
      noVehicle: await code(() =>
        ops.reservations.createReservation(admin, {
          customerId: customers[0].id,
          vehicleClass: "Urban",
          startAt: start,
          endAt: end,
        })
      ),
    };
  }

  /* ---------------------------------------------------------------
     H. Reset restores the canonical world, invariant included.
     --------------------------------------------------------------- */
  {
    const rt = await fresh();
    const admin = ops.contextAs(rt, "Admin");
    const free = (await rt.repository.all("vehicles")).find((v) => v.data.status === "Available");
    await ops.maintenance.createMaintenance(admin, {
      vehicleId: free.id,
      type: "Repair",
      priority: "High",
      summary: "QA scratch before reset",
    });
    await rt.reset();
    const vehicles = await rt.repository.all("vehicles");
    const tally = (s) => vehicles.filter((v) => v.data.status === s).length;
    result.reset = {
      vehicles: vehicles.length,
      available: tally("Available"),
      reserved: tally("Reserved"),
      rented: tally("Rented"),
      maintenance: tally("Maintenance"),
      workOrders: (await rt.repository.all("maintenance")).length,
      drift: await fleetDrift(rt),
    };
  }

  return result;
});

/* =====================================================================
   ASSERTIONS
   ===================================================================== */

section("FLEET INVARIANT - THE SEED");
check("every seeded vehicle matches its derivation", out.seedDrift.length === 0, out.seedDrift[0] ?? "");

section("RULE 03 - THE PRODUCTION WORKFLOW");
check("confirming through the workflow runs Rule 03", out.rule03.outcome === "Success", out.rule03.outcome);
check("the reservation is Confirmed", out.rule03.reservationStatus === "Confirmed", out.rule03.reservationStatus);
check("one automation run is recorded", out.rule03.runsAdded === 1, String(out.rule03.runsAdded));
check("a message is appended", out.rule03.messagesAdded === 1, String(out.rule03.messagesAdded));
check("and it is a System message", out.rule03.systemCount === 1, String(out.rule03.systemCount));
check("which says what happened", /reservation confirmed/i.test(out.rule03.systemBody), out.rule03.systemBody);
check("the conversation becomes unread", out.rule03.unread === true);
check("the fleet still matches its derivation", out.rule03.drift.length === 0, out.rule03.drift[0] ?? "");
check(
  "the bare service still wakes nothing, so the workflow is what closed it",
  out.bareServiceRuns === 0,
  String(out.bareServiceRuns)
);

section("LEAD RULES - UNCHANGED BY THE EXTRACTION");
check("Rule 01 runs", out.leadRules.rule01Status === "Success", out.leadRules.rule01Status);
check("and assigns the website lead", out.leadRules.websiteAssigned);
check("a referral is left unassigned", out.leadRules.referralUnassigned === null, String(out.leadRules.referralUnassigned));
check("Rule 02 runs", out.leadRules.rule02Status === "Success", out.leadRules.rule02Status);
check("and schedules the follow-up", out.leadRules.followUpSet);

section("RENTAL SEQUENCE - DRAFT TO COMPLETED");
for (const step of out.sequence.steps) {
  check(`fleet matches derivation after ${step.label}`, step.drift.length === 0, step.drift[0] ?? "");
}
check("a new reservation starts as Draft", out.sequence.draftStatus === "Draft", out.sequence.draftStatus);
check("confirming reserves the vehicle", out.sequence.afterConfirmStatus === "Reserved", out.sequence.afterConfirmStatus);
check("and points at the reservation", out.sequence.afterConfirmReservationLink !== null);
check("converting marks it Converted", out.sequence.convertedStatus === "Converted", out.sequence.convertedStatus);
check("the reservation names its contract", out.sequence.convertedContractId !== null, String(out.sequence.convertedContractId));
check("and the contract names its reservation", out.sequence.contractReservationId !== null, String(out.sequence.contractReservationId));
check("the new contract is Pending", out.sequence.contractStatus === "Pending", out.sequence.contractStatus);
/* The regression this stage fixed: a Pending contract claims nothing, and the
   reservation is no longer Confirmed, so the vehicle falls back to Available
   and drops the pointer rather than staying Reserved. */
check("conversion releases the reservation hold", out.sequence.afterConvertStatus === "Available", out.sequence.afterConvertStatus);
check("and clears the stale pointer", out.sequence.afterConvertReservationLink === null, String(out.sequence.afterConvertReservationLink));
check("activating rents the vehicle", out.sequence.afterActivateStatus === "Rented", out.sequence.afterActivateStatus);
check("and points at the contract", out.sequence.afterActivateContractLink !== null);
check("completing returns it to the fleet", out.sequence.afterCompleteStatus === "Available", out.sequence.afterCompleteStatus);
check("and clears the contract pointer", out.sequence.afterCompleteContractLink === null, String(out.sequence.afterCompleteContractLink));

section("MAINTENANCE SEQUENCE");
for (const step of out.maintenance.steps) {
  check(`fleet matches derivation after ${step.label}`, step.drift.length === 0, step.drift[0] ?? "");
}
check("a new work order is Open", out.maintenance.createdStatus === "Open", out.maintenance.createdStatus);
/* The other regression this stage fixed: Open is an active work order under
   the frozen precedence, so the vehicle is in Maintenance from creation. */
check("creating one takes the vehicle off the fleet", out.maintenance.afterCreateStatus === "Maintenance", out.maintenance.afterCreateStatus);
check("and points at the work order", out.maintenance.afterCreateLink !== null, String(out.maintenance.afterCreateLink));
check("starting keeps it there", out.maintenance.afterStartStatus === "Maintenance", out.maintenance.afterStartStatus);
check("completing returns it", out.maintenance.afterCompleteStatus === "Available", out.maintenance.afterCompleteStatus);
check("and clears the pointer", out.maintenance.afterCompleteLink === null, String(out.maintenance.afterCompleteLink));

section("PAYMENTS");
check("a payment raises paidAmount", out.payments.paidRose === 1000, String(out.payments.paidRose));
check("in integer cents", out.payments.integerCents);
check("the balance follows", out.payments.balance === out.payments.expectedBalance, `${out.payments.balance} vs ${out.payments.expectedBalance}`);
check("and it is audited", out.payments.audited === 1, String(out.payments.audited));
check("overpayment is refused", out.payments.over === "CONFLICT", out.payments.over);
check("a zero payment is refused", out.payments.zero === "VALIDATION", out.payments.zero);
check("a fractional cent is refused", out.payments.fractional === "VALIDATION", out.payments.fractional);
check("a cancelled contract takes no payment", out.payments.onCancelled === "CONFLICT", out.payments.onCancelled);
check("payments leave the fleet alone", out.payments.drift.length === 0, out.payments.drift[0] ?? "");

section("DRAFT RESERVATION REFERENCES");
check("an unknown vehicle is refused", out.draftValidation.unknownVehicle === "NOT_FOUND", out.draftValidation.unknownVehicle);
check("a class mismatch is refused", out.draftValidation.wrongClass === "CONFLICT", out.draftValidation.wrongClass);
check("a matching vehicle is accepted", out.draftValidation.matchingClass === "no-error", out.draftValidation.matchingClass);
check("and naming no vehicle stays legal", out.draftValidation.noVehicle === "no-error", out.draftValidation.noVehicle);

section("RESET");
check("24 vehicles", out.reset.vehicles === 24, String(out.reset.vehicles));
check("10 available", out.reset.available === 10, String(out.reset.available));
check("4 reserved", out.reset.reserved === 4, String(out.reset.reserved));
check("7 rented", out.reset.rented === 7, String(out.reset.rented));
check("3 in maintenance", out.reset.maintenance === 3, String(out.reset.maintenance));
check("10 work orders", out.reset.workOrders === 10, String(out.reset.workOrders));
check("and the restored fleet matches its derivation", out.reset.drift.length === 0, out.reset.drift[0] ?? "");

await browser.close();

console.log(
  `\n=== stage 09C4.0 readiness: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
