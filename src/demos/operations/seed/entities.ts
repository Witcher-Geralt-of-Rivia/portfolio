/**
 * Operations demo: the canonical dataset.
 *
 * Built by deterministic functions rather than hand-authored objects: 301
 * literal records would be unreadable and impossible to keep consistent, and
 * the relationships between them are the part that actually matters.
 *
 * Everything here is derived from a fixed base instant and fixed index
 * arithmetic. There is no `Math.random`, no `Date.now()` and no generated id:
 * two resets produce byte-identical state, which is what makes reset mean
 * reset and screenshots reproducible.
 *
 * The interlocking identities the specification freezes:
 *
 * ```
 * 7 Active contracts        are the 7 Rented vehicles
 * 4 Confirmed reservations  are the 4 Reserved vehicles
 * 2 Open + 1 In Progress    are the 3 Maintenance vehicles
 * 6 Won leads               are the 6 customers carrying sourceLeadId
 * ```
 *
 * They are produced here by construction (the vehicle pools below are carved
 * up once and never overlap) rather than asserted afterwards and hoped for.
 */

import { formatId } from "@/demo-runtime/ids";
import type { SeedRecord } from "@/demo-runtime/types";

import {
  DAY_MS,
  HOUR_MS,
  MODELS_BY_CLASS,
  OPERATIONS_BASE_CLOCK,
  P,
  SEED_DISTRIBUTION,
} from "../constants";
import { contractTotalCents, dailyRateForVehicle } from "../selectors/derive";
import type {
  Actor,
  AutomationRule,
  AutomationRun,
  Contract,
  Conversation,
  Customer,
  Lead,
  MaintenanceWorkOrder,
  Message,
  Notification,
  Payment,
  Reservation,
  ServiceArea,
  Vehicle,
  VehicleClass,
} from "../types";
import {
  businessName,
  customerMessage,
  customerNote,
  maintenanceSummary,
  personName,
  staffMessage,
} from "./names";

/* =====================================================================
   HELPERS
   ===================================================================== */

const BASE_MS = Date.parse(OPERATIONS_BASE_CLOCK);

/** An instant offset from the canonical base, truncated to whole seconds. */
function at(offsetMs: number): string {
  return new Date(Math.floor((BASE_MS + offsetMs) / 1000) * 1000).toISOString();
}

