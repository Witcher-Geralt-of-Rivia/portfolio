/**
 * Operations demo — the seed, assembled.
 *
 * Turns the built bundle into the runtime's `DemoSeed` shape and provides the
 * integrity checker the QA harness runs against it.
 */

import type { DemoSeed, SeedCollection } from "@/demo-runtime/types";

import {
  C,
  DEFAULT_ROLE,
  OPERATIONS_BASE_CLOCK,
  OPERATIONS_CLOCK_TICK_MS,
  OPERATIONS_SEED_VERSION,
  P,
  SEED_COUNTS,
} from "../constants";
import { ROLES } from "../types";
import { buildOperationsSeedAudit } from "./audit";
import { buildOperationsSeedBundle, type SeedBundle } from "./entities";

const collection = <T>(idPrefix: string, records: { id: string; data: T }[]): SeedCollection => ({
  idPrefix,
  records,
});

export function buildOperationsSeed(): DemoSeed {
  const b = buildOperationsSeedBundle();

  return {
    demoId: "operations",
    seedVersion: OPERATIONS_SEED_VERSION,
    baseClock: OPERATIONS_BASE_CLOCK,
    clockTickMs: OPERATIONS_CLOCK_TICK_MS,
    collections: {
      [C.actors]: collection(P.actor, b.actors),
      [C.leads]: collection(P.lead, b.leads),
      [C.customers]: collection(P.customer, b.customers),
      [C.vehicles]: collection(P.vehicle, b.vehicles),
      [C.reservations]: collection(P.reservation, b.reservations),
      [C.contracts]: collection(P.contract, b.contracts),
      [C.payments]: collection(P.payment, b.payments),
      [C.maintenance]: collection(P.maintenance, b.maintenance),
      [C.conversations]: collection(P.conversation, b.conversations),
      [C.messages]: collection(P.message, b.messages),
      [C.automationRules]: collection(P.automationRule, b.automationRules),
      [C.automationRuns]: collection(P.automationRun, b.automationRuns),
      [C.notifications]: collection(P.notification, b.notifications),
    },
    initialRole: DEFAULT_ROLE,
    roles: ROLES,
    audit: buildOperationsSeedAudit(b, OPERATIONS_BASE_CLOCK),
  };
}

/* =====================================================================
   INTEGRITY

   The relationship contract, checked rather than assumed. Kept out of the
   application path — nothing in the product imports this — so it costs the
   demo nothing and the QA harness can still hold the seed to its promises.
   ===================================================================== */

export type IntegrityProblem = { check: string; detail: string };

