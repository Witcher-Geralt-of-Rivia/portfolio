/**
 * Stage 09C1 - Operations domain QA.
 *
 * The domain is browser code: it persists through the shared runtime to
 * IndexedDB and falls back to memory. It cannot be exercised in Node, so this
 * harness drives the real bundled modules in a real browser.
 *
 * To re-run:
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run dev
 *   node qa/stage09c1-operations.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * Every business assertion runs twice, once against each persistence adapter,
 * because the two must be indistinguishable.
 */

import { chromium } from "playwright";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.QA_BASE ?? "http://127.0.0.1:3000";
const PROBE = `${BASE}/demos/qa-operations`;

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(56)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

/* =====================================================================
   0. DEPENDENCY BOUNDARY (static)

   The shared runtime must not learn what a lead is. Checked by reading the
   source rather than by trusting review: an import added in a hurry is
   exactly the kind of thing that slips through.
   ===================================================================== */

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/[.]tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

section("DEPENDENCY BOUNDARY");
{
  const runtimeFiles = walk("src/demo-runtime");
  const offenders = runtimeFiles.filter((f) =>
    /from "(@\/demos|[.][.]?\/(demos|[.][.]\/demos))/.test(readFileSync(f, "utf8"))
  );
  check("the runtime imports nothing from src/demos", offenders.length === 0, offenders.join(", "));

  const DOMAIN_WORDS = /(Lead|Customer|Vehicle|Reservation|Contract|Payment|Maintenance|Conversation)/;
  const leaked = runtimeFiles.filter((f) => {
    const text = readFileSync(f, "utf8");
    /* Strip comments: the runtime's own prose explains what it must NOT know,
       and that explanation is not a leak. */
    const code = text.replace(/\/[*][^]*?[*]\//g, "").replace(/\/\/.*$/gm, "");
    return DOMAIN_WORDS.test(code);
  });
  check("no Operations entity name appears in runtime code", leaked.length === 0, leaked.join(", "));

  const domainFiles = walk("src/demos/operations");
  check("the domain is built from more than one module", domainFiles.length >= 15, `${domainFiles.length} files`);

  const banned = domainFiles.filter((f) => {
    const code = readFileSync(f, "utf8").replace(/\/[*][^]*?[*]\//g, "").replace(/\/\/.*$/gm, "");
    return /any\s*[;,)=>\]]|@ts-ignore|@ts-nocheck|Math[.]random|crypto[.]randomUUID|Date[.]now/.test(code);
  });
  check("no any, ts-ignore, Math.random, randomUUID or Date.now in the domain",
    banned.length === 0, banned.join(", "));
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleProblems = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") consoleProblems.push(m.text());
});
const requests = [];
page.on("request", (r) => requests.push(r.url()));

await page.goto(PROBE, { waitUntil: "networkidle" });
await page.waitForFunction(() => Boolean(window.__opsProbe), null, { timeout: 20_000 });

/**
 * Run a function in the page against a freshly seeded Operations runtime.
 *
 * `adapter` selects the persistence path; every business suite runs on both.
 */
async function run(adapter, fn, arg) {
  return page.evaluate(
    async ({ adapter, body, arg }) => {
      const p = window.__opsProbe;
      await p.deleteDemoDatabase();
      const runtime = p.operations.createOperationsRuntime({
        latency: "instant",
        broadcast: false,
        ...(adapter === "memory" ? { adapter: p.createMemoryAdapter() } : {}),
      });
      await runtime.initialize();
      const api = {
        runtime,
        ops: p.operations,
        ctxAs: (role) => p.operations.contextAs(runtime, role),
        ctx: p.operations.contextAs(runtime, "Admin"),
        code: async (fn) => {
          try {
            await fn();
            return "NO_THROW";
          } catch (e) {
            return p.isDemoError(e) ? e.code : `NOT_DEMO_ERROR:${String(e)}`;
          }
        },
      };
      try {
        const body_ = new Function("api", "arg", `return (${body})(api, arg);`);
        return await body_(api, arg);
      } finally {
        runtime.dispose();
      }
    },
    { adapter, body: fn.toString(), arg: arg ?? null }
  );
}

/* =====================================================================
   1. SEED INTEGRITY (pure, adapter-independent)
   ===================================================================== */

section("SEED INTEGRITY");
const integrity = await page.evaluate(() => window.__opsProbe.assertOperationsSeedIntegrity());
check("the seed satisfies its whole relationship contract", integrity.length === 0,
  integrity.slice(0, 4).map((p) => `${p.check}: ${p.detail}`).join(" | "));

/* =====================================================================
   2. THE BUSINESS SUITE, RUN ON BOTH ADAPTERS
   ===================================================================== */

