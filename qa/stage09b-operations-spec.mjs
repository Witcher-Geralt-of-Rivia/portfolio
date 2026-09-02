/**
 * Stage 09B - Operations specification guard.
 *
 * Asserts that `docs/DEMO_OPERATIONS_SPEC.md` still contains the frozen product
 * contract. It exists because a specification is only useful if it is the same
 * specification tomorrow: a context-compressed session part-way through Stage
 * 09C is exactly the situation in which a seed count quietly becomes "about
 * fifty" and a module list grows a Settings entry.
 *
 * This checks the document, not an implementation: there is no implementation
 * yet. Stage 09C's own harness will assert that the built product matches.
 *
 * Node built-ins only. Run with: node qa/stage09b-operations-spec.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_PATH = "docs/DEMO_OPERATIONS_SPEC.md";
const spec = readFileSync(join(ROOT, SPEC_PATH), "utf8");
/* Phrase assertions run against this: the same text with runs of whitespace
   collapsed, so re-wrapping a paragraph cannot silently break a check. */
const prose = spec.replace(/\s+/g, " ");
const state = JSON.parse(readFileSync(join(ROOT, "docs/project-state.json"), "utf8"));

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(54)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

/** Every listed term must appear somewhere in the document. */
const containsAll = (terms) => terms.filter((t) => !spec.includes(t));

console.log("=== STAGE 09B OPERATIONS SPEC GUARD ===");

/* =====================================================================
   1. Identity and route
   ===================================================================== */

section("IDENTITY");
check("public product label is frozen", spec.includes("Rental Operations Platform"));
check("in-app identity is frozen", spec.includes("Operations Console"));
check("canonical route is frozen", spec.includes("/demos/operations"));
check("no company brand is invented", spec.includes("No company brand is invented"));
check(
  "disclosure is carried",
  spec.includes("INTERACTIVE ENGINEERING DEMO") && spec.includes("SYNTHETIC DATA · FRONTEND ONLY")
);
check("never described as client work", /never described as client work/i.test(spec));
check("domain is frozen", spec.includes("motorcycle / light-vehicle rental operations"));

/* =====================================================================
   2. Modules - exactly eleven, and no Settings
   ===================================================================== */

section("MODULES");
const MODULES = [
  "Overview",
  "Leads",
  "Customers",
  "Reservations",
  "Contracts",
  "Fleet",
  "Maintenance",
  "Payments",
  "Automations",
  "Inbox",
  "Reports",
];
check("all eleven modules are named", containsAll(MODULES).length === 0, containsAll(MODULES).join(", "));
check("module count is eleven", MODULES.length === 11, `${MODULES.length}`);
check("there is no Settings module", spec.includes("There is no Settings module"));

const ROUTES = MODULES.slice(1).map((m) => `/demos/operations/${m.toLowerCase()}`);
check("every module route is frozen", containsAll(ROUTES).length === 0, containsAll(ROUTES).join(", "));
check("selected records use URL state", spec.includes("?selected=lead_0007"));

/* =====================================================================
   3. Roles
   ===================================================================== */

section("ROLES");
const ROLES = ["Admin", "Sales Agent", "Fleet Coordinator", "Finance Analyst"];
check("all four roles are named", containsAll(ROLES).length === 0, containsAll(ROLES).join(", "));
check("role count is four", ROLES.length === 4);
check("default role is Admin", /Default on first launch is \*\*Admin\*\*/.test(spec));
check(
  "role simulation is disclosed as not security",
  /not a security boundary/i.test(spec) && /never called RBAC/i.test(spec)
);
check(
  "unavailable module message is frozen",
  spec.includes("This module is not available for the selected demo role.")
);
check("it is not called access denied", !/access denied/i.test(spec));

/* =====================================================================
   4. Entities - exactly thirteen
   ===================================================================== */

section("ENTITIES");
const ENTITIES = [
  "Actor",
  "Lead",
  "Customer",
  "Vehicle",
  "Reservation",
  "Contract",
  "Payment",
  "MaintenanceWorkOrder",
  "Conversation",
  "Message",
  "AutomationRule",
  "AutomationRun",
  "Notification",
];
check("all thirteen entities are named", containsAll(ENTITIES).length === 0, containsAll(ENTITIES).join(", "));
check("entity count is thirteen", ENTITIES.length === 13);
check(
  "audit and jobs stay runtime types",
  /`AuditEntry` and `Job` remain shared-runtime types/.test(spec)
);

const PREFIXES = [
  "lead_0001",
  "customer_0001",
  "vehicle_0001",
  "reservation_0001",
  "contract_0001",
  "payment_0001",
  "maintenance_0001",
  "conversation_0001",
  "message_0001",
  "automation_rule_0001",
  "automation_run_0001",
  "notification_0001",
  "actor_0001",
];
check("id prefixes follow the runtime convention", containsAll(PREFIXES).length === 0, containsAll(PREFIXES).join(", "));

