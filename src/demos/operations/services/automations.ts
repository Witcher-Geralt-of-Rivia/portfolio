/**
 * Operations demo — the automation engine.
 *
 * Five typed rules, each a small function. There is no generic expression
 * evaluator: five known rules written plainly are easier to read, impossible
 * to mis-parse, and honest about what the demo actually does.
 *
 * ```
 * domain event → job → rule evaluation → action → AutomationRun → notification
 * ```
 *
 * Processing is explicit. Nothing polls, nothing runs on a timer, and a rule
 * fires because a workflow asked it to — which is what keeps the runtime idle
 * at rest and every sequence reproducible.
 *
 * A disabled rule still produces a run, marked Skipped. Silently doing nothing
 * would leave a visitor who has just switched a rule off with no evidence that
 * the system noticed.
 */

import type { DemoRecord, DomainEvent } from "@/demo-runtime/types";

import { AUTOMATION_JOB_TYPE, C, FOLLOW_UP_OFFSET_MS, P, RULE_IDS } from "../constants";
import { requireWrite } from "../permissions";
import { offsetFrom } from "@/demo-runtime/runtime";
import type {
  AutomationRule,
  AutomationRunStatus,
  AutomationTrigger,
  Conversation,
  Lead,
  Notification,
} from "../types";
import { conflict, must, read, type OperationsContext } from "./context";
import { notificationOp } from "./notifications";

/* =====================================================================
   TRIGGER MATCHING
   ===================================================================== */

/** Which rule, if any, a domain event should wake. */
export function triggerFor(eventType: string): AutomationTrigger | null {
  switch (eventType) {
    case "lead.created.website":
      return "lead.created.website";
    case "lead.qualified":
      return "lead.qualified";
    case "reservation.confirmed":
      return "reservation.confirmed";
    case "payment.overdue":
      return "payment.overdue";
    case "maintenance.completed":
      return "maintenance.completed";
    default:
      return null;
  }
}

const RULE_ID_BY_TRIGGER: Record<AutomationTrigger, string> = {
  "lead.created.website": RULE_IDS.websiteLeadAssignment,
  "lead.qualified": RULE_IDS.qualifiedFollowUp,
  "reservation.confirmed": RULE_IDS.reservationMessage,
  "payment.overdue": RULE_IDS.overduePayment,
  "maintenance.completed": RULE_IDS.maintenanceNotice,
};

/* =====================================================================
   RULE ACTIONS

   Each returns the summary written onto the AutomationRun, and performs its
   effect through the ordinary services so the effect is audited and
   transactional like any other change.
   ===================================================================== */

type EventPayload = Record<string, unknown>;

const str = (payload: EventPayload, key: string): string | null =>
  typeof payload[key] === "string" ? (payload[key] as string) : null;

/**
 * Rule 01 — assign a website lead to the next Sales Agent.
 *
 * The rotation is deterministic: agents sorted by id, indexed by how many
 * leads they already hold. With one Sales Agent in the canonical seed it
 * always resolves to that actor, which is correct rather than a placeholder.
 */
async function runWebsiteLeadAssignment(
  ctx: OperationsContext,
  event: DomainEvent
): Promise<string> {
  const leadId = str(event.payload as EventPayload, "leadId");
  if (!leadId) return "No lead on the event";

  const [lead, actors, leads] = await Promise.all([
    must.lead(ctx, leadId),
    ctx.runtime.repository.all<{ displayName: string; role: string; active: boolean }>(C.actors),
    read.leads(ctx),
  ]);

  const agents = actors
    .filter((a) => a.data.role === "Sales Agent" && a.data.active)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (agents.length === 0) return "No sales agent available to assign";

  const held = leads.filter((l) => l.data.assignedActorId !== null).length;
  const agent = agents[held % agents.length];

  await ctx.runtime.commit((m) => {
    const assigned = m.record<Lead>(
      C.leads,
      leadId,
      { ...lead.data, assignedActorId: agent.id },
      lead
    );
    const note = notificationOp(m, {
      category: "CRM",
      title: "Lead assigned",
      body: `${lead.data.displayName} was assigned for follow-up.`,
      actorRole: "Sales Agent",
      sourceEntityType: "lead",
      sourceEntityId: leadId,
    });
    return {
      ops: [
        { kind: "put", record: assigned },
        { kind: "put", record: note.record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "lead.assigned",
            collection: C.leads,
            entityId: leadId,
            summary: `Lead assigned to ${agent.data.displayName} by automation`,
          },
        },
      ],
      data: null,
    };
  });

  return `Assigned to ${agent.data.displayName}`;
}