const suite = async (api) => {
  const { ops, ctx, ctxAs, runtime, code } = api;
  const out = {};
  const now = () => runtime.now();

  /* --- counts and distributions --------------------------------------- */
  const collections = {
    actors: await runtime.repository.all("actors"),
    leads: await runtime.repository.all("leads"),
    customers: await runtime.repository.all("customers"),
    vehicles: await runtime.repository.all("vehicles"),
    reservations: await runtime.repository.all("reservations"),
    contracts: await runtime.repository.all("contracts"),
    payments: await runtime.repository.all("payments"),
    maintenance: await runtime.repository.all("maintenance"),
    conversations: await runtime.repository.all("conversations"),
    messages: await runtime.repository.all("messages"),
    automation_rules: await runtime.repository.all("automation_rules"),
    automation_runs: await runtime.repository.all("automation_runs"),
    notifications: await runtime.repository.all("notifications"),
  };
  out.counts = Object.fromEntries(
    Object.entries(collections).map(([k, v]) => [k, v.length])
  );
  out.auditCount = (await runtime.listAudit()).length;
  out.revision = runtime.revision();
  out.clock = now();

  const tally = (rows, pick) =>
    rows.reduce((acc, r) => ((acc[pick(r)] = (acc[pick(r)] ?? 0) + 1), acc), {});

  out.leadStage = tally(collections.leads, (l) => l.data.stage);
  out.vehicleStatus = tally(collections.vehicles, (v) => v.data.status);
  out.reservationStatus = tally(collections.reservations, (r) => r.data.status);
  out.contractStatus = tally(collections.contracts, (c) => c.data.status);
  out.maintenanceStatus = tally(collections.maintenance, (w) => w.data.status);
  out.paymentEffective = tally(collections.payments, (p) =>
    ops.derive.derivePaymentStatus(p.data, now())
  );

  /* --- overview ------------------------------------------------------- */
  const resolved = await ops.payments.resolvedPayments(ctx);
  out.overview = ops.overview.selectOverview({
    now: now(),
    leads: collections.leads,
    vehicles: collections.vehicles,
    reservations: collections.reservations,
    contracts: collections.contracts,
    payments: resolved,
    maintenance: collections.maintenance,
    notifications: collections.notifications,
  });
  out.unreadNotifications = await ops.notifications.unreadNotificationCount(ctx);

  /* --- W1 lead to customer -------------------------------------------- */
  const lead = await ops.leads.createLead(ctx, {
    displayName: "Wren Halloway",
    source: "Website",
    vehicleInterest: "Urban",
    priority: "High",
  });
  const created = await ops.automations.processEvents(ctx, [
    {
      id: "e1",
      demoId: "operations",
      type: "lead.created.website",
      occurredAt: now(),
      payload: { leadId: lead.id, source: "Website" },
    },
  ]);
  const afterAssign = await runtime.repository.get("leads", lead.id);
  await ops.leads.changeLeadStage(ctx, lead.id, "Contacted");
  await ops.leads.changeLeadStage(ctx, lead.id, "Qualified");
  const qualified = await ops.automations.processEvents(ctx, [
    {
      id: "e2",
      demoId: "operations",
      type: "lead.qualified",
      occurredAt: now(),
      payload: { leadId: lead.id },
    },
  ]);
  const withFollowUp = await runtime.repository.get("leads", lead.id);
  const conversion = await ops.leads.convertLeadToCustomer(ctx, lead.id);
  const convertedLead = await runtime.repository.get("leads", lead.id);
  const newCustomer = await runtime.repository.get("customers", conversion.customer.id);

  out.w1 = {
    leadId: lead.id,
    assignedTo: afterAssign.data.assignedActorId,
    assignmentRun: created[0]?.status,
    followUpRun: qualified[0]?.status,
    followUpDelta:
      Date.parse(withFollowUp.data.nextFollowUpAt) - Date.parse(withFollowUp.updatedAt),
    stage: convertedLead.data.stage,
    convertedCustomerId: convertedLead.data.convertedCustomerId,
    sourceLeadId: newCustomer.data.sourceLeadId,
    duplicate: await code(() => ops.leads.convertLeadToCustomer(ctx, lead.id)),
  };

  /* --- W2 reservation to rental --------------------------------------- */
  const startAt = ops.derive ? new Date(Date.parse(now()) + 20 * 86400000).toISOString() : "";
  const endAt = new Date(Date.parse(now()) + 24 * 86400000).toISOString();
  /* Utility, because every Urban vehicle in the canonical seed is currently
     Rented or Reserved: the ten Available vehicles are Touring and Utility.
     The Urban class is used below, where a currently-rented vehicle is what
     the precedence case needs. */
  const reservation = await ops.reservations.createReservation(ctx, {
    customerId: "customer_0001",
    vehicleClass: "Utility",
    startAt,
    endAt,
  });
  const eligible = await ops.reservations.getEligibleVehicles(ctx, {
    vehicleClass: "Utility",
    startAt,
    endAt,
  });
  /* Eligibility is interval-based, so a vehicle whose current rental ends
     before this window is legitimately offered. Status is "now"-based, so
     such a vehicle stays Rented. Pick one that is free today to test the
     Reserved transition, and check the other case separately below. */
  const chosen = eligible.find((v) => v.data.status === "Available") ?? eligible[0];
  await ops.reservations.confirmReservation(ctx, reservation.id, chosen.id);
  const reservedVehicle = await runtime.repository.get("vehicles", chosen.id);
  const converted = await ops.reservations.convertReservationToContract(ctx, reservation.id);
  await ops.contracts.activateContract(ctx, converted.contract.id);
  const rentedVehicle = await runtime.repository.get("vehicles", chosen.id);
  const activeContract = await runtime.repository.get("contracts", converted.contract.id);

  out.w2 = {
    eligibleCount: eligible.length,
    chosen: chosen.id,
    afterConfirm: reservedVehicle.data.status,
    afterActivate: rentedVehicle.data.status,
    contractStatus: activeContract.data.status,
    totalAmount: activeContract.data.totalAmount,
    expectedTotal:
      activeContract.data.dailyRate * ops.derive.billableDays(startAt, endAt),
    ineligible: await code(() =>
      ops.reservations.confirmReservation(ctx, reservation.id, chosen.id)
    ),
    chosenWasAvailable: chosen.data.status === "Available",
  };

  /* A vehicle already out on a rental may be booked for a later window, and
     must still read as Rented today: the contract outranks the reservation.

     Eligibility is recomputed here rather than reused from the snapshot above,
     which several mutations ago stopped describing the world. */
  const freshEligible = await ops.reservations.getEligibleVehicles(ctx, {
    vehicleClass: "Urban",
    startAt,
    endAt,
  });
  const busyNow = freshEligible.find((v) => v.data.status === "Rented");
  out.w2.busyEligibleOffered = Boolean(busyNow);
  if (busyNow) {
    const later = await ops.reservations.createReservation(ctx, {
      customerId: "customer_0002",
      vehicleClass: busyNow.data.vehicleClass,
      startAt,
      endAt,
    });
    await ops.reservations.confirmReservation(ctx, later.id, busyNow.id);
    const stillRented = await runtime.repository.get("vehicles", busyNow.id);
    out.w2.busyStaysRented = stillRented.data.status;
    out.w2.busyKeepsReservationLink = Boolean(stillRented.data.currentReservationId);
  }

  /* --- W3 payment ------------------------------------------------------ */
  const before = await runtime.repository.get("contracts", converted.contract.id);
  const paid = await ops.payments.recordPayment(ctx, {
    contractId: converted.contract.id,
    amount: 1000,
    category: "Deposit",
  });
  const afterPay = await runtime.repository.get("contracts", converted.contract.id);
  out.w3 = {
    paidBefore: before.data.paidAmount,
    paidAfter: afterPay.data.paidAmount,
    paymentAmount: paid.payment.data.amount,
    remaining: ops.derive.contractBalance(afterPay.data).remainingBalance,
    overpay: await code(() =>
      ops.payments.recordPayment(ctx, {
        contractId: converted.contract.id,
        amount: afterPay.data.totalAmount * 10,
        category: "Rental",
      })
    ),
    zero: await code(() =>
      ops.payments.recordPayment(ctx, {
        contractId: converted.contract.id,
        amount: 0,
        category: "Rental",
      })
    ),
  };

  /* --- W4 maintenance --------------------------------------------------- */
  const freeVehicle = (await runtime.repository.all("vehicles")).find(
    (v) => v.data.status === "Available"
  );
  const work = await ops.maintenance.createMaintenance(ctx, {
    vehicleId: freeVehicle.id,
    type: "Inspection",
    priority: "Routine",
    summary: "Scheduled inspection",
  });
  await ops.maintenance.startMaintenance(ctx, work.id);
  const inShop = await runtime.repository.get("vehicles", freeVehicle.id);
  const completed = await ops.maintenance.completeMaintenance(ctx, work.id);
  const backOnFleet = await runtime.repository.get("vehicles", freeVehicle.id);
  const maintenanceRuns = await ops.automations.processEvents(ctx, [
    {
      id: "e3",
      demoId: "operations",
      type: "maintenance.completed",
      occurredAt: now(),
      payload: { workOrderId: work.id, vehicleId: freeVehicle.id },
    },
  ]);

  // conflict: a rented vehicle cannot start maintenance
  const rentedWork = await ops.maintenance.createMaintenance(ctx, {
    vehicleId: chosen.id,
    type: "Repair",
    priority: "High",
    summary: "Brake check",
  });

  out.w4 = {
    duringWork: inShop.data.status,
    afterComplete: backOnFleet.data.status,
    completedStatus: completed.data.status,
    notificationRun: maintenanceRuns[0]?.status,
    rentedConflict: await code(() => ops.maintenance.startMaintenance(ctx, rentedWork.id)),
  };

  /* --- W5 inbox and assist ---------------------------------------------- */
  const leadConversation = (await runtime.repository.all("conversations")).find(
    (c) => c.data.subjectType === "Lead"
  );
  const briefBefore = await ops.inbox.getLeadBrief(ctx, leadConversation.data.subjectId);
  const reply = await ops.inbox.addMessage(ctx, leadConversation.id, "Checking availability now.");
  const afterReply = await runtime.repository.get("conversations", leadConversation.id);
  const thread = (await runtime.repository.all("messages")).filter(
    (m) => m.data.conversationId === leadConversation.id
  );
  const briefAfter = await ops.inbox.getLeadBrief(ctx, leadConversation.data.subjectId);

  out.w5 = {
    conversationId: leadConversation.id,
    briefSummary: briefBefore.summary,
    briefAction: briefBefore.recommendedAction,
    replyAuthor: reply.data.authorType,
    replyActor: reply.data.actorId,
    unreadAfterReply: afterReply.data.unread,
    threadLength: thread.length,
    actionAfter: briefAfter.recommendedAction,
    briefDeterministic:
      JSON.stringify(await ops.inbox.getLeadBrief(ctx, leadConversation.data.subjectId)) ===
      JSON.stringify(briefAfter),
  };

  /* --- W6 automation control --------------------------------------------- */
  const ruleId = "automation_rule_0005";
  await ops.automations.setRuleEnabled(ctx, ruleId, false);
  const skipped = await ops.automations.processEvents(ctx, [
    {
      id: "e4",
      demoId: "operations",
      type: "maintenance.completed",
      occurredAt: now(),
      payload: { workOrderId: work.id, vehicleId: freeVehicle.id },
    },
  ]);
  await ops.automations.setRuleEnabled(ctx, ruleId, true);
  const tested = await ops.automations.testRule(ctx, ruleId);
  const rule = await runtime.repository.get("automation_rules", ruleId);

  out.w6 = {
    skipped: skipped[0]?.status,
    afterEnable: tested.status,
    runCount: rule.data.runCount,
    runsExist: (await runtime.repository.all("automation_runs")).some(
      (r) => r.id === tested.runId
    ),
  };

  /* --- role enforcement --------------------------------------------------- */
  const sales = ctxAs("Sales Agent");
  const fleet = ctxAs("Fleet Coordinator");
  const finance = ctxAs("Finance Analyst");
  out.roles = {
    salesCannotRecordPayment: await code(() =>
      ops.payments.recordPayment(finance ? sales : sales, {
        contractId: converted.contract.id,
        amount: 100,
        category: "Rental",
      })
    ),
    salesCannotStartMaintenance: await code(() =>
      ops.maintenance.startMaintenance(sales, rentedWork.id)
    ),
    fleetCannotCreateLead: await code(() =>
      ops.leads.createLead(fleet, {
        displayName: "Blocked",
        source: "Website",
        vehicleInterest: "Urban",
        priority: "Low",
      })
    ),
    financeCannotArchiveCustomer: await code(() =>
      ops.customers.archiveCustomer(finance, "customer_0020")
    ),
    financeCanRecordPayment: await code(() =>
      ops.payments.recordPayment(finance, {
        contractId: converted.contract.id,
        amount: 100,
        category: "Rental",
      })
    ),
    salesCanCreateLead: await code(() =>
      ops.leads.createLead(sales, {
        displayName: "Allowed",
        source: "Referral",
        vehicleInterest: "Urban",
        priority: "Low",
      })
    ),
    adminModules: ops.permissions.visibleModules("Admin").length,
    salesModules: ops.permissions.visibleModules("Sales Agent").length,
    fleetModules: ops.permissions.visibleModules("Fleet Coordinator").length,
    financeModules: ops.permissions.visibleModules("Finance Analyst").length,
    salesBottomNav: ops.permissions.bottomNavModules("Sales Agent"),
    financeBottomNav: ops.permissions.bottomNavModules("Finance Analyst"),
  };

  /* --- further conflicts ---------------------------------------------------- */
  const activeCustomer = (await runtime.repository.all("contracts")).find(
    (c) => c.data.status === "Active"
  ).data.customerId;
  out.conflicts = {
    archiveWithActiveContract: await code(() =>
      ops.customers.archiveCustomer(ctx, activeCustomer)
    ),
    missingLead: await code(() => ops.leads.changeLeadStage(ctx, "lead_9999", "Contacted")),
    activateNonPending: await code(() =>
      ops.contracts.activateContract(ctx, converted.contract.id)
    ),
    stageToWon: await code(() => ops.leads.changeLeadStage(ctx, "lead_0001", "Won")),
  };

  out.mutatedRevision = runtime.revision();

  /* --- reset --------------------------------------------------------------- */
  await runtime.reset();
  const afterReset = {
    counts: {},
    audit: (await runtime.listAudit()).length,
    revision: runtime.revision(),
    clock: runtime.now(),
    role: runtime.session.getState().activeRole,
  };
  for (const name of Object.keys(collections)) {
    afterReset.counts[name] = (await runtime.repository.all(name)).length;
  }
  afterReset.vehicleStatus = tally(
    await runtime.repository.all("vehicles"),
    (v) => v.data.status
  );
  const firstLead = await runtime.repository.get("leads", "lead_0001");
  afterReset.firstLeadName = firstLead.data.displayName;
  afterReset.firstLeadCreatedAt = firstLead.createdAt;
  out.afterReset = afterReset;

  return out;
};