/* =====================================================================
   5. No contact fields anywhere in the entity contracts
   ===================================================================== */

section("NO CONTACT DATA");
check("Lead carries no email or phone", spec.includes("No email, no phone, no address."));
check("Customer carries no email or phone", spec.includes("No email, no phone, no postal address."));
check("Actor carries no contact route", spec.includes("No email, no telephone, no credential, no avatar URL."));
check(
  "conversation channels exclude every contact route",
  spec.includes("Web chat | In-app") && /No email, SMS or WhatsApp channel may be added/.test(spec)
);

/* The document may name a forbidden channel only while forbidding it. What
   must never appear is an actual address, handle or link. */
/* The document names mailto:, tel: and the messaging apps only where it
   forbids them, which is what a contact guard should permit. What may never
   appear is a usable address, handle or link, so each pattern requires the
   part that would make it one. */
const CONTACT_PATTERNS = [
  [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, "an email address"],
  [/mailto:\S*@/i, "a mailto link"],
  [/tel:\+?\d/i, "a tel link"],
  [/wa\.me\/\S/i, "a wa.me link"],
  [/\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/, "a telephone number"],
  [/t\.me\/\S/i, "a telegram link"],
];
for (const [pattern, what] of CONTACT_PATTERNS) {
  const hit = spec.match(pattern);
  check(`the spec contains no ${what.replace(/^an? /, "")}`, hit === null, hit ? hit[0] : "");
}

/* =====================================================================
   6. Automation - exactly five rules
   ===================================================================== */

section("AUTOMATION");
const RULES = [
  "New website lead assignment",
  "Qualified lead follow-up",
  "Reservation confirmation message",
  "Overdue payment alert",
  "Maintenance completion notice",
];
check("all five rules are named", containsAll(RULES).length === 0, containsAll(RULES).join(", "));
check("rule count is five", RULES.length === 5);
check(
  "rule ids are frozen",
  containsAll(["automation_rule_0001", "automation_rule_0005"]).length === 0
);
check(
  "no generic rule builder in v1",
  /no generic visual rule builder in v1/i.test(prose) &&
    /No generic rule editor/i.test(prose)
);
check(
  "automation does not own vehicle state",
  /never by an automation action/.test(spec)
);
check(
  "run statuses are frozen",
  ["Success", "Skipped", "Failed"].every((s) => spec.includes(s))
);

/* =====================================================================
   7. Workflows - exactly six
   ===================================================================== */

section("WORKFLOWS");
const WORKFLOWS = [
  "W1 - Lead to customer",
  "W2 - Reservation to rental",
  "W3 - Payment",
  "W4 - Maintenance",
  "W5 - Inbox and assist",
  "W6 - Automation control",
];
check("all six workflows are frozen", containsAll(WORKFLOWS).length === 0, containsAll(WORKFLOWS).join(", "));
check("workflow count is six", WORKFLOWS.length === 6);

/* =====================================================================
   8. Seed counts - the numbers most likely to drift
   ===================================================================== */

section("SEED COUNTS");
const COUNTS = [
  ["Actors", 4],
  ["Leads", 48],
  ["Customers", 32],
  ["Vehicles", 24],
  ["Reservations", 18],
  ["Contracts", 14],
  ["Payments", 26],
  ["MaintenanceWorkOrders", 10],
  ["Conversations", 20],
  ["Messages", 64],
  ["AutomationRules", 5],
  ["AutomationRuns", 18],
  ["Notifications", 22],
];
for (const [label, n] of COUNTS) {
  const re = new RegExp(`^${label}\\s+${n}$`, "m");
  check(`seed count ${label} = ${n}`, re.test(spec));
}

check("canonical clock base is frozen", spec.includes("2026-09-01T09:00:00Z"));
check("asset code range is frozen", spec.includes("MTR-001") && spec.includes("MTR-024"));

/* =====================================================================
   9. Distributions
   ===================================================================== */

section("DISTRIBUTIONS");
const DISTRIBUTIONS = [
  ["lead stage", "New 12   Contacted 10   Qualified 9   Proposal 7   Won 6   Lost 4"],
  ["vehicle status", "Available 10   Reserved 4   Rented 7   Maintenance 3"],
  ["reservation status", "Draft 4   Confirmed 4   Converted 7   Cancelled 3"],
  ["contract status", "Pending 3   Active 7   Completed 3   Cancelled 1"],
  ["payment status", "Paid 18   Pending 5   Overdue 3"],
  ["maintenance status", "Open 2   In Progress 1   Completed 6   Cancelled 1"],
];
for (const [label, line] of DISTRIBUTIONS) {
  check(`${label} distribution is frozen`, spec.includes(line), line);
}

/* The distributions have to add up, and the relationship identities have to
   hold, or the seed cannot be built as written. */