/** Expand `{ New: 12, Contacted: 10 }` into twelve "New"s then ten "Contacted"s. */
function expand<T extends string>(dist: Record<T, number>): T[] {
  const out: T[] = [];
  for (const key of Object.keys(dist) as T[]) {
    for (let i = 0; i < dist[key]; i++) out.push(key);
  }
  return out;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * A fixed reordering of an expanded distribution.
 *
 * Without it every list would open with twelve consecutive "New" leads, which
 * reads as generated data rather than as a business. Walking the array with a
 * stride coprime to its length visits every element exactly once, so the
 * counts are untouched and the order is still completely determined.
 */
function interleave<T>(items: T[], seed = 7): T[] {
  const n = items.length;
  if (n < 2) return [...items];
  let stride = (seed % n) + 1;
  while (gcd(stride, n) !== 1) stride = (stride % n) + 1;
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(items[(i * stride) % n]);
  return out;
}

const id = (prefix: string, n: number) => formatId(prefix, n);

export type SeedBundle = {
  actors: SeedRecord<Actor>[];
  leads: SeedRecord<Lead>[];
  customers: SeedRecord<Customer>[];
  vehicles: SeedRecord<Vehicle>[];
  reservations: SeedRecord<Reservation>[];
  contracts: SeedRecord<Contract>[];
  payments: SeedRecord<Payment>[];
  maintenance: SeedRecord<MaintenanceWorkOrder>[];
  conversations: SeedRecord<Conversation>[];
  messages: SeedRecord<Message>[];
  automationRules: SeedRecord<AutomationRule>[];
  automationRuns: SeedRecord<AutomationRun>[];
  notifications: SeedRecord<Notification>[];
};

/* =====================================================================
   1. ACTORS
   ===================================================================== */

const ACTOR_SEED: Actor[] = [
  { displayName: "Morgan Reed", role: "Admin", active: true },
  { displayName: "Avery Chen", role: "Sales Agent", active: true },
  { displayName: "Jordan Blake", role: "Fleet Coordinator", active: true },
  { displayName: "Taylor Quinn", role: "Finance Analyst", active: true },
];

export const ACTOR_IDS = {
  admin: id(P.actor, 1),
  sales: id(P.actor, 2),
  fleet: id(P.actor, 3),
  finance: id(P.actor, 4),
} as const;

function buildActors(): SeedRecord<Actor>[] {
  return ACTOR_SEED.map((data, i) => ({ id: id(P.actor, i + 1), data }));
}

/* =====================================================================
   2. VEHICLES

   The pools are carved here and every later entity draws from them, which is
   what makes the status identities hold by construction.

   index  0- 6   seven Rented      an Active contract
   index  7-10   four Reserved     a Confirmed reservation
   index 11-13   three Maintenance an Open or In Progress work order
   index 14-23   ten Available     only inactive history touches these
   ===================================================================== */

export const POOL = {
  rented: [0, 1, 2, 3, 4, 5, 6],
  reserved: [7, 8, 9, 10],
  maintenance: [11, 12, 13],
  available: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
} as const;

const VEHICLE_CLASS_BY_INDEX: VehicleClass[] = [
  ...Array<VehicleClass>(10).fill("Urban"),
  ...Array<VehicleClass>(7).fill("Touring"),
  ...Array<VehicleClass>(7).fill("Utility"),
];

const AREAS: ServiceArea[] = ["Central", "North", "East", "South"];

function buildVehicles(): SeedRecord<Vehicle>[] {
  return VEHICLE_CLASS_BY_INDEX.map((vehicleClass, i) => {
    const models = MODELS_BY_CLASS[vehicleClass];
    return {
      id: id(P.vehicle, i + 1),
      data: {
        assetCode: `MTR-${String(i + 1).padStart(3, "0")}`,
        modelLabel: models[i % models.length],
        vehicleClass,
        /* Seeded as Available; `applyDerivedVehicleState` rewrites every one
           from the relationships once the rest of the dataset exists, so the
           stored value can never be an independent claim. */
        status: "Available",
        odometerKm: 4200 + i * 317,
        serviceArea: AREAS[i % AREAS.length],
      },
    };
  });
}

const vehicleId = (index: number) => id(P.vehicle, index + 1);
const vehicleClassAt = (index: number) => VEHICLE_CLASS_BY_INDEX[index];

/* =====================================================================
   3. LEADS
   ===================================================================== */

function buildLeads(): SeedRecord<Lead>[] {
  const stages = interleave(expand(SEED_DISTRIBUTION.leadStage), 11);
  const sources = interleave(expand(SEED_DISTRIBUTION.leadSource), 13);
  const priorities = interleave(expand(SEED_DISTRIBUTION.leadPriority), 5);
  const classes: VehicleClass[] = ["Urban", "Touring", "Utility"];

  /* Won leads are dealt out in index order so the six that carry a converted
     customer are the six the customer seed points back at. */
  let wonSeen = 0;

  return stages.map((stage, i) => {
    const won = stage === "Won";
    const convertedCustomerId = won ? id(P.customer, ++wonSeen) : undefined;
    const createdOffset = -(90 - (i % 90)) * DAY_MS;

    return {
      id: id(P.lead, i + 1),
      data: {
        displayName: personName(i),
        source: sources[i],
        stage,
        vehicleInterest: classes[i % 3],
        /* Website leads are the ones Rule 01 would have assigned. */
        assignedActorId: sources[i] === "Website" ? ACTOR_IDS.sales : null,
        priority: priorities[i],
        lastActivityAt: at(createdOffset + (i % 7) * DAY_MS),
        nextFollowUpAt:
          stage === "Qualified" || stage === "Proposal"
            ? at((i % 5) * DAY_MS + 2 * DAY_MS)
            : null,
        ...(convertedCustomerId ? { convertedCustomerId } : {}),
        archived: false,
      },
    };
  });
}

/* =====================================================================
   4. CUSTOMERS

   The first six mirror the six Won leads. The remaining twenty-six are
   established customers with no originating lead.
   ===================================================================== */

function buildCustomers(leads: SeedRecord<Lead>[]): SeedRecord<Customer>[] {
  const wonLeadIds = leads.filter((l) => l.data.stage === "Won").map((l) => l.id);
  const statuses = interleave(expand(SEED_DISTRIBUTION.customerStatus), 9);
  const segments = interleave(expand(SEED_DISTRIBUTION.customerSegment), 3);

  return statuses.map((status, i) => {
    const segment = segments[i];
    const sourceLeadId = i < wonLeadIds.length ? wonLeadIds[i] : undefined;
    return {
      id: id(P.customer, i + 1),
      data: {
        displayName: segment === "Business" ? businessName(i) : personName(i + 60),
        status,
        segment,
        ...(sourceLeadId ? { sourceLeadId } : {}),
        notes: customerNote(i),
        archived: false,
      },
    };
  });
}

/* =====================================================================
   5. RESERVATIONS

   Confirmed  4  → the four Reserved vehicles, all with a vehicle assigned
   Converted  7  → became the seven Active contracts
   Draft      4  → no vehicle chosen yet, which is what Draft means here
   Cancelled  3  → a vehicle was chosen and then released
   ===================================================================== */

function buildReservations(): SeedRecord<Reservation>[] {
  const rows: SeedRecord<Reservation>[] = [];
  let n = 0;
  const next = () => id(P.reservation, ++n);

  // Converted: one per Active contract, sharing that contract's vehicle.
  for (let i = 0; i < 7; i++) {
    const v = POOL.rented[i];
    rows.push({
      id: next(),
      data: {
        customerId: id(P.customer, i + 1),
        vehicleId: vehicleId(v),
        vehicleClass: vehicleClassAt(v),
        startAt: at(-(10 - i) * DAY_MS),
        endAt: at((4 + i) * DAY_MS),
        status: "Converted",
        notes: "",
        convertedContractId: id(P.contract, i + 1),
      },
    });
  }

  // Confirmed: the four Reserved vehicles, starting in the near future.
  for (let i = 0; i < 4; i++) {
    const v = POOL.reserved[i];
    rows.push({
      id: next(),
      data: {
        customerId: id(P.customer, 8 + i),
        vehicleId: vehicleId(v),
        vehicleClass: vehicleClassAt(v),
        startAt: at((2 + i) * DAY_MS + 9 * HOUR_MS),
        endAt: at((6 + i) * DAY_MS + 9 * HOUR_MS),
        status: "Confirmed",
        notes: "",
      },
    });
  }

  // Draft: no vehicle chosen.
  for (let i = 0; i < 4; i++) {
    rows.push({
      id: next(),
      data: {
        customerId: id(P.customer, 12 + i),
        vehicleClass: (["Urban", "Touring", "Utility"] as const)[i % 3],
        startAt: at((7 + i) * DAY_MS + 10 * HOUR_MS),
        endAt: at((10 + i) * DAY_MS + 10 * HOUR_MS),
        status: "Draft",
        notes: "",
      },
    });
  }

  // Cancelled: released, so they hold nothing.
  for (let i = 0; i < 3; i++) {
    const v = POOL.available[i];
    rows.push({
      id: next(),
      data: {
        customerId: id(P.customer, 16 + i),
        vehicleId: vehicleId(v),
        vehicleClass: vehicleClassAt(v),
        startAt: at(-(20 + i) * DAY_MS),
        endAt: at(-(16 + i) * DAY_MS),
        status: "Cancelled",
        notes: "",
      },
    });
  }

  return rows;
}

/* =====================================================================
   6. CONTRACTS

   Active     7  → the seven Rented vehicles, each from a Converted reservation
   Pending    3  → not yet started, on Available vehicles
   Completed  3  → finished, on Available vehicles
   Cancelled  1  → on an Available vehicle
   ===================================================================== */

function buildContracts(): SeedRecord<Contract>[] {
  const rows: SeedRecord<Contract>[] = [];
  let n = 0;

  const push = (
    vehicleIndex: number,
    customerIndex: number,
    status: Contract["status"],
    startOffsetDays: number,
    endOffsetDays: number,
    reservationId?: string
  ) => {
    const dailyRate = dailyRateForVehicle(vehicleClassAt(vehicleIndex), vehicleIndex);
    const startAt = at(startOffsetDays * DAY_MS + 9 * HOUR_MS);
    const endAt = at(endOffsetDays * DAY_MS + 9 * HOUR_MS);
    rows.push({
      id: id(P.contract, ++n),
      data: {
        customerId: id(P.customer, customerIndex),
        vehicleId: vehicleId(vehicleIndex),
        ...(reservationId ? { reservationId } : {}),
        status,
        startAt,
        endAt,
        dailyRate,
        totalAmount: contractTotalCents(dailyRate, startAt, endAt),
        paidAmount: 0,
      },
    });
  };

  // Active: contract_0001..0007 on the rented pool, from reservations 1..7.
  for (let i = 0; i < 7; i++) {
    push(POOL.rented[i], i + 1, "Active", -(10 - i), 4 + i, id(P.reservation, i + 1));
  }
  // Completed: contract_0008..0010.
  for (let i = 0; i < 3; i++) {
    push(POOL.available[3 + i], 20 + i, "Completed", -(40 + i), -(33 + i));
  }
  // Pending: contract_0011..0013.
  for (let i = 0; i < 3; i++) {
    push(POOL.available[6 + i], 24 + i, "Pending", 12 + i, 17 + i);
  }
  // Cancelled: contract_0014.
  push(POOL.available[9], 28, "Cancelled", -(8), -(3));

  return rows;
}

/* =====================================================================
   7. PAYMENTS

   Every payment draws from its contract's total, so the sum of a contract's
   payments can never exceed what the contract is worth and `paidAmount` stays
   a truthful subtotal.

   Rental 18 · Deposit 6 · Adjustment 2 = 26
   stored Paid 18 · stored Pending 8, three of which are past due and so read
   as Overdue against the logical clock.
   ===================================================================== */

/** How many payments each contract carries, and of which category. */
const PAYMENT_PLAN: { contract: number; categories: Payment["category"][] }[] = [
  { contract: 1, categories: ["Rental", "Rental", "Deposit", "Adjustment"] },
  { contract: 2, categories: ["Rental", "Rental", "Deposit", "Adjustment"] },
  { contract: 3, categories: ["Rental", "Rental", "Deposit"] },
  { contract: 4, categories: ["Rental", "Rental", "Deposit"] },
  { contract: 5, categories: ["Rental", "Rental", "Deposit"] },
  { contract: 6, categories: ["Rental", "Rental", "Deposit"] },
  { contract: 7, categories: ["Rental", "Rental"] },
  { contract: 8, categories: ["Rental"] },
  { contract: 9, categories: ["Rental"] },
  { contract: 10, categories: ["Rental"] },
  { contract: 11, categories: ["Rental"] },
];

function buildPayments(contracts: SeedRecord<Contract>[]): SeedRecord<Payment>[] {
  const rows: SeedRecord<Payment>[] = [];
  let n = 0;

  /* Paid where the category is a Deposit, or the contract has already
     finished. Of the Active contracts' rentals, the first nine are settled and
     the rest are outstanding, three of them past their due date. */
  let activeRentalSeen = 0;
  let overdueRemaining = 3;

  for (const plan of PAYMENT_PLAN) {
    const contract = contracts[plan.contract - 1];
    const total = contract.data.totalAmount;
    const parts = plan.categories.length;
    const share = Math.floor(total / parts);

    plan.categories.forEach((category, i) => {
      /* The last part absorbs the remainder, so the parts sum to the total
         exactly and no cent is created or lost. */
      const amount = i === parts - 1 ? total - share * (parts - 1) : share;

      let paid: boolean;
      if (category === "Deposit") paid = true;
      else if (contract.data.status === "Completed") paid = true;
      else if (category === "Adjustment") paid = false;
      else if (contract.data.status === "Active") paid = ++activeRentalSeen <= 9;
      else paid = false;

      const overdue = !paid && overdueRemaining > 0 && category === "Rental";
      if (overdue) overdueRemaining -= 1;

      const dueOffset = paid
        ? -(12 + (n % 9)) * DAY_MS
        : overdue
          ? -(2 + (n % 4)) * DAY_MS
          : (5 + (n % 9)) * DAY_MS;

      rows.push({
        id: id(P.payment, ++n),
        data: {
          contractId: contract.id,
          customerId: contract.data.customerId,
          amount,
          status: paid ? "Paid" : "Pending",
          dueAt: at(dueOffset),
          ...(paid ? { paidAt: at(dueOffset + 1 * DAY_MS) } : {}),
          category,
        },
      });
    });
  }

  return rows;
}

/** Fold each contract's settled payments back into its `paidAmount`. */
function applyPaidAmounts(
  contracts: SeedRecord<Contract>[],
  payments: SeedRecord<Payment>[]
): void {
  for (const contract of contracts) {
    contract.data.paidAmount = payments
      .filter((p) => p.data.contractId === contract.id && p.data.status === "Paid")
      .reduce((sum, p) => sum + p.data.amount, 0);
  }
}

/* =====================================================================
   8. MAINTENANCE

   Open 2 + In Progress 1 occupy the three Maintenance vehicles. Completed 6
   and Cancelled 1 are history on Available vehicles and hold nothing.
   ===================================================================== */

function buildMaintenance(): SeedRecord<MaintenanceWorkOrder>[] {
  const rows: SeedRecord<MaintenanceWorkOrder>[] = [];
  let n = 0;
  const types: MaintenanceWorkOrder["type"][] = ["Inspection", "Preventive", "Repair"];
  const priorities: MaintenanceWorkOrder["priority"][] = ["Routine", "Soon", "High"];

  const push = (
    vehicleIndex: number,
    status: MaintenanceWorkOrder["status"],
    openedDays: number,
    startedDays?: number,
    completedDays?: number
  ) => {
    const i = n;
    rows.push({
      id: id(P.maintenance, ++n),
      data: {
        vehicleId: vehicleId(vehicleIndex),
        type: types[i % 3],
        priority: priorities[i % 3],
        status,
        openedAt: at(openedDays * DAY_MS + 8 * HOUR_MS),
        ...(startedDays !== undefined ? { startedAt: at(startedDays * DAY_MS + 9 * HOUR_MS) } : {}),
        ...(completedDays !== undefined
          ? { completedAt: at(completedDays * DAY_MS + 15 * HOUR_MS) }
          : {}),
        summary: maintenanceSummary(i),
      },
    });
  };

  push(POOL.maintenance[0], "Open", -2);
  push(POOL.maintenance[1], "Open", -1);
  push(POOL.maintenance[2], "In Progress", -3, -2);
  for (let i = 0; i < 6; i++) {
    push(POOL.available[i], "Completed", -(30 + i), -(29 + i), -(28 + i));
  }
  push(POOL.available[6], "Cancelled", -(25), undefined, undefined);

  return rows;
}

/* =====================================================================
   9. CONVERSATIONS AND MESSAGES

   Twenty conversations: eleven about leads, nine about customers.
   Sixty-four messages: sixteen threads of three and four of four.
   ===================================================================== */

function buildConversations(
  leads: SeedRecord<Lead>[],
  customers: SeedRecord<Customer>[]
): { conversations: SeedRecord<Conversation>[]; messages: SeedRecord<Message>[] } {
  const channels = interleave(expand(SEED_DISTRIBUTION.conversationChannel), 5);
  const statuses = interleave(expand(SEED_DISTRIBUTION.conversationStatus), 3);

  const conversations: SeedRecord<Conversation>[] = [];
  const messages: SeedRecord<Message>[] = [];
  let messageNo = 0;

  for (let i = 0; i < 20; i++) {
    const onLead = i < SEED_DISTRIBUTION.conversationSubject.Lead;
    const subjectId = onLead ? leads[i * 2].id : customers[(i - 11) * 3].id;
    const conversationId = id(P.conversation, i + 1);

    conversations.push({
      id: conversationId,
      data: {
        subjectType: onLead ? "Lead" : "Customer",
        subjectId,
        channel: channels[i],
        assignedActorId: ACTOR_IDS.sales,
        status: statuses[i],
        /* Six unread, taken from the front so the count is exact. */
        unread: i < SEED_DISTRIBUTION.conversationUnread,
      },
    });

    /* Three messages per thread, four on the last four, which is 64 exactly.
       Timestamps step forward within a thread so a transcript reads in order. */
    const count = i >= 16 ? 4 : 3;
    const openedAt = -(14 - (i % 12)) * DAY_MS;
    for (let m = 0; m < count; m++) {
      const author = m === 0 ? "Customer" : m % 2 === 1 ? "Staff" : "Customer";
      messages.push({
        id: id(P.message, ++messageNo),
        data: {
          conversationId,
          authorType: author,
          ...(author === "Staff" ? { actorId: ACTOR_IDS.sales } : {}),
          body:
            author === "Customer"
              ? customerMessage(i + m)
              : staffMessage(i + m),
          sentAt: at(openedAt + m * 3 * HOUR_MS),
        },
      });
    }
  }

  return { conversations, messages };
}

/* =====================================================================
   10. AUTOMATION
   ===================================================================== */

const RULE_SEED: AutomationRule[] = [
  {
    name: "New website lead assignment",
    trigger: "lead.created.website",
    action: "Assign the next Sales Agent and raise a CRM notification",
    enabled: true,
    runCount: 0,
  },
  {
    name: "Qualified lead follow-up",
    trigger: "lead.qualified",
    action: "Set the follow-up date two days ahead and raise a CRM notification",
    enabled: true,
    runCount: 0,
  },
  {
    name: "Reservation confirmation message",
    trigger: "reservation.confirmed",
    action: "Append a System message to the customer's conversation",
    enabled: true,
    runCount: 0,
  },
  {
    name: "Overdue payment alert",
    trigger: "payment.overdue",
    action: "Raise a Finance notification",
    enabled: true,
    runCount: 0,
  },
  {
    name: "Maintenance completion notice",
    trigger: "maintenance.completed",
    action: "Raise a Maintenance notification",
    enabled: true,
    runCount: 0,
  },
];

function buildAutomation(): {
  rules: SeedRecord<AutomationRule>[];
  runs: SeedRecord<AutomationRun>[];
} {
  const statuses = interleave(expand(SEED_DISTRIBUTION.automationRunStatus), 5);
  const runs: SeedRecord<AutomationRun>[] = [];

  const counts = [0, 0, 0, 0, 0];
  const lastRun: (string | undefined)[] = [undefined, undefined, undefined, undefined, undefined];

  for (let i = 0; i < 18; i++) {
    const ruleIndex = i % 5;
    const startedAt = at(-(18 - i) * DAY_MS + 11 * HOUR_MS);
    const status = statuses[i];
    counts[ruleIndex] += 1;
    lastRun[ruleIndex] = startedAt;

    runs.push({
      id: id(P.automationRun, i + 1),
      data: {
        ruleId: id(P.automationRule, ruleIndex + 1),
        sourceEventId: `seed_event_${String(i + 1).padStart(4, "0")}`,
        status,
        startedAt,
        completedAt: at(-(18 - i) * DAY_MS + 11 * HOUR_MS + 2000),
        summary:
          status === "Success"
            ? `${RULE_SEED[ruleIndex].name} completed`
            : status === "Skipped"
              ? `${RULE_SEED[ruleIndex].name} skipped: rule disabled at the time`
              : `${RULE_SEED[ruleIndex].name} failed: referenced record was already archived`,
      },
    });
  }

  const rules = RULE_SEED.map((data, i) => ({
    id: id(P.automationRule, i + 1),
    data: { ...data, runCount: counts[i], ...(lastRun[i] ? { lastRunAt: lastRun[i] } : {}) },
  }));

  return { rules, runs };
}

/* =====================================================================
   11. NOTIFICATIONS

   Twenty-two across all five categories, eight unread. Every source id points
   at a record that exists.
   ===================================================================== */

function buildNotifications(
  leads: SeedRecord<Lead>[],
  contracts: SeedRecord<Contract>[],
  payments: SeedRecord<Payment>[],
  maintenance: SeedRecord<MaintenanceWorkOrder>[],
  reservations: SeedRecord<Reservation>[],
  runs: SeedRecord<AutomationRun>[]
): SeedRecord<Notification>[] {
  const rows: SeedRecord<Notification>[] = [];
  let n = 0;

  const push = (
    category: Notification["category"],
    title: string,
    body: string,
    sourceEntityType: string,
    sourceEntityId: string,
    actorRole: Notification["actorRole"]
  ) => {
    rows.push({
      id: id(P.notification, ++n),
      data: {
        actorRole,
        category,
        title,
        body,
        /* Eight unread, taken from the front so the badge count is exact. */
        read: n > SEED_DISTRIBUTION.notificationUnread,
        sourceEntityType,
        sourceEntityId,
      },
    });
  };

  const cats = SEED_DISTRIBUTION.notificationCategory;

  for (let i = 0; i < cats.CRM; i++) {
    const lead = leads[i * 3];
    push("CRM", "Lead assigned", `${lead.data.displayName} was assigned for follow-up.`,
      "lead", lead.id, "Sales Agent");
  }
  for (let i = 0; i < cats.Reservation; i++) {
    const r = reservations[7 + i];
    push("Reservation", "Reservation confirmed", "A reservation was confirmed and a vehicle assigned.",
      "reservation", r.id, "Fleet Coordinator");
  }
  for (let i = 0; i < cats.Finance; i++) {
    const p = payments[i * 4];
    push("Finance", "Payment attention", "A payment on this contract needs attention.",
      "payment", p.id, "Finance Analyst");
  }
  for (let i = 0; i < cats.Maintenance; i++) {
    const w = maintenance[3 + i];
    push("Maintenance", "Work order completed", "A maintenance work order was completed.",
      "maintenance", w.id, "Fleet Coordinator");
  }
  for (let i = 0; i < cats.Automation; i++) {
    const run = runs[i * 5];
    push("Automation", "Automation run", "An automation rule finished a run.",
      "automation_run", run.id, "Admin");
  }

  /* Contracts are referenced by the Finance set above through their payments;
     this keeps the unused parameter honest rather than silently ignored. */
  void contracts;

  return rows;
}

/* =====================================================================
   12. DERIVED VEHICLE STATE

   Written last, from the relationships, so the stored status is a cache of the
   derivation rather than an independent claim.
   ===================================================================== */

function applyDerivedVehicleState(bundle: SeedBundle): void {
  for (const vehicle of bundle.vehicles) {
    const activeWork = bundle.maintenance.find(
      (w) =>
        w.data.vehicleId === vehicle.id &&
        (w.data.status === "Open" || w.data.status === "In Progress")
    );
    const activeContract = bundle.contracts.find(
      (c) => c.data.vehicleId === vehicle.id && c.data.status === "Active"
    );
    const confirmedReservation = bundle.reservations.find(
      (r) => r.data.vehicleId === vehicle.id && r.data.status === "Confirmed"
    );

    vehicle.data.status = activeWork
      ? "Maintenance"
      : activeContract
        ? "Rented"
        : confirmedReservation
          ? "Reserved"
          : "Available";

    if (activeContract) vehicle.data.currentContractId = activeContract.id;
    if (confirmedReservation) vehicle.data.currentReservationId = confirmedReservation.id;
    if (activeWork) vehicle.data.activeMaintenanceId = activeWork.id;
  }
}

/* =====================================================================
   BUILD
   ===================================================================== */

export function buildOperationsSeedBundle(): SeedBundle {
  const actors = buildActors();
  const vehicles = buildVehicles();
  const leads = buildLeads();
  const customers = buildCustomers(leads);
  const reservations = buildReservations();
  const contracts = buildContracts();
  const payments = buildPayments(contracts);
  applyPaidAmounts(contracts, payments);
  const maintenance = buildMaintenance();
  const { conversations, messages } = buildConversations(leads, customers);
  const { rules, runs } = buildAutomation();
  const notifications = buildNotifications(
    leads,
    contracts,
    payments,
    maintenance,
    reservations,
    runs
  );

  const bundle: SeedBundle = {
    actors,
    leads,
    customers,
    vehicles,
    reservations,
    contracts,
    payments,
    maintenance,
    conversations,
    messages,
    automationRules: rules,
    automationRuns: runs,
    notifications,
  };

  applyDerivedVehicleState(bundle);
  return bundle;
}
