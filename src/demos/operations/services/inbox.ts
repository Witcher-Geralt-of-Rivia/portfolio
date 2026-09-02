/**
 * Operations demo: inbox services and the deterministic Lead Brief.
 *
 * A reply appends a local message and nothing else. There is no recipient, no
 * address and no network call: the conversation is a record in the browser,
 * which is why the only two channels are Web chat and In-app.
 *
 * The Lead Brief is composed by rule from the lead's own state. It is not a
 * model, has no input, and makes no claim to intelligence: it is a summary a
 * competent application could compose from what it already knows.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { C, P } from "../constants";
import { canWriteModule, requireWrite } from "../permissions";
import type {
  Actor,
  Conversation,
  Lead,
  LeadBrief,
  Message,
  RecommendedAction,
} from "../types";
import { conflict, invalid, must, read, type OperationsContext } from "./context";

export async function addMessage(
  ctx: OperationsContext,
  conversationId: string,
  body: string
): Promise<DemoRecord<Message>> {
  requireWrite(ctx.session, "Inbox");
  const conversation = await must.conversation(ctx, conversationId);
  const text = body.trim();
  if (!text) throw invalid("A reply needs some text.", "body");
  if (conversation.data.status === "Closed") {
    throw conflict("This conversation is closed. Reopen it to reply.", conversationId);
  }

  const result = await ctx.runtime.commit<DemoRecord<Message>>((m) => {
    const now = m.now();
    const id = m.nextId(C.messages, P.message);
    const message = m.record<Message>(C.messages, id, {
      conversationId,
      authorType: "Staff",
      actorId: ctx.session.actorId,
      body: text,
      sentAt: now,
    });
    /* Replying marks the thread read: the person replying has plainly seen it,
       and leaving it unread would keep an unread badge the visitor cannot
       clear by doing the obvious thing. */
    const updated = m.record<Conversation>(
      C.conversations,
      conversationId,
      { ...conversation.data, unread: false },
      conversation
    );

    return {
      ops: [
        { kind: "put", record: message },
        { kind: "put", record: updated },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "conversation.replied",
            collection: C.conversations,
            entityId: conversationId,
            /* That a reply happened, not what it said. The Message is the
               record of the words; copying them into the audit trail would
               duplicate the content and put a visitor's own typing into a
               second store for no benefit (D-076). */
            summary: "Reply added to conversation",
          },
        },
      ],
      events: [
        {
          type: "conversation.message_added",
          entityId: conversationId,
          collection: C.conversations,
          payload: { conversationId, messageId: id },
        },
      ],
      data: message,
    };
  });

  return result.data;
}

/**
 * Read and unread, deliberately unaudited.
 *
 * Triage state rather than business history: marking a thread unread to come
 * back to it is the same class of act as opening a drawer, which the frozen
 * contract lists among the things never audited. Assignment and replies are
 * audited because they change who owns the work and what was said (D-076).
 */
async function setUnread(
  ctx: OperationsContext,
  conversationId: string,
  unread: boolean
): Promise<DemoRecord<Conversation>> {
  requireWrite(ctx.session, "Inbox");
  const conversation = await must.conversation(ctx, conversationId);
  const result = await ctx.runtime.commit<DemoRecord<Conversation>>((m) => {
    const record = m.record<Conversation>(
      C.conversations,
      conversationId,
      { ...conversation.data, unread },
      conversation
    );
    return { ops: [{ kind: "put", record }], data: record };
  });
  return result.data;
}

export const markConversationRead = (ctx: OperationsContext, id: string) =>
  setUnread(ctx, id, false);
export const markConversationUnread = (ctx: OperationsContext, id: string) =>
  setUnread(ctx, id, true);

/**
 * The actors a conversation may be assigned to.
 *
 * Derived from the permission matrix rather than listed: an assignee owns
 * Inbox work, so the only people who can hold it are active actors whose role
 * writes Inbox. In the canonical seed that is Morgan Reed and Avery Chen; a
 * Fleet Coordinator cannot be handed a conversation they are unable to open.
 *
 * Exported because the assignment control needs the same answer, but the rule
 * lives in the service: an option list is a convenience, not an enforcement
 * point, and a screen that forgot to filter must not be able to write an
 * impossible owner (D-075).
 */
export async function inboxAssignees(
  ctx: OperationsContext
): Promise<DemoRecord<Actor>[]> {
  const actors = await read.actors(ctx);
  return actors
    .filter((a) => a.data.active && canWriteModule(a.data.role, "Inbox"))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function assignConversation(
  ctx: OperationsContext,
  conversationId: string,
  actorId: string | null
): Promise<DemoRecord<Conversation>> {
  requireWrite(ctx.session, "Inbox");
  const conversation = await must.conversation(ctx, conversationId);

  /* Both ends of the change are resolved before anything is written, because
     the audit entry names people rather than ids and an unknown id must be
     refused rather than recorded. */
  const actors = await read.actors(ctx);
  const current = conversation.data.assignedActorId;
  const previous = actors.find((a) => a.id === current) ?? null;

  let next: DemoRecord<Actor> | null = null;
  if (actorId !== null) {
    next = actors.find((a) => a.id === actorId) ?? null;
    if (!next) throw invalid("That person is not in this demo.", "assignedActorId");
    if (!next.data.active) {
      throw conflict("That person is no longer active and cannot take a conversation.", actorId);
    }
    if (!canWriteModule(next.data.role, "Inbox")) {
      throw conflict(
        `The ${next.data.role} role does not work in the Inbox and cannot be assigned a conversation.`,
        actorId
      );
    }
  }

  if (current === actorId) {
    throw conflict(
      next ? `This conversation is already assigned to ${next.data.displayName}.` : "This conversation is already unassigned.",
      conversationId
    );
  }

  const result = await ctx.runtime.commit<DemoRecord<Conversation>>((m) => {
    const record = m.record<Conversation>(
      C.conversations,
      conversationId,
      { ...conversation.data, assignedActorId: actorId },
      conversation
    );
    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: "conversation.assigned",
            collection: C.conversations,
            entityId: conversationId,
            /* Ownership of operational work moved, which is the kind of
               change someone later asks about. Names, not ids: an audit line
               nobody can read is a line nobody reads (D-076). */
            summary: next
              ? `Conversation assigned to ${next.data.displayName}`
              : "Conversation unassigned",
            changes: [
              {
                field: "assignedActorId",
                from: previous ? previous.data.displayName : null,
                to: next ? next.data.displayName : null,
              },
            ],
          },
        },
      ],
      data: record,
    };
  });
  return result.data;
}