/** Rule 02 — set the follow-up date two days out (D-053) and notify. */
async function runQualifiedFollowUp(
  ctx: OperationsContext,
  event: DomainEvent
): Promise<string> {
  const leadId = str(event.payload as EventPayload, "leadId");
  if (!leadId) return "No lead on the event";
  const lead = await must.lead(ctx, leadId);

  await ctx.runtime.commit((m) => {
    const nextFollowUpAt = offsetFrom(m.now(), FOLLOW_UP_OFFSET_MS);
    const updated = m.record<Lead>(C.leads, leadId, { ...lead.data, nextFollowUpAt }, lead);
    const note = notificationOp(m, {
      category: "CRM",
      title: "Follow-up scheduled",
      body: `${lead.data.displayName} qualified. Follow-up set for two days' time.`,
      actorRole: "Sales Agent",
      sourceEntityType: "lead",
      sourceEntityId: leadId,
    });
    return {
      ops: [
        { kind: "put", record: updated },
        { kind: "put", record: note.record },
      ],
      data: null,
    };
  });

  return "Follow-up scheduled two days ahead";
}

/** Rule 03 — append a System message to the customer's conversation. */
async function runReservationMessage(
  ctx: OperationsContext,
  event: DomainEvent
): Promise<string> {
  const payload = event.payload as EventPayload;
  const customerId = str(payload, "customerId");
  const reservationId = str(payload, "reservationId");
  if (!customerId || !reservationId) return "No customer on the event";

  const conversations = await read.conversations(ctx);
  const existing = conversations.find(
    (c) => c.data.subjectType === "Customer" && c.data.subjectId === customerId
  );

  await ctx.runtime.commit((m) => {
    const body = "Reservation confirmed. Vehicle assigned.";
    const messageId = m.nextId(C.messages, P.message);

    if (existing) {
      const message = m.record(C.messages, messageId, {
        conversationId: existing.id,
        authorType: "System" as const,
        body,
        sentAt: m.now(),
      });
      const touched = m.record<Conversation>(
        C.conversations,
        existing.id,
        { ...existing.data, unread: true },
        existing
      );
      return {
        ops: [
          { kind: "put", record: message },
          { kind: "put", record: touched },
        ],
        data: null,
      };
    }

    const conversationId = m.nextId(C.conversations, P.conversation);
    const conversation = m.record<Conversation>(C.conversations, conversationId, {
      subjectType: "Customer",
      subjectId: customerId,
      channel: "In-app",
      assignedActorId: null,
      status: "Open",
      unread: true,
    });
    const message = m.record(C.messages, messageId, {
      conversationId,
      authorType: "System" as const,
      body,
      sentAt: m.now(),
    });
    return {
      ops: [
        { kind: "put", record: conversation },
        { kind: "put", record: message },
      ],
      data: null,
    };
  });

  return existing ? "System message appended" : "Conversation opened with a system message";
}

async function runOverduePaymentAlert(
  ctx: OperationsContext,
  event: DomainEvent
): Promise<string> {
  const paymentId = str(event.payload as EventPayload, "paymentId");
  if (!paymentId) return "No payment on the event";

  await ctx.runtime.commit((m) => {
    const note = notificationOp(m, {
      category: "Finance",
      title: "Payment overdue",
      body: "A payment has passed its due date and needs attention.",
      actorRole: "Finance Analyst",
      sourceEntityType: "payment",
      sourceEntityId: paymentId,
    });
    return { ops: [{ kind: "put", record: note.record }], data: null };
  });

  return "Finance notification raised";
}