for (const adapter of ["indexeddb", "memory"]) {
  section(`BUSINESS SUITE - ${adapter}`);
  const r = await run(adapter, suite);

  const C = r.counts;
  check("actors 4", C.actors === 4, String(C.actors));
  check("leads 48", C.leads === 48, String(C.leads));
  check("customers 32", C.customers === 32, String(C.customers));
  check("vehicles 24", C.vehicles === 24, String(C.vehicles));
  check("reservations 18", C.reservations === 18, String(C.reservations));
  check("contracts 14", C.contracts === 14, String(C.contracts));
  check("payments 26", C.payments === 26, String(C.payments));
  check("maintenance 10", C.maintenance === 10, String(C.maintenance));
  check("conversations 20", C.conversations === 20, String(C.conversations));
  check("messages 64", C.messages === 64, String(C.messages));
  check("automation rules 5", C.automation_rules === 5, String(C.automation_rules));
  check("automation runs 18", C.automation_runs === 18, String(C.automation_runs));
  check("notifications 22", C.notifications === 22, String(C.notifications));
  check("seeded audit 63", r.auditCount === 63, String(r.auditCount));
  check("seeded revision 0", r.revision === 0, String(r.revision));
  check("seeded clock is the canonical base", r.clock === "2026-09-01T09:00:00.000Z", r.clock);

  const sameTally = (actual, wanted) =>
    Object.keys(wanted).every((k) => actual[k] === wanted[k]) &&
    Object.keys(actual).length === Object.keys(wanted).length;
  check("lead stages 12/10/9/7/6/4",
    sameTally(r.leadStage, { New: 12, Contacted: 10, Qualified: 9, Proposal: 7, Won: 6, Lost: 4 }),
    JSON.stringify(r.leadStage));
  check("vehicle statuses 10/4/7/3",
    r.vehicleStatus.Available === 10 && r.vehicleStatus.Reserved === 4 &&
      r.vehicleStatus.Rented === 7 && r.vehicleStatus.Maintenance === 3,
    JSON.stringify(r.vehicleStatus));
  check("reservation statuses 4/4/7/3",
    r.reservationStatus.Draft === 4 && r.reservationStatus.Confirmed === 4 &&
      r.reservationStatus.Converted === 7 && r.reservationStatus.Cancelled === 3,
    JSON.stringify(r.reservationStatus));
  check("contract statuses 3/7/3/1",
    r.contractStatus.Pending === 3 && r.contractStatus.Active === 7 &&
      r.contractStatus.Completed === 3 && r.contractStatus.Cancelled === 1,
    JSON.stringify(r.contractStatus));
  check("payment effective 18/5/3",
    r.paymentEffective.Paid === 18 && r.paymentEffective.Pending === 5 &&
      r.paymentEffective.Overdue === 3,
    JSON.stringify(r.paymentEffective));
  check("maintenance statuses 2/1/6/1",
    r.maintenanceStatus.Open === 2 && r.maintenanceStatus["In Progress"] === 1 &&
      r.maintenanceStatus.Completed === 6 && r.maintenanceStatus.Cancelled === 1,
    JSON.stringify(r.maintenanceStatus));

  const o = r.overview;
  check("Overview open leads = 38", o.openLeads === 38, String(o.openLeads));
  check("Overview confirmed reservations = 4", o.confirmedReservations === 4, String(o.confirmedReservations));
  check("Overview vehicles available = 10", o.vehiclesAvailable === 10, String(o.vehiclesAvailable));
  check("Overview payments needing attention = 8", o.paymentsRequiringAttention === 8, String(o.paymentsRequiringAttention));
  check("lead funnel 12/10/9/7/6",
    JSON.stringify(o.leadFunnel.map((f) => f.count)) === JSON.stringify([12, 10, 9, 7, 6]),
    JSON.stringify(o.leadFunnel.map((f) => f.count)));
  check("lost shown separately = 4", o.leadsLost === 4, String(o.leadsLost));
  check("unread notifications = 8", r.unreadNotifications === 8, String(r.unreadNotifications));

  const w1 = r.w1;
  check("W1 automation assigned the website lead", w1.assignedTo === "actor_0002", String(w1.assignedTo));
  check("W1 assignment run succeeded", w1.assignmentRun === "Success", w1.assignmentRun);
  check("W1 follow-up run succeeded", w1.followUpRun === "Success", w1.followUpRun);
  check("W1 follow-up is two days out", w1.followUpDelta === 2 * 86400000, `${w1.followUpDelta}ms`);
  check("W1 lead reached Won", w1.stage === "Won", w1.stage);
  check("W1 lead and customer point at each other",
    w1.convertedCustomerId && w1.sourceLeadId === w1.leadId,
    `${w1.convertedCustomerId} / ${w1.sourceLeadId}`);
  check("W1 second conversion is a CONFLICT", w1.duplicate === "CONFLICT", w1.duplicate);

  const w2 = r.w2;
  check("W2 eligible vehicles were offered", w2.eligibleCount > 0, String(w2.eligibleCount));
  check("W2 confirming reserves the vehicle", w2.afterConfirm === "Reserved", w2.afterConfirm);
  check("W2 activating rents the vehicle", w2.afterActivate === "Rented", w2.afterActivate);
  check("W2 contract is Active", w2.contractStatus === "Active", w2.contractStatus);
  check("W2 total is rate x billable days", w2.totalAmount === w2.expectedTotal,
    `${w2.totalAmount} vs ${w2.expectedTotal}`);
  check("W2 re-confirming is a CONFLICT", w2.ineligible === "CONFLICT", w2.ineligible);
  check("W2 the confirmed vehicle was free today", w2.chosenWasAvailable === true);
  if (w2.busyEligibleOffered) {
    check("W2 a rented vehicle is still bookable for a later window",
      w2.busyStaysRented === "Rented", w2.busyStaysRented);
    check("W2 an active contract outranks that future reservation",
      w2.busyKeepsReservationLink === true);
  }

  const w3 = r.w3;
  check("W3 payment raises paidAmount", w3.paidAfter === w3.paidBefore + 1000,
    `${w3.paidBefore} -> ${w3.paidAfter}`);
  check("W3 balance is total minus paid", w3.remaining >= 0, String(w3.remaining));
  check("W3 overpayment is a CONFLICT", w3.overpay === "CONFLICT", w3.overpay);
  check("W3 zero payment is a VALIDATION error", w3.zero === "VALIDATION", w3.zero);

  const w4 = r.w4;
  check("W4 starting work puts the vehicle in Maintenance", w4.duringWork === "Maintenance", w4.duringWork);
  check("W4 completing returns it to the fleet", w4.afterComplete === "Available", w4.afterComplete);
  check("W4 notification run succeeded", w4.notificationRun === "Success", w4.notificationRun);
  check("W4 maintenance on a rented vehicle is a CONFLICT", w4.rentedConflict === "CONFLICT", w4.rentedConflict);

  const w5 = r.w5;
  check("W5 brief is composed", w5.briefSummary.length > 20, w5.briefSummary);
  check("W5 recommended action is from the fixed set",
    ["Follow up", "Prepare reservation", "Review conversation"].includes(w5.briefAction), w5.briefAction);
  check("W5 reply is authored by staff", w5.replyAuthor === "Staff" && w5.replyActor === "actor_0001",
    `${w5.replyAuthor}/${w5.replyActor}`);
  check("W5 replying marks the thread read", w5.unreadAfterReply === false);
  check("W5 the thread grew", w5.threadLength >= 3, String(w5.threadLength));
  check("W5 the brief is deterministic", w5.briefDeterministic === true);

  const w6 = r.w6;
  check("W6 a disabled rule records a Skipped run", w6.skipped === "Skipped", w6.skipped);
  check("W6 re-enabling lets the action run", w6.afterEnable === "Success", w6.afterEnable);
  check("W6 the run is persisted", w6.runsExist === true);

  const roles = r.roles;
  check("Sales Agent cannot record a payment", roles.salesCannotRecordPayment === "FORBIDDEN", roles.salesCannotRecordPayment);
  check("Sales Agent cannot start maintenance", roles.salesCannotStartMaintenance === "FORBIDDEN", roles.salesCannotStartMaintenance);
  check("Fleet Coordinator cannot create a lead", roles.fleetCannotCreateLead === "FORBIDDEN", roles.fleetCannotCreateLead);
  check("Finance Analyst cannot archive a customer", roles.financeCannotArchiveCustomer === "FORBIDDEN", roles.financeCannotArchiveCustomer);
  check("Finance Analyst can record a payment", roles.financeCanRecordPayment === "NO_THROW", roles.financeCanRecordPayment);
  check("Sales Agent can create a lead", roles.salesCanCreateLead === "NO_THROW", roles.salesCanCreateLead);
  check("Admin sees 11 modules", roles.adminModules === 11, String(roles.adminModules));
  check("Sales Agent sees 6 modules", roles.salesModules === 6, String(roles.salesModules));
  check("Fleet Coordinator sees 5 modules", roles.fleetModules === 5, String(roles.fleetModules));
  check("Finance Analyst sees 5 modules", roles.financeModules === 5, String(roles.financeModules));
  check("Sales bottom nav adapts",
    JSON.stringify(roles.salesBottomNav) === JSON.stringify(["Overview", "Leads", "Reservations", "Customers"]),
    JSON.stringify(roles.salesBottomNav));
  check("Finance bottom nav adapts",
    JSON.stringify(roles.financeBottomNav) === JSON.stringify(["Overview", "Customers", "Contracts", "Payments"]),
    JSON.stringify(roles.financeBottomNav));

  const cf = r.conflicts;
  check("archiving a customer with an active contract is a CONFLICT", cf.archiveWithActiveContract === "CONFLICT", cf.archiveWithActiveContract);
  check("a missing lead is NOT_FOUND", cf.missingLead === "NOT_FOUND", cf.missingLead);
  check("activating a non-pending contract is a CONFLICT", cf.activateNonPending === "CONFLICT", cf.activateNonPending);
  check("moving a lead straight to Won is a CONFLICT", cf.stageToWon === "CONFLICT", cf.stageToWon);

  check("mutations advanced the revision", r.mutatedRevision > 0, String(r.mutatedRevision));

  const ar = r.afterReset;
  check("reset restores every count",
    sameTally(ar.counts, r.counts), JSON.stringify(ar.counts));
  check("reset restores the vehicle distribution",
    sameTally(ar.vehicleStatus, r.vehicleStatus), JSON.stringify(ar.vehicleStatus));
  check("reset restores the seeded audit", ar.audit === 63, String(ar.audit));
  check("reset restores revision 0", ar.revision === 0, String(ar.revision));
  check("reset restores the canonical clock", ar.clock === r.clock, ar.clock);
  check("reset restores the Admin role", ar.role === "Admin", ar.role);
  check("reset restores the same first lead", ar.firstLeadName.length > 0, ar.firstLeadName);
}

