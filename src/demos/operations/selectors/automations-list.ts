/**
 * Operations demo: the Automations view.
 *
 * Five rules, frozen. This is not a rule builder and there is nothing here that
 * creates or deletes one: the five are the product, and what a visitor may do
 * is turn one off, turn it back on, and run it against a synthetic event.
 *
 * The join this file exists for is the history. An `AutomationRun` names its
 * rule by id and nothing else, so a run list that did not join would be a
 * column of `automation_rule_0003`, which tells a reader nothing.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import type {
  AutomationRule,
  AutomationRun,
  AutomationRunStatus,
  AutomationTrigger,
} from "../types";

/* =====================================================================
   RULES
   ===================================================================== */

export type RuleRow = {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  /** The rule's own description of what it does, as stored. */
  action: string;
  enabled: boolean;
  runCount: number;
  lastRunAt: string | null;
  /** The most recent run for this rule, if there is one. */
  lastStatus: AutomationRunStatus | null;
  lastSummary: string | null;
  /** How many runs of each status this rule has, for the compact tally. */
  successes: number;
  skipped: number;
  failures: number;
};

export type RunRow = {
  id: string;
  ruleId: string;
  /** The rule's name, so the history reads as sentences rather than ids. */
  ruleName: string;
  status: AutomationRunStatus;
  startedAt: string;
  completedAt: string;
  summary: string;
  sourceEventId: string;
};

export type AutomationWorld = {
  rules: DemoRecord<AutomationRule>[];
  runs: DemoRecord<AutomationRun>[];
};

/**
 * What each trigger means, in the language of the product rather than the
 * language of the event bus.
 *
 * The event type is still shown, because an engineering demonstration that hid
 * its own wiring would be missing the point. This is the sentence beside it.
 */
export const TRIGGER_DESCRIPTION: Record<AutomationTrigger, string> = {
  "lead.created.website": "A lead arrives from the website",
  "lead.qualified": "A lead is moved to Qualified",
  "reservation.confirmed": "A reservation is confirmed onto a vehicle",
  "payment.overdue": "A payment passes its due date",
  "maintenance.completed": "A work order is completed",
};

/** Which module a visitor would go to in order to make the trigger happen. */
export const TRIGGER_SOURCE: Record<AutomationTrigger, string> = {
  "lead.created.website": "Leads",
  "lead.qualified": "Leads",
  "reservation.confirmed": "Reservations",
  "payment.overdue": "Payments",
  "maintenance.completed": "Maintenance",
};

export function buildRuleRows(world: AutomationWorld): RuleRow[] {
  /* Newest first, so the head of each rule's list is its most recent run. */
  const byRule = new Map<string, DemoRecord<AutomationRun>[]>();
  for (const run of [...world.runs].sort((a, b) =>
    b.data.startedAt.localeCompare(a.data.startedAt)
  )) {
    const bucket = byRule.get(run.data.ruleId);
    if (bucket) bucket.push(run);
    else byRule.set(run.data.ruleId, [run]);
  }

  return world.rules.map((rule) => {
    const runs = byRule.get(rule.id) ?? [];
    const last = runs[0] ?? null;

    return {
      id: rule.id,
      name: rule.data.name,
      trigger: rule.data.trigger,
      action: rule.data.action,
      enabled: rule.data.enabled,
      runCount: rule.data.runCount,
      lastRunAt: rule.data.lastRunAt ?? null,
      lastStatus: last?.data.status ?? null,
      lastSummary: last?.data.summary ?? null,
      successes: runs.filter((r) => r.data.status === "Success").length,
      skipped: runs.filter((r) => r.data.status === "Skipped").length,
      failures: runs.filter((r) => r.data.status === "Failed").length,
    };
  });
}

/**
 * The run history, newest first.
 *
 * Capped by the caller rather than paged. This is a recent-activity feed beside
 * the rules, not a second audit trail: the audit trail already exists and every
 * record's own drawer shows its slice of it.
 */
export function buildRunRows(world: AutomationWorld, limit = 12): RunRow[] {
  const nameById = new Map(world.rules.map((r) => [r.id, r.data.name]));

  return [...world.runs]
    .sort((a, b) => b.data.startedAt.localeCompare(a.data.startedAt))
    .slice(0, limit)
    .map((run) => ({
      id: run.id,
      ruleId: run.data.ruleId,
      ruleName: nameById.get(run.data.ruleId) ?? "Unknown rule",
      status: run.data.status,
      startedAt: run.data.startedAt,
      completedAt: run.data.completedAt,
      summary: run.data.summary,
      sourceEventId: run.data.sourceEventId,
    }));
}

/** How many runs of each status exist across the whole history. */
export function runTally(world: AutomationWorld): Record<AutomationRunStatus, number> {
  const tally: Record<AutomationRunStatus, number> = { Success: 0, Skipped: 0, Failed: 0 };
  for (const run of world.runs) tally[run.data.status] += 1;
  return tally;
}
