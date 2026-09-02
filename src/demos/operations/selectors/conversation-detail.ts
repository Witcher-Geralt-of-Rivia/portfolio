/**
 * Operations demo: one conversation, resolved.
 *
 * The thread, its subject, its assignee, and the assist brief where one can
 * honestly be composed.
 *
 * That last clause is the substance of this module. The frozen contract says
 * the Inbox shows the Lead Brief for "lead and customer conversations", which
 * cannot be true of every customer: a brief is composed from a lead's stage,
 * priority, vehicle interest and follow-up, and twenty-six of the thirty-two
 * seeded customers were never leads. There is nothing to compose from, and
 * inventing a stage for them would be fabrication dressed as a feature.
 *
 * So the rule is narrower and truthful (D-078):
 *
 * ```
 * Lead conversation                    brief from that lead
 * Customer conversation, converted     brief from the customer's source lead
 * Customer conversation, established   no brief
 * ```
 *
 * An established customer gets their own context instead, which is the honest
 * answer rather than a blank panel or a fake one.
 */

import type { AuditEntry, DemoRecord } from "@/demo-runtime/types";

import { composeLeadBrief } from "../services/inbox";
import type {
  Actor,
  Conversation,
  Customer,
  Lead,
  LeadBrief,
  Message,
  MessageAuthor,
} from "../types";
import { C } from "../constants";
import { groupMessages, subjectNameOf } from "./inbox-list";

export type ThreadMessage = {
  id: string;
  authorType: MessageAuthor;
  /**
   * Who said it, as a person.
   *
   * A Customer message is spoken by the conversation's subject, so it carries
   * their name. A Staff message resolves its `actorId` to the actor who wrote
   * it, never the raw id. A System message has no author at all (D-081).
   */
  authorName: string;
  body: string;
  sentAt: string;
};

/** Where an assist brief came from, or that there is not one. */
export type BriefOrigin = "lead" | "source-lead" | null;

export type ConversationDetail = {
  conversation: DemoRecord<Conversation>;
  subjectName: string;
  messages: ThreadMessage[];
  assignee: DemoRecord<Actor> | null;
  /** The lead this conversation is about, when its subject is a Lead. */
  lead: DemoRecord<Lead> | null;
  /** The customer this conversation is about, when its subject is a Customer. */
  customer: DemoRecord<Customer> | null;
  /** The lead a converted customer came from. Null for an established one. */
  sourceLead: DemoRecord<Lead> | null;
  brief: LeadBrief | null;
  briefOrigin: BriefOrigin;
  /** The audit trail for this conversation, newest first. */
  activity: AuditEntry[];
};

export type ConversationWorld = {
  conversationId: string;
  conversations: DemoRecord<Conversation>[];
  messages: DemoRecord<Message>[];
  leads: DemoRecord<Lead>[];
  customers: DemoRecord<Customer>[];
  actors: DemoRecord<Actor>[];
  audit: AuditEntry[];
  /** The demo's logical clock, never the browser's. */
  now: string;
};

export function selectConversationDetail(
  world: ConversationWorld
): ConversationDetail | null {
  const conversation = world.conversations.find((c) => c.id === world.conversationId);
  if (!conversation) return null;

  const subjectName = subjectNameOf(conversation.data, world.leads, world.customers);
  const thread = groupMessages(world.messages).get(conversation.id) ?? [];

  const lead =
    conversation.data.subjectType === "Lead"
      ? (world.leads.find((l) => l.id === conversation.data.subjectId) ?? null)
      : null;
  const customer =
    conversation.data.subjectType === "Customer"
      ? (world.customers.find((c) => c.id === conversation.data.subjectId) ?? null)
      : null;
  const sourceLead = customer?.data.sourceLeadId
    ? (world.leads.find((l) => l.id === customer.data.sourceLeadId) ?? null)
    : null;

  const messages: ThreadMessage[] = thread.map((message) => ({
    id: message.id,
    authorType: message.data.authorType,
    authorName: authorNameOf(message.data, subjectName, world.actors),
    body: message.data.body,
    sentAt: message.data.sentAt,
  }));

  /* The brief's subject: the lead itself, or the lead a converted customer
     came from. An established customer reaches neither branch and gets no
     brief, which is the whole point of D-078. */
  const briefLead = lead ?? sourceLead;
  const briefOrigin: BriefOrigin = lead ? "lead" : sourceLead ? "source-lead" : null;

  /**
   * Recomputed from current records on every read, never cached.
   *
   * That is what makes the brief answer the state a visitor is actually
   * looking at: marking the thread read or replying to it changes the
   * conversation, and the recommended action changes with it (D-078).
   */
  const relevant = briefLead
    ? relevantConversations(world.conversations, briefLead.id, conversation.id)
    : [];
  const brief = briefLead
    ? composeLeadBrief({
        lead: briefLead.data,
        hasOpenConversation: relevant.some((c) => c.data.status === "Open"),
        hasUnreadMessage: relevant.some((c) => c.data.unread),
        now: world.now,
      })
    : null;

  return {
    conversation,
    subjectName,
    messages,
    assignee: conversation.data.assignedActorId
      ? (world.actors.find((a) => a.id === conversation.data.assignedActorId) ?? null)
      : null,
    lead,
    customer,
    sourceLead,
    brief,
    briefOrigin,
    activity: world.audit
      .filter((e) => e.collection === C.conversations && e.entityId === conversation.id)
      .sort((a, b) => b.sequence - a.sequence),
  };
}

/**
 * The conversations whose state a brief may speak about.
 *
 * The lead's own threads, and the thread being read. That second clause is
 * what `getLeadBrief` cannot express and what a customer conversation needs:
 * without it, a brief shown beside a converted customer's thread would never
 * notice that this very thread is unread, and replying to it would leave the
 * recommended action unchanged. The frozen contract requires the opposite,
 * that the action reflects the new state (D-078).
 */
function relevantConversations(
  conversations: DemoRecord<Conversation>[],
  leadId: string,
  openConversationId: string
): DemoRecord<Conversation>[] {
  return conversations.filter(
    (c) =>
      (c.data.subjectType === "Lead" && c.data.subjectId === leadId) ||
      c.id === openConversationId
  );
}

function authorNameOf(
  message: Message,
  subjectName: string,
  actors: DemoRecord<Actor>[]
): string {
  if (message.authorType === "Customer") return subjectName;
  if (message.authorType === "System") return "System";
  const actor = message.actorId
    ? (actors.find((a) => a.id === message.actorId) ?? null)
    : null;
  /* A staff message with no resolvable actor says "Staff" rather than printing
     an id at a person. The id is a storage detail. */
  return actor?.data.displayName ?? "Staff";
}