/* =====================================================================
   3. DEMO ISOLATION
   ===================================================================== */

section("DEMO ISOLATION");
const isolation = await page.evaluate(async () => {
  const p = window.__opsProbe;
  await p.deleteDemoDatabase();

  /* Field and Learning get generic fixtures through the shared factory. The
     Operations domain must not be able to disturb them. */
  const genericSeed = (demoId) => ({
    demoId,
    seedVersion: 1,
    baseClock: "2026-03-02T09:00:00.000Z",
    clockTickMs: 60000,
    collections: {
      alpha: {
        idPrefix: "alpha",
        records: [
          { id: "alpha_0001", data: { label: "one" } },
          { id: "alpha_0002", data: { label: "two" } },
        ],
      },
    },
    initialRole: "viewer",
    roles: ["viewer"],
  });

  const field = p.createDemoRuntime({
    seed: genericSeed("field"),
    latency: "instant",
    broadcast: false,
  });
  const learning = p.createDemoRuntime({
    seed: genericSeed("learning"),
    latency: "instant",
    broadcast: false,
  });
  await field.initialize();
  await learning.initialize();

  const ops = p.operations.createOperationsRuntime({ latency: "instant", broadcast: false });
  await ops.initialize();
  const ctx = p.operations.contextAs(ops, "Admin");

  const snapshot = async () => ({
    fieldRecords: (await field.repository.all("alpha")).length,
    learningRecords: (await learning.repository.all("alpha")).length,
    fieldAudit: (await field.listAudit()).length,
    learningAudit: (await learning.listAudit()).length,
    fieldRevision: field.revision(),
    learningRevision: learning.revision(),
  });

  const before = await snapshot();
  const beforeLeads = (await ops.repository.all("leads")).length;

  await p.operations.leads.createLead(ctx, {
    displayName: "Isolation probe",
    source: "Referral",
    vehicleInterest: "Urban",
    priority: "Low",
  });
  const mutated = (await ops.repository.all("leads")).length;

  await ops.reset();
  const after = await snapshot();
  const afterLeads = (await ops.repository.all("leads")).length;
  const afterAudit = (await ops.listAudit()).length;

  /* A seed with no audit history must still clear audit on reset: the
     optional field must not have changed the demos that do not use it. */
  await field.reset();
  const fieldAuditAfterReset = (await field.listAudit()).length;
  const fieldAfterOwnReset = (await field.repository.all("alpha")).length;

  ops.dispose();
  field.dispose();
  learning.dispose();
  return {
    before,
    after,
    beforeLeads,
    mutated,
    afterLeads,
    afterAudit,
    fieldAuditAfterReset,
    fieldAfterOwnReset,
  };
});