async function runMaintenanceNotice(
  ctx: OperationsContext,
  event: DomainEvent
): Promise<string> {
  const workOrderId = str(event.payload as EventPayload, "workOrderId");
  if (!workOrderId) return "No work order on the event";

  await ctx.runtime.commit((m) => {
    const note = notificationOp(m, {
      category: "Maintenance",
      title: "Work order completed",
      body: "A maintenance work order was completed and the vehicle returned to the fleet.",
      actorRole: "Fleet Coordinator",
      sourceEntityType: "maintenance",
      sourceEntityId: workOrderId,
    });
    return { ops: [{ kind: "put", record: note.record }], data: null };
  });

  return "Maintenance notification raised";
}

const ACTIONS: Record<
  AutomationTrigger,
  (ctx: OperationsContext, event: DomainEvent) => Promise<string>
> = {
  "lead.created.website": runWebsiteLeadAssignment,
  "lead.qualified": runQualifiedFollowUp,
  "reservation.confirmed": runReservationMessage,
  "payment.overdue": runOverduePaymentAlert,
  "maintenance.completed": runMaintenanceNotice,
};

/* =====================================================================
   PROCESSING
   ===================================================================== */

export type AutomationOutcome = {
  ruleId: string;
  runId: string;
  status: AutomationRunStatus;
  summary: string;
};

/**
 * Evaluate the rules a batch of events wakes, and record a run for each.
 *
 * Called by workflows after the mutation that produced the events. The job is
 * enqueued and immediately drained: the queue is there so the path a real
 * deferred system takes is visible, not so work can sit around.
 */
export async function processEvents(
  ctx: OperationsContext,
  events: readonly DomainEvent[]
): Promise<AutomationOutcome[]> {
  const outcomes: AutomationOutcome[] = [];

  for (const event of events) {
    const trigger = triggerFor(event.type);
    if (!trigger) continue;

    const ruleId = RULE_ID_BY_TRIGGER[trigger];
    const rule = await ctx.runtime.repository.get<AutomationRule>(C.automationRules, ruleId);
    if (!rule) continue;

    /* The job exists so the deferred path is real rather than implied. It is
       enqueued and drained in the same breath — there is no worker. */
    await ctx.runtime.commit(() => ({
      ops: [
        {
          kind: "job",
          job: {
            type: AUTOMATION_JOB_TYPE,
            payload: { ruleId, eventId: event.id },
            /* Supplied rather than defaulted: the runtime's op type requires
               it, and one attempt is right for a rule that is drained in the
               same breath as it is enqueued. */
            maxAttempts: 1,
          },
        },
      ],
      data: null,
    }));

    let status: AutomationRunStatus = "Skipped";
    let summary = `${rule.data.name} skipped: the rule is disabled`;

    if (rule.data.enabled) {
      try {
        summary = await ACTIONS[trigger](ctx, event);
        status = "Success";
      } catch (cause) {
        status = "Failed";
        summary = cause instanceof Error ? cause.message : "The action could not complete";
      }
    }

    const runId = await recordRun(ctx, ruleId, event.id, status, summary);
    outcomes.push({ ruleId, runId, status, summary });
  }

  return outcomes;
}

async function recordRun(
  ctx: OperationsContext,
  ruleId: string,
  sourceEventId: string,
  status: AutomationRunStatus,
  summary: string
): Promise<string> {
  const rule = await ctx.runtime.repository.require<AutomationRule>(C.automationRules, ruleId);

  const result = await ctx.runtime.commit<string>((m) => {
    const now = m.now();
    const id = m.nextId(C.automationRuns, P.automationRun);
    const run = m.record(C.automationRuns, id, {
      ruleId,
      sourceEventId,
      status,
      startedAt: now,
      completedAt: now,
      summary,
    });
    const touched = m.record<AutomationRule>(
      C.automationRules,
      ruleId,
      { ...rule.data, lastRunAt: now, runCount: rule.data.runCount + 1 },
      rule
    );
    return {
      ops: [
        { kind: "put", record: run },
        { kind: "put", record: touched },
      ],
      events: [
        {
          type: "automation.run_completed",
          entityId: id,
          collection: C.automationRuns,
          payload: { runId: id, ruleId, status },
        },
      ],
      data: id,
    };
  });

  return result.data;
}