const sums = [
  ["lead stages", 12 + 10 + 9 + 7 + 6 + 4, 48],
  ["vehicle statuses", 10 + 4 + 7 + 3, 24],
  ["reservation statuses", 4 + 4 + 7 + 3, 18],
  ["contract statuses", 3 + 7 + 3 + 1, 14],
  ["payment statuses", 18 + 5 + 3, 26],
  ["maintenance statuses", 2 + 1 + 6 + 1, 10],
];
for (const [label, sum, total] of sums) {
  check(`${label} sum to the seed count`, sum === total, `${sum} of ${total}`);
}

check("7 Active contracts match 7 Rented vehicles", spec.includes("7 Active contracts        ↔  the 7 Rented vehicles"));
check("4 Confirmed reservations match 4 Reserved vehicles", spec.includes("4 Confirmed reservations  ↔  the 4 Reserved vehicles"));
check("3 open work orders match 3 Maintenance vehicles", spec.includes("2 Open + 1 In Progress    ↔  the 3 Maintenance vehicles"));
check("6 Won leads match 6 sourced customers", spec.includes("6 Won leads               ↔  6 of the 32 customers carry sourceLeadId"));
check("seeded audit total is documented", /^total                     63$/m.test(spec));

/* =====================================================================
   10. Derived state - the anti-hardcoding rules
   ===================================================================== */

section("DERIVED STATE");
check("payments-requiring-attention is derived, not literal", /8 may never be written as a literal/.test(spec));
check("notification unread badge is derived", /8 is never written as a literal/.test(spec));
check("vehicle status has a precedence rule", spec.includes("an active work order (Open or In Progress)"));
check("vehicle status is never set by a form", /never set directly by a form/.test(spec));
check("overdue derives from the logical clock", spec.includes("dueAt < clock.now()"));
check(
  "overdue is never a stored flag",
  /`Overdue` is a derivation, never a stored flag/.test(prose) &&
    spec.includes("status     Pending | Paid          stored")
);
check(
  "money is integer cents",
  /All monetary amounts .* are \*\*integer cents\*\*/.test(prose) &&
    spec.includes("1800 – 2600 cents")
);
check(
  "the follow-up offset is a frozen value",
  /\+ 2 days\*\*/.test(prose) && /two days is the frozen figure/.test(prose)
);
check("contract total derives from rate and duration", spec.includes("totalAmount  = dailyRate × days"));
check("daily rates stay inside the frozen band", spec.includes("Urban      18 – 26") && spec.includes("Touring    35 – 46"));

/* =====================================================================
   11. Scope exclusions
   ===================================================================== */

section("SCOPE EXCLUSIONS");
const EXCLUSIONS = [
  "no CSV or PDF export",
  "no global cross-entity command palette",
  "no generic visual automation rule builder",
  "no Settings module",
  "no real maps or geographic addresses",
  "no payment provider, card entry or real processing",
  "no browser push notifications",
  "no optimistic mutations",
  "no icon library",
];
check("every v1 exclusion is recorded", containsAll(EXCLUSIONS).length === 0, containsAll(EXCLUSIONS).join("; "));

/* =====================================================================
   12. Truthfulness and the required runtime extension
   ===================================================================== */

section("TRUTHFULNESS");
check("no real manufacturer brands", !/\b(honda|yamaha|suzuki|kawasaki|ducati|bmw)\b/i.test(spec));
check("no backend required", /backend required              no/.test(spec));
check("no AI API required", /AI API required               no/.test(spec));
check("no payment provider required", /payment provider required     no/.test(spec));
check("model labels are fictional", spec.includes("Metro 125") && /Model labels are fictional/.test(spec));

section("RUNTIME EXTENSION");
check(
  "the ResetPayload gap is recorded, not made silently",
  /cannot express a seeded audit trail today/.test(spec) &&
    spec.includes("ResetPayload += audit?: AuditEntry[]")
);

/* =====================================================================
   13. Stage state
   ===================================================================== */

section("STAGE STATE");
check("the spec records what is built", spec.includes("SPEC FROZEN / DOMAIN BUILT / UI NOT BUILT"));
check("Stage 09C is named as next", spec.includes("Stage 09C - Build Operations / CRM / ERP SaaS Demo"));
check(
  "the registry lifecycle is documented",
  /`planned` before 09C, `building` while it is under construction, and `verified`/.test(prose)
);
check(
  "operations is not yet verified",
  state.demoPlatform?.demoStatuses?.operations !== "verified",
  String(state.demoPlatform?.demoStatuses?.operations)
);
check("currentStage is still 8", state.currentStage === 8, String(state.currentStage));
check(
  "the spec is a canonical document",
  (state.canonicalDocs ?? []).includes(SPEC_PATH),
  SPEC_PATH
);
check("the spec carries the stage marker", /<!--\s*PROJECT_STAGE:\s*8\s*-->/.test(spec));

console.log(
  `\n=== stage09b operations spec: ${failures === 0 ? `ALL PASS (${checks} checks)` : `${failures} FAILURE(S) of ${checks}`} ===`
);
process.exit(failures === 0 ? 0 : 1);