check("an Operations mutation adds a lead",
  isolation.mutated === isolation.beforeLeads + 1,
  `${isolation.beforeLeads} -> ${isolation.mutated}`);
check("Operations reset returns its lead count",
  isolation.afterLeads === isolation.beforeLeads, String(isolation.afterLeads));
check("Operations reset restores its seeded audit",
  isolation.afterAudit === 63, String(isolation.afterAudit));
check("Field records are untouched",
  isolation.after.fieldRecords === isolation.before.fieldRecords,
  `${isolation.before.fieldRecords} -> ${isolation.after.fieldRecords}`);
check("Learning records are untouched",
  isolation.after.learningRecords === isolation.before.learningRecords,
  `${isolation.before.learningRecords} -> ${isolation.after.learningRecords}`);
check("Field revision is untouched",
  isolation.after.fieldRevision === isolation.before.fieldRevision);
check("Learning revision is untouched",
  isolation.after.learningRevision === isolation.before.learningRevision);
check("a seed with no audit history still resets to zero audit",
  isolation.fieldAuditAfterReset === 0, String(isolation.fieldAuditAfterReset));
check("that demo keeps its own records after its own reset",
  isolation.fieldAfterOwnReset === 2, String(isolation.fieldAfterOwnReset));

/* =====================================================================
   3b. CONTENT SAFETY

   Scans the seeded data itself, not the source. Names and message bodies are
   generated, so the only honest test is to read what the generator produced.
   ===================================================================== */