async function setStatus(
  ctx: OperationsContext,
  conversationId: string,
  status: Conversation["status"]
): Promise<DemoRecord<Conversation>> {
  requireWrite(ctx.session, "Inbox");
  const conversation = await must.conversation(ctx, conversationId);
  if (conversation.data.status === status) {
    throw conflict(`This conversation is already ${status.toLowerCase()}.`, conversationId);
  }
  const from = conversation.data.status;
  const result = await ctx.runtime.commit<DemoRecord<Conversation>>((m) => {
    const record = m.record<Conversation>(
      C.conversations,
      conversationId,
      { ...conversation.data, status },
      conversation
    );
    return {
      ops: [
        { kind: "put", record },
        {
          kind: "audit",
          entry: {
            actor: m.actor,
            action: status === "Closed" ? "conversation.closed" : "conversation.reopened",
            collection: C.conversations,
            entityId: conversationId,
            summary: `Conversation ${status.toLowerCase()}`,
            changes: [{ field: "status", from, to: status }],
          },
        },
      ],
      data: record,
    };
  });
  return result.data;
}

export const closeConversation = (ctx: OperationsContext, id: string) =>
  setStatus(ctx, id, "Closed");
export const reopenConversation = (ctx: OperationsContext, id: string) =>
  setStatus(ctx, id, "Open");

/* =====================================================================
   LEAD BRIEF
   ===================================================================== */

const CLASS_ARTICLE: Record<string, string> = {
  Urban: "an Urban",
  Touring: "a Touring",
  Utility: "a Utility",
};

/**
 * A deterministic brief for a lead.
 *
 * Composed from stage, priority, vehicle interest, conversation state and
 * follow-up date. The same lead in the same state always produces the same
 * two sentences, which is what makes it assertable and what keeps it honest:
 * nothing here is generated, so nothing here can be wrong in an interesting
 * way.
 */
export function composeLeadBrief(input: {
  lead: Lead;
  hasOpenConversation: boolean;
  hasUnreadMessage: boolean;
  now: string;
}): LeadBrief {
  const { lead, hasOpenConversation, hasUnreadMessage, now } = input;

  const interest = CLASS_ARTICLE[lead.vehicleInterest] ?? "a";
  const stagePhrase =
    lead.stage === "New"
      ? "New enquiry"
      : lead.stage === "Contacted"
        ? "Contacted lead"
        : lead.stage === "Qualified"
          ? "Qualified lead"
          : lead.stage === "Proposal"
            ? "Lead at proposal"
            : lead.stage === "Won"
              ? "Converted lead"
              : "Closed lead";

  const followUpDue =
    lead.nextFollowUpAt !== null && Date.parse(lead.nextFollowUpAt) <= Date.parse(now);

  const second = hasUnreadMessage
    ? "There is an unread message waiting in the conversation."
    : followUpDue
      ? "Recent activity indicates follow-up is due next."
      : lead.stage === "Proposal"
        ? "A proposal is open and a reservation would be the next step."
        : lead.priority === "High"
          ? "This lead is marked high priority."
          : "No action is outstanding on this lead.";

  /* Precedence, highest first: an unread message beats a due follow-up, and a
     lead at proposal is ready for a reservation rather than another call. */
  const recommendedAction: RecommendedAction = hasUnreadMessage
    ? "Review conversation"
    : lead.stage === "Proposal" || lead.stage === "Qualified"
      ? followUpDue
        ? "Follow up"
        : "Prepare reservation"
      : hasOpenConversation
        ? "Review conversation"
        : "Follow up";

  return {
    summary: `${stagePhrase} interested in ${interest} vehicle. ${second}`,
    recommendedAction,
  };
}

/** The brief for a stored lead, reading its conversation state from the demo. */
export async function getLeadBrief(
  ctx: OperationsContext,
  leadId: string
): Promise<LeadBrief> {
  const lead = await must.lead(ctx, leadId);
  const conversations = await read.conversations(ctx);
  const mine = conversations.filter(
    (c) => c.data.subjectType === "Lead" && c.data.subjectId === leadId
  );
  return composeLeadBrief({
    lead: lead.data,
    hasOpenConversation: mine.some((c) => c.data.status === "Open"),
    hasUnreadMessage: mine.some((c) => c.data.unread),
    now: ctx.runtime.now(),
  });
}
