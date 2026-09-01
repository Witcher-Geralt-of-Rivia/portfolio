/**
 * Demo runtime — audit history.
 *
 * A record of meaningful business mutations: what changed, who changed it,
 * when, and what it was before.
 *
 * This is not an event log. Persisting every UI interaction would produce a
 * trail full of "tab clicked" and "sidebar opened", and a visitor scrolling
 * it would learn nothing about the system. Audit entries are written
 * deliberately by domain workflows, at the points where a business fact
 * actually changed — a lead converted, a job reassigned, an assessment
 * submitted.
 *
 * Every entry is synthetic, and its timestamp comes from the demo clock.
 */

import type { AuditChange, AuditEntry, DemoId } from "./types";

/** What a workflow supplies; the runtime fills in sequence, demo and time. */
export type AuditDraft = Omit<AuditEntry, "sequence" | "demoId" | "occurredAt">;

export function buildAuditEntry(
  demoId: DemoId,
  sequence: number,
  occurredAt: string,
  draft: AuditDraft
): AuditEntry {
  return {
    demoId,
    sequence,
    occurredAt,
    actor: draft.actor,
    action: draft.action,
    collection: draft.collection,
    entityId: draft.entityId,
    summary: draft.summary,
    changes: draft.changes,
  };
}

/**
 * Field-level differences between two versions of a payload.
 *
 * Only the named fields are compared: an audit entry should say "status: open
 * to closed", not dump every property whose formatting happened to change.
 * Values are stringified because an audit trail is read, not recomputed.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T | null,
  after: T,
  fields: readonly (keyof T & string)[]
): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const field of fields) {
    const from = before ? before[field] : undefined;
    const to = after[field];
    if (from === to) continue;
    changes.push({
      field,
      from: from === undefined || from === null ? null : String(from),
      to: to === undefined || to === null ? null : String(to),
    });
  }
  return changes;
}

/** Most recent first, which is the order an audit panel reads in. */
export function newestFirst(entries: readonly AuditEntry[]): AuditEntry[] {
  return [...entries].sort((a, b) => b.sequence - a.sequence);
}