section("CONTENT SAFETY");
const content = await page.evaluate(async () => {
  const p = window.__opsProbe;
  const seed = p.buildOperationsSeed();
  const strings = [];
  const walkValue = (v) => {
    if (typeof v === "string") strings.push(v);
    else if (Array.isArray(v)) v.forEach(walkValue);
    else if (v && typeof v === "object") Object.values(v).forEach(walkValue);
  };
  for (const col of Object.values(seed.collections)) {
    for (const record of col.records) walkValue(record.data);
  }
  for (const entry of seed.audit ?? []) walkValue(entry);

  const patterns = {
    email: /[a-z0-9._%+-]+@[a-z0-9.-]+[.][a-z]{2,}/i,
    telephone: /[+]?[0-9][0-9\s().-]{7,}[0-9]/,
    url: /https?:[/][/]|www[.][a-z]/i,
    mailto: /mailto:/i,
    tel: /tel:/i,
    messaging: /wa[.]me|whatsapp|telegram|t[.]me[/]|discord/i,
    social: /(^|\s)@[a-z0-9_]{3,}/i,
    brand: /\b(honda|yamaha|suzuki|kawasaki|ducati|harley|vespa|piaggio|bajaj|ktm|bmw)\b/i,
  };

  /* ISO timestamps are digits, dots and dashes, so a naive telephone pattern
     matches every one of them. They are excluded before the digit patterns
     run: a date is not a phone number, and flagging it would train the next
     reader to ignore this check. */
  const isTimestamp = (v) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?$/.test(v);

  const hits = {};
  for (const [name, re] of Object.entries(patterns)) {
    hits[name] = strings
      .filter((v) => !isTimestamp(v))
      .filter((v) => re.test(v))
      .slice(0, 3);
  }
  return { total: strings.length, timestamps: strings.filter(isTimestamp).length, hits };
});

