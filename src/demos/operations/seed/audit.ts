/**
 * Operations demo: seeded audit history (D-052).
 *
 * Sixty-three entries, one per state transition the canonical dataset implies.
 * Creation is not audited; transitions are, which is the same rule the live
 * services follow.
 *
 * ```
 * lead.converted             6      six Won leads
 * reservation.confirmed      4
 * reservation.converted      7
 * reservation.cancelled      3
 * contract.activated         7
 * contract.completed         3
 * contract.cancelled         1
 * payment.recorded          18      the eighteen settled payments
 * maintenance.started        7      one In Progress plus six Completed
 * maintenance.completed      6
 * maintenance.cancelled      1
 *                           ──
 *                           63
 * ```
 *
 * The count is not chosen. It falls out of the frozen distributions, so a
 * change to the seed changes it and the QA harness notices.
 *
 * Every entry names a real seeded actor and a real seeded entity: an audit
 * trail pointing at ids that do not exist would be worse than no trail.
 */

import type { SeedAuditEntry } from "@/demo-runtime/types";

import { C } from "../constants";
import { formatCents } from "../selectors/derive";
import type { SeedBundle } from "./entities";
import { ACTOR_IDS } from "./entities";

/**
 * Audit timestamps run backwards from the base instant, one hour apart, in the
 * order the entries are composed. They are all at or before the demo's current
 * logical time: an audit trail cannot record the future.
 */
function historyClock(total: number, baseClock: string) {
  const base = Date.parse(baseClock);
  const HOUR = 3_600_000;
  let issued = 0;
  return () => {
    const offset = (total - issued) * HOUR;
    issued += 1;
    return new Date(Math.floor((base - offset) / 1000) * 1000).toISOString();
  };
}

export function buildOperationsSeedAudit(
  bundle: SeedBundle,
  baseClock: string
): SeedAuditEntry[] {
  const entries: Omit<SeedAuditEntry, "occurredAt">[] = [];

  /* --- leads converted --------------------------------------------- */
  for (const lead of bundle.leads) {
    if (lead.data.stage !== "Won" || !lead.data.convertedCustomerId) continue;
    entries.push({
      actor: ACTOR_IDS.sales,
      action: "lead.converted",
      collection: C.leads,
      entityId: lead.id,
      summary: `Lead ${lead.data.displayName} converted to a customer`,
      changes: [{ field: "stage", from: "Proposal", to: "Won" }],
    });
  }

  /* --- reservations ------------------------------------------------- */
  for (const r of bundle.reservations) {
    if (r.data.status === "Confirmed") {
      entries.push({
        actor: ACTOR_IDS.fleet,
        action: "reservation.confirmed",
        collection: C.reservations,
        entityId: r.id,
        summary: "Reservation confirmed and a vehicle assigned",
        changes: [{ field: "status", from: "Draft", to: "Confirmed" }],
      });
    } else if (r.data.status === "Converted") {
      entries.push({
        actor: ACTOR_IDS.sales,
        action: "reservation.converted",
        collection: C.reservations,
        entityId: r.id,
        summary: "Reservation converted to a contract",
        changes: [{ field: "status", from: "Confirmed", to: "Converted" }],
      });
    } else if (r.data.status === "Cancelled") {
      entries.push({
        actor: ACTOR_IDS.sales,
        action: "reservation.cancelled",
        collection: C.reservations,
        entityId: r.id,
        summary: "Reservation cancelled and the vehicle released",
        changes: [{ field: "status", from: "Confirmed", to: "Cancelled" }],
      });
    }
  }

  /* --- contracts ---------------------------------------------------- */
  for (const c of bundle.contracts) {
    if (c.data.status === "Active") {
      entries.push({
        actor: ACTOR_IDS.fleet,
        action: "contract.activated",
        collection: C.contracts,
        entityId: c.id,
        summary: "Contract activated and the vehicle marked as rented",
        changes: [{ field: "status", from: "Pending", to: "Active" }],
      });
    } else if (c.data.status === "Completed") {
      entries.push({
        actor: ACTOR_IDS.fleet,
        action: "contract.completed",
        collection: C.contracts,
        entityId: c.id,
        summary: "Contract completed and the vehicle returned",
        changes: [{ field: "status", from: "Active", to: "Completed" }],
      });
    } else if (c.data.status === "Cancelled") {
      entries.push({
        actor: ACTOR_IDS.admin,
        action: "contract.cancelled",
        collection: C.contracts,
        entityId: c.id,
        summary: "Contract cancelled",
        changes: [{ field: "status", from: "Pending", to: "Cancelled" }],
      });
    }
  }

  /* --- payments ----------------------------------------------------- */
  for (const p of bundle.payments) {
    if (p.data.status !== "Paid") continue;
    entries.push({
      actor: ACTOR_IDS.finance,
      action: "payment.recorded",
      collection: C.payments,
      entityId: p.id,
      summary: `${p.data.category} payment of USD ${formatCents(p.data.amount)} recorded`,
    });
  }

  /* --- maintenance -------------------------------------------------- */
  for (const w of bundle.maintenance) {
    if (w.data.status === "In Progress" || w.data.status === "Completed") {
      entries.push({
        actor: ACTOR_IDS.fleet,
        action: "maintenance.started",
        collection: C.maintenance,
        entityId: w.id,
        summary: "Work order started and the vehicle taken off the fleet",
        changes: [{ field: "status", from: "Open", to: "In Progress" }],
      });
    }
  }
  for (const w of bundle.maintenance) {
    if (w.data.status === "Completed") {
      entries.push({
        actor: ACTOR_IDS.fleet,
        action: "maintenance.completed",
        collection: C.maintenance,
        entityId: w.id,
        summary: "Work order completed and the vehicle returned to the fleet",
        changes: [{ field: "status", from: "In Progress", to: "Completed" }],
      });
    } else if (w.data.status === "Cancelled") {
      entries.push({
        actor: ACTOR_IDS.fleet,
        action: "maintenance.cancelled",
        collection: C.maintenance,
        entityId: w.id,
        summary: "Work order cancelled",
        changes: [{ field: "status", from: "Open", to: "Cancelled" }],
      });
    }
  }

  const nextInstant = historyClock(entries.length, baseClock);
  return entries.map((entry) => ({ ...entry, occurredAt: nextInstant() }));
}