/* =====================================================================
   RULE CONTROL
   ===================================================================== */

export async function setRuleEnabled(
  ctx: OperationsContext,
  ruleId: string,
  enabled: boolean
): Promise<DemoRecord<AutomationRule>> {
  requireWrite(ctx.session, "Automations");
  const rule = await ctx.runtime.repository.require<AutomationRule>(C.automationRules, ruleId);
  if (rule.data.enabled === enabled) {
    throw conflict(`This rule is already ${enabled ? "enabled" : "disabled"}.`, ruleId);
  }

  const result = await ctx.runtime.commit<DemoRecord<AutomationRule>>((m) => {
    const record = m.record<AutomationRule>(
      C.automationRules,
      ruleId,
      { ...rule.data, enabled },
      rule
    );
    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: enabled ? "automation.rule_enabled" : "automation.rule_disabled",
            collection: C.automationRules,
            entityId: ruleId,
            summary: `Automation rule ${rule.data.name} ${enabled ? "enabled" : "disabled"}`,
            changes: [
              { field: "enabled", from: String(rule.data.enabled), to: String(enabled) },
            ],
          },
        },
      ],
      events: [
        {
          type: enabled ? "automation.rule_enabled" : "automation.rule_disabled",
          entityId: ruleId,
          collection: C.automationRules,
          payload: { ruleId },
        },
      ],
      data: record,
    };
  });

  return result.data;
}

/**
 * Run a rule against a synthetic test payload.
 *
 * Deliberately does not touch principal business records: a Test button that
 * quietly reassigned a real lead would be a trap. It records a run and, for the
 * rules whose action is a notification, raises one.
 */
export async function testRule(
  ctx: OperationsContext,
  ruleId: string
): Promise<AutomationOutcome> {
  requireWrite(ctx.session, "Automations");
  const rule = await ctx.runtime.repository.require<AutomationRule>(C.automationRules, ruleId);

  if (!rule.data.enabled) {
    const runId = await recordRun(
      ctx,
      ruleId,
      "test_event",
      "Skipped",
      `${rule.data.name} skipped: the rule is disabled`
    );
    return { ruleId, runId, status: "Skipped", summary: "Rule is disabled", };
  }

  const summary = `${rule.data.name} test run completed against a synthetic event`;
  await ctx.runtime.commit((m) => {
    const note = notificationOp(m, {
      category: "Automation",
      title: "Automation test run",
      body: `${rule.data.name} was tested against a synthetic event.`,
      actorRole: "Admin",
      sourceEntityType: "automation_rule",
      sourceEntityId: ruleId,
    });
    return { ops: [{ kind: "put", record: note.record }], data: null };
  });

  const runId = await recordRun(ctx, ruleId, "test_event", "Success", summary);
  return { ruleId, runId, status: "Success", summary };
}

/**
 * Move time-derived state forward.
 *
 * A payment becomes overdue because the clock passed its due date, not because
 * anything happened to the record. Rather than polling for that, a workflow
 * calls this and the transition is raised explicitly — which keeps the runtime
 * idle at rest while still letting Rule 04 fire.
 */
export async function reconcileTimeDerivedState(
  ctx: OperationsContext
): Promise<AutomationOutcome[]> {
  const now = ctx.runtime.now();
  const payments = await read.payments(ctx);
  const notifications = await ctx.runtime.repository.all<Notification>(C.notifications);

  const newlyOverdue = payments.filter(
    (p) =>
      p.data.status === "Pending" &&
      Date.parse(p.data.dueAt) < Date.parse(now) &&
      !notifications.some(
        (n) => n.data.category === "Finance" && n.data.sourceEntityId === p.id
      )
  );

  const events: DomainEvent[] = newlyOverdue.map((p, i) => ({
    id: `reconcile_${p.id}_${i}`,
    demoId: "operations",
    type: "payment.overdue",
    entityId: p.id,
    collection: C.payments,
    occurredAt: now,
    payload: { paymentId: p.id, contractId: p.data.contractId },
  }));

  return processEvents(ctx, events);
}