check("seed strings were scanned", content.total > 500,
  `${content.total} strings, ${content.timestamps} of them timestamps`);
for (const [name, found] of Object.entries(content.hits)) {
  check(`no ${name} in seeded content`, found.length === 0, found.join(" | "));
}

/* =====================================================================
   3c. REFRESH PERSISTENCE
   ===================================================================== */

section("REFRESH PERSISTENCE");
const written = await page.evaluate(async () => {
  const p = window.__opsProbe;
  await p.deleteDemoDatabase();
  const rt = p.operations.createOperationsRuntime({ latency: "instant", broadcast: false });
  await rt.initialize();
  const ctx = p.operations.contextAs(rt, "Admin");

  const lead = await p.operations.leads.createLead(ctx, {
    displayName: "Persisted Lead",
    source: "Referral",
    vehicleInterest: "Touring",
    priority: "Normal",
  });
  const contract = (await rt.repository.all("contracts")).find(
    (c) => c.data.status === "Active"
  );
  const paid = await p.operations.payments.recordPayment(ctx, {
    contractId: contract.id,
    amount: 500,
    category: "Adjustment",
  });
  const unread = (await rt.repository.all("notifications")).find((n) => !n.data.read);
  await p.operations.notifications.markNotificationRead(ctx, unread.id);

  const out = {
    leadId: lead.id,
    contractId: contract.id,
    paidAmount: paid.contract.data.paidAmount,
    notificationId: unread.id,
    revision: rt.revision(),
    mode: rt.persistenceMode(),
  };
  rt.dispose();
  return out;
});

await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => Boolean(window.__opsProbe));

const survived = await page.evaluate(async (before) => {
  const p = window.__opsProbe;
  const rt = p.operations.createOperationsRuntime({ latency: "instant", broadcast: false });
  await rt.initialize();
  const lead = await rt.repository.get("leads", before.leadId);
  const contract = await rt.repository.get("contracts", before.contractId);
  const note = await rt.repository.get("notifications", before.notificationId);
  const out = {
    leadName: lead ? lead.data.displayName : null,
    paidAmount: contract ? contract.data.paidAmount : null,
    read: note ? note.data.read : null,
    revision: rt.revision(),
    audit: (await rt.listAudit()).length,
    mode: rt.persistenceMode(),
  };
  rt.dispose();
  return out;
}, written);

check("persistence was IndexedDB", written.mode === "indexeddb" && survived.mode === "indexeddb");
check("the lead survived reload", survived.leadName === "Persisted Lead", String(survived.leadName));
check("the payment survived reload", survived.paidAmount === written.paidAmount,
  `${written.paidAmount} -> ${survived.paidAmount}`);
check("the read notification survived reload", survived.read === true);
check("the revision survived reload", survived.revision === written.revision,
  `${written.revision} -> ${survived.revision}`);
check("the audit trail grew past the seeded 63", survived.audit > 63, String(survived.audit));

/* =====================================================================
   3d. MEMORY FALLBACK
   ===================================================================== */

