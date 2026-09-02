/**
 * Operations demo: frozen constants.
 *
 * Every value here comes from `docs/DEMO_OPERATIONS_SPEC.md` and is guarded by
 * `qa/stage09b-operations-spec.mjs`. Changing one means changing the
 * specification first.
 */

import type {
  ModelLabel,
  NotificationCategory,
  Role,
  VehicleClass,
} from "./types";

/** Collection names, matching the spec's table exactly. */
export const C = {
  actors: "actors",
  leads: "leads",
  customers: "customers",
  vehicles: "vehicles",
  reservations: "reservations",
  contracts: "contracts",
  payments: "payments",
  maintenance: "maintenance",
  conversations: "conversations",
  messages: "messages",
  automationRules: "automation_rules",
  automationRuns: "automation_runs",
  notifications: "notifications",
} as const;

/** Id prefixes. `formatId(prefix, n)` yields `prefix_0001`. */
export const P = {
  actor: "actor",
  lead: "lead",
  customer: "customer",
  vehicle: "vehicle",
  reservation: "reservation",
  contract: "contract",
  payment: "payment",
  maintenance: "maintenance",
  conversation: "conversation",
  message: "message",
  automationRule: "automation_rule",
  automationRun: "automation_run",
  notification: "notification",
} as const;

/** Canonical logical start of the demo's history. */
export const OPERATIONS_BASE_CLOCK = "2026-09-01T09:00:00Z";

/** One logical tick. A mutation advances the clock by one. */
export const OPERATIONS_CLOCK_TICK_MS = 60_000;

export const OPERATIONS_SEED_VERSION = 1;

export const DEFAULT_ROLE: Role = "Admin";

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/**
 * Rule 02's follow-up offset (D-053). Two days from the qualifying instant,
 * which puts the follow-up inside the demo's visible window.
 */
export const FOLLOW_UP_OFFSET_MS = 2 * DAY_MS;

/**
 * Daily-rate bands in integer cents, by vehicle class.
 *
 * The spec's USD 18–46 band expressed in minor units (D-053). A rate is picked
 * deterministically inside its band from the vehicle's index, so the same seed
 * always produces the same prices.
 */
export const DAILY_RATE_CENTS: Record<VehicleClass, { min: number; max: number }> = {
  Urban: { min: 1800, max: 2600 },
  Utility: { min: 2700, max: 3400 },
  Touring: { min: 3500, max: 4600 },
};

/** Which model labels belong to which class. */
export const MODELS_BY_CLASS: Record<VehicleClass, readonly ModelLabel[]> = {
  Urban: ["Metro 125", "Urban 125", "City 160"],
  Touring: ["Tour 250", "Trail 200"],
  Utility: ["Cargo 150"],
};

/** Canonical seed counts. The QA harness asserts every one of these. */
export const SEED_COUNTS = {
  actors: 4,
  leads: 48,
  customers: 32,
  vehicles: 24,
  reservations: 18,
  contracts: 14,
  payments: 26,
  maintenance: 10,
  conversations: 20,
  messages: 64,
  automationRules: 5,
  automationRuns: 18,
  notifications: 22,
  audit: 63,
} as const;

/** Canonical seed distributions. */
export const SEED_DISTRIBUTION = {
  leadStage: { New: 12, Contacted: 10, Qualified: 9, Proposal: 7, Won: 6, Lost: 4 },
  leadSource: {
    Website: 18,
    Campaign: 11,
    Referral: 9,
    "Walk-in": 6,
    "Returning customer": 4,
  },
  leadPriority: { Low: 14, Normal: 24, High: 10 },
  customerStatus: { Active: 26, Inactive: 6 },
  customerSegment: { Standard: 18, Frequent: 9, Business: 5 },
  vehicleStatus: { Available: 10, Reserved: 4, Rented: 7, Maintenance: 3 },
  vehicleClass: { Urban: 10, Touring: 7, Utility: 7 },
  reservationStatus: { Draft: 4, Confirmed: 4, Converted: 7, Cancelled: 3 },
  contractStatus: { Pending: 3, Active: 7, Completed: 3, Cancelled: 1 },
  paymentEffective: { Paid: 18, Pending: 5, Overdue: 3 },
  paymentCategory: { Rental: 18, Deposit: 6, Adjustment: 2 },
  maintenanceStatus: { Open: 2, "In Progress": 1, Completed: 6, Cancelled: 1 },
  automationRunStatus: { Success: 13, Skipped: 4, Failed: 1 },
  notificationCategory: {
    CRM: 6,
    Reservation: 4,
    Finance: 5,
    Maintenance: 4,
    Automation: 3,
  } as Record<NotificationCategory, number>,
  conversationSubject: { Lead: 11, Customer: 9 },
  conversationChannel: { "Web chat": 12, "In-app": 8 },
  conversationStatus: { Open: 13, Closed: 7 },
  conversationUnread: 6,
  notificationUnread: 8,
} as const;

/** Pagination contract. */
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20] as const;

/** Report period filter. */
export const REPORT_PERIODS = ["30 days", "90 days", "All demo data"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/** The five frozen automation rule ids, in seed order. */
export const RULE_IDS = {
  websiteLeadAssignment: "automation_rule_0001",
  qualifiedFollowUp: "automation_rule_0002",
  reservationMessage: "automation_rule_0003",
  overduePayment: "automation_rule_0004",
  maintenanceNotice: "automation_rule_0005",
} as const;

/** Job type used to carry an automation evaluation through the runtime queue. */
export const AUTOMATION_JOB_TYPE = "operations.automation";