export function assertOperationsSeedIntegrity(): IntegrityProblem[] {
  const b = buildOperationsSeedBundle();
  const audit = buildOperationsSeedAudit(b, OPERATIONS_BASE_CLOCK);
  const problems: IntegrityProblem[] = [];
  const fail = (check: string, detail: string) => problems.push({ check, detail });
  const expect = (check: string, actual: number, wanted: number) => {
    if (actual !== wanted) fail(check, `expected ${wanted}, got ${actual}`);
  };

  /* --- counts -------------------------------------------------------- */
  expect("actors", b.actors.length, SEED_COUNTS.actors);
  expect("leads", b.leads.length, SEED_COUNTS.leads);
  expect("customers", b.customers.length, SEED_COUNTS.customers);
  expect("vehicles", b.vehicles.length, SEED_COUNTS.vehicles);
  expect("reservations", b.reservations.length, SEED_COUNTS.reservations);
  expect("contracts", b.contracts.length, SEED_COUNTS.contracts);
  expect("payments", b.payments.length, SEED_COUNTS.payments);
  expect("maintenance", b.maintenance.length, SEED_COUNTS.maintenance);
  expect("conversations", b.conversations.length, SEED_COUNTS.conversations);
  expect("messages", b.messages.length, SEED_COUNTS.messages);
  expect("automationRules", b.automationRules.length, SEED_COUNTS.automationRules);
  expect("automationRuns", b.automationRuns.length, SEED_COUNTS.automationRuns);
  expect("notifications", b.notifications.length, SEED_COUNTS.notifications);
  expect("audit", audit.length, SEED_COUNTS.audit);

  /* --- the four relationship identities ------------------------------ */
  const rented = b.vehicles.filter((v) => v.data.status === "Rented");
  const activeContracts = b.contracts.filter((c) => c.data.status === "Active");
  expect("Rented vehicles", rented.length, 7);
  expect("Active contracts", activeContracts.length, 7);
  for (const c of activeContracts) {
    if (!rented.some((v) => v.id === c.data.vehicleId)) {
      fail("Active contract maps to a Rented vehicle", `${c.id} -> ${c.data.vehicleId}`);
    }
  }

  const reserved = b.vehicles.filter((v) => v.data.status === "Reserved");
  const confirmed = b.reservations.filter((r) => r.data.status === "Confirmed");
  expect("Reserved vehicles", reserved.length, 4);
  expect("Confirmed reservations", confirmed.length, 4);
  for (const r of confirmed) {
    if (!r.data.vehicleId) fail("Confirmed reservation has a vehicle", r.id);
    else if (!reserved.some((v) => v.id === r.data.vehicleId)) {
      fail("Confirmed reservation maps to a Reserved vehicle", `${r.id} -> ${r.data.vehicleId}`);
    }
  }

  const inMaintenance = b.vehicles.filter((v) => v.data.status === "Maintenance");
  const activeWork = b.maintenance.filter(
    (w) => w.data.status === "Open" || w.data.status === "In Progress"
  );
  expect("Maintenance vehicles", inMaintenance.length, 3);
  expect("active work orders", activeWork.length, 3);
  for (const w of activeWork) {
    if (!inMaintenance.some((v) => v.id === w.data.vehicleId)) {
      fail("active work order maps to a Maintenance vehicle", `${w.id} -> ${w.data.vehicleId}`);
    }
  }

  const wonLeads = b.leads.filter((l) => l.data.stage === "Won");
  expect("Won leads", wonLeads.length, 6);
  for (const lead of wonLeads) {
    const customerId = lead.data.convertedCustomerId;
    if (!customerId) {
      fail("Won lead carries convertedCustomerId", lead.id);
      continue;
    }
    const customer = b.customers.find((c) => c.id === customerId);
    if (!customer) fail("convertedCustomerId resolves", `${lead.id} -> ${customerId}`);
    else if (customer.data.sourceLeadId !== lead.id) {
      fail(
        "lead and customer point at each other",
        `${lead.id} -> ${customerId} -> ${customer.data.sourceLeadId ?? "none"}`
      );
    }
  }
  expect(
    "customers carrying sourceLeadId",
    b.customers.filter((c) => c.data.sourceLeadId).length,
    6
  );

  /* --- referential integrity ----------------------------------------- */
  const has = (rows: { id: string }[], target: string) => rows.some((r) => r.id === target);

  for (const c of b.contracts) {
    if (!has(b.customers, c.data.customerId)) fail("contract customer exists", c.id);
    if (!has(b.vehicles, c.data.vehicleId)) fail("contract vehicle exists", c.id);
    if (c.data.reservationId && !has(b.reservations, c.data.reservationId)) {
      fail("contract reservation exists", c.id);
    }
    if (c.data.paidAmount > c.data.totalAmount) {
      fail("contract is not overpaid", `${c.id}: ${c.data.paidAmount} > ${c.data.totalAmount}`);
    }
  }
  for (const p of b.payments) {
    if (!has(b.contracts, p.data.contractId)) fail("payment contract exists", p.id);
    if (!has(b.customers, p.data.customerId)) fail("payment customer exists", p.id);
    if (p.data.amount <= 0) fail("payment amount is positive", p.id);
    if (!Number.isInteger(p.data.amount)) fail("payment amount is integer cents", p.id);
  }
  for (const r of b.reservations) {
    if (!has(b.customers, r.data.customerId)) fail("reservation customer exists", r.id);
    if (r.data.vehicleId && !has(b.vehicles, r.data.vehicleId)) {
      fail("reservation vehicle exists", r.id);
    }
  }
  for (const w of b.maintenance) {
    if (!has(b.vehicles, w.data.vehicleId)) fail("work order vehicle exists", w.id);
  }
  for (const conv of b.conversations) {
    const pool = conv.data.subjectType === "Lead" ? b.leads : b.customers;
    if (!has(pool, conv.data.subjectId)) fail("conversation subject exists", conv.id);
  }
  for (const m of b.messages) {
    if (!has(b.conversations, m.data.conversationId)) fail("message conversation exists", m.id);
  }
  for (const run of b.automationRuns) {
    if (!has(b.automationRules, run.data.ruleId)) fail("automation run rule exists", run.id);
  }
  for (const note of b.notifications) {
    if (!note.data.sourceEntityId) continue;
    const pools = [
      b.leads,
      b.customers,
      b.vehicles,
      b.reservations,
      b.contracts,
      b.payments,
      b.maintenance,
      b.automationRuns,
    ];
    if (!pools.some((pool) => has(pool, note.data.sourceEntityId as string))) {
      fail("notification source exists", `${note.id} -> ${note.data.sourceEntityId}`);
    }
  }

  /* --- conversations and messages ------------------------------------ */
  for (const conv of b.conversations) {
    const thread = b.messages.filter((m) => m.data.conversationId === conv.id);
    if (thread.length < 2) fail("conversation has at least two messages", conv.id);
    for (let i = 1; i < thread.length; i++) {
      if (Date.parse(thread[i].data.sentAt) < Date.parse(thread[i - 1].data.sentAt)) {
        fail("messages are in order", `${conv.id} at ${thread[i].id}`);
      }
    }
  }

  /* --- audit ---------------------------------------------------------- */
  const base = Date.parse(OPERATIONS_BASE_CLOCK);
  const allIds = [
    ...b.leads,
    ...b.customers,
    ...b.vehicles,
    ...b.reservations,
    ...b.contracts,
    ...b.payments,
    ...b.maintenance,
  ].map((r) => r.id);
  const actorIds = b.actors.map((a) => a.id);
  for (const entry of audit) {
    if (entry.entityId && !allIds.includes(entry.entityId)) {
      fail("audit entity exists", `${entry.action} -> ${entry.entityId}`);
    }
    if (!actorIds.includes(entry.actor)) fail("audit actor exists", entry.actor);
    if (Date.parse(entry.occurredAt) > base) {
      fail("audit is not in the future", `${entry.action} at ${entry.occurredAt}`);
    }
  }

  return problems;
}

export type { SeedBundle };
export { buildOperationsSeedBundle };