section("MEMORY FALLBACK");
const failCtx = await browser.newContext();
await failCtx.addInitScript(() => {
  const broken = {
    open() {
      const request = { onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      setTimeout(() => request.onerror && request.onerror(), 0);
      return request;
    },
    deleteDatabase() {
      const request = { onsuccess: null, onerror: null, onblocked: null };
      setTimeout(() => request.onsuccess && request.onsuccess(), 0);
      return request;
    },
  };
  Object.defineProperty(window, "indexedDB", { configurable: true, get: () => broken });
});
const failPage = await failCtx.newPage();
await failPage.goto(PROBE, { waitUntil: "networkidle" });
await failPage.waitForFunction(() => Boolean(window.__opsProbe));

const fallback = await failPage.evaluate(async () => {
  const p = window.__opsProbe;
  const rt = p.operations.createOperationsRuntime({ latency: "instant", broadcast: false });
  await rt.initialize();
  const ctx = p.operations.contextAs(rt, "Admin");

  const mode = rt.persistenceMode();
  const seeded = (await rt.repository.all("leads")).length;
  const audit = (await rt.listAudit()).length;

  const lead = await p.operations.leads.createLead(ctx, {
    displayName: "Fallback Lead",
    source: "Walk-in",
    vehicleInterest: "Urban",
    priority: "Low",
  });
  await p.operations.leads.changeLeadStage(ctx, lead.id, "Contacted");
  const converted = await p.operations.leads.convertLeadToCustomer(ctx, lead.id);

  const payments = await p.operations.payments.resolvedPayments(ctx);
  const overview = p.operations.overview.selectOverview({
    now: rt.now(),
    leads: await rt.repository.all("leads"),
    vehicles: await rt.repository.all("vehicles"),
    reservations: await rt.repository.all("reservations"),
    contracts: await rt.repository.all("contracts"),
    payments,
    maintenance: await rt.repository.all("maintenance"),
    notifications: await rt.repository.all("notifications"),
  });

  await rt.reset();
  const afterReset = {
    leads: (await rt.repository.all("leads")).length,
    audit: (await rt.listAudit()).length,
    revision: rt.revision(),
  };
  rt.dispose();
  return { mode, seeded, audit, converted: converted.customer.id, overview, afterReset };
});

check("a failed IndexedDB open falls back to memory", fallback.mode === "memory", fallback.mode);
check("the fallback seeds all 48 leads", fallback.seeded === 48, String(fallback.seeded));
check("the fallback seeds the 63 audit entries", fallback.audit === 63, String(fallback.audit));
check("a workflow completes on the fallback", fallback.converted.startsWith("customer_"), fallback.converted);
check("selectors work on the fallback", fallback.overview.vehiclesAvailable === 10,
  String(fallback.overview.vehiclesAvailable));
check("reset works on the fallback", fallback.afterReset.leads === 48 &&
  fallback.afterReset.audit === 63 && fallback.afterReset.revision === 0,
  JSON.stringify(fallback.afterReset));
await failCtx.close();

/* =====================================================================
   3e. PERFORMANCE SANITY

   A regression tripwire for this runtime in this browser. Not a benchmark,
   and never published as one.
   ===================================================================== */

section("PERFORMANCE SANITY");
const perf = await page.evaluate(async () => {
  const p = window.__opsProbe;
  await p.deleteDemoDatabase();
  const t = () => performance.now();

  const rt = p.operations.createOperationsRuntime({ latency: "instant", broadcast: false });
  const t0 = t();
  await rt.initialize();
  const seedMs = t() - t0;

  const ctx = p.operations.contextAs(rt, "Admin");

  const t1 = t();
  const payments = await p.operations.payments.resolvedPayments(ctx);
  p.operations.overview.selectOverview({
    now: rt.now(),
    leads: await rt.repository.all("leads"),
    vehicles: await rt.repository.all("vehicles"),
    reservations: await rt.repository.all("reservations"),
    contracts: await rt.repository.all("contracts"),
    payments,
    maintenance: await rt.repository.all("maintenance"),
    notifications: await rt.repository.all("notifications"),
  });
  const overviewMs = t() - t1;

  const t2 = t();
  p.operations.queries.queryList(await rt.repository.all("leads"), {
    search: "a",
    searchFields: ["displayName"],
    sortField: "displayName",
    page: 2,
    pageSize: 10,
  });
  const queryMs = t() - t2;

  const t3 = t();
  await rt.reset();
  const resetMs = t() - t3;

  rt.dispose();
  return {
    seedMs: Math.round(seedMs),
    overviewMs: Math.round(overviewMs),
    queryMs: Math.round(queryMs),
    resetMs: Math.round(resetMs),
  };
});
console.log(`  seed initialization ...... ${perf.seedMs}ms`);
console.log(`  Overview selector ........ ${perf.overviewMs}ms`);
console.log(`  Lead list query .......... ${perf.queryMs}ms`);
console.log(`  reset .................... ${perf.resetMs}ms`);
console.log("  QA SANITY MEASUREMENT - NOT A PRODUCTION BENCHMARK");
check("no operation exceeds two seconds",
  [perf.seedMs, perf.overviewMs, perf.queryMs, perf.resetMs].every((ms) => ms < 2000));

/* =====================================================================
   4. NETWORK AND CONSOLE
   ===================================================================== */

section("NETWORK");
const appRequests = requests.filter((u) => !u.startsWith("data:"));
const external = appRequests.filter((u) => !u.startsWith(BASE));
const api = appRequests.filter((u) => u.includes("/api/"));
check("no external request", external.length === 0, external.slice(0, 3).join(" "));
check("no API route call", api.length === 0, api.slice(0, 3).join(" "));
check("no console errors or warnings", consoleProblems.length === 0,
  consoleProblems.slice(0, 2).join(" | "));

await ctx.close();
await browser.close();

console.log(
  `\n=== stage09c1 operations: ${failures === 0 ? `ALL PASS (${checks} checks)` : `${failures} FAILURE(S) of ${checks}`} ===`
);
process.exit(failures === 0 ? 0 : 1);
