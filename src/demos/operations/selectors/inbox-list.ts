/**
 * Operations demo: the Inbox list.
 *
 * A conversation is thin: a subject pointer, a channel, a status and a flag.
 * Everything a person needs to choose between two of them lives somewhere
 * else, so this is the join. It resolves the subject's name, the latest
 * message and its time, the message count and the assignee, once for the whole
 * page, and hands the screen rows it can render without reading anything
 * further.
 *
 * There is no pagination here, and that is deliberate. The canonical dataset
 * is twenty conversations and the frozen contract asks for none: a pager under
 * a list that never fills one page is furniture (D-077).
 */

import type { DemoRecord } from "@/demo-runtime/types";

import type {
  Actor,
  Conversation,
  ConversationChannel,
  ConversationStatus,
  Customer,
  Lead,
  Message,
} from "../types";

/* =====================================================================
   QUERY
   ===================================================================== */

export type InboxStatusFilter = ConversationStatus | "all";
export type InboxChannelFilter = ConversationChannel | "all";
export type InboxReadFilter = "all" | "unread" | "read";

export type InboxQuery = {
  search: string;
  status: InboxStatusFilter;
  channel: InboxChannelFilter;
  read: InboxReadFilter;
};

export const DEFAULT_INBOX_QUERY: InboxQuery = {
  search: "",
  status: "all",
  channel: "all",
  read: "all",
};

export function isDefaultInboxQuery(query: InboxQuery): boolean {
  return (
    query.search.trim() === "" &&
    query.status === "all" &&
    query.channel === "all" &&
    query.read === "all"
  );
}

/* =====================================================================
   ROWS
   ===================================================================== */

export type ConversationRow = {
  id: string;
  subjectType: Conversation["subjectType"];
  subjectId: string;
  /** The lead's or customer's own name. Never an address: there is not one. */
  subjectName: string;
  channel: ConversationChannel;
  status: ConversationStatus;
  unread: boolean;
  assigneeName: string | null;
  /** The latest message's body, read from the message itself (D-077). */
  preview: string;
  latestAt: string;
  messageCount: number;
};

export type InboxWorld = {
  conversations: DemoRecord<Conversation>[];
  messages: DemoRecord<Message>[];
  leads: DemoRecord<Lead>[];
  customers: DemoRecord<Customer>[];
  actors: DemoRecord<Actor>[];
};

export type InboxListResult = {
  items: ConversationRow[];
  /** Rows after filtering. */
  total: number;
  /** Unread among those rows, so the count always describes what is on screen. */
  unread: number;
};

/** The messages of each conversation, oldest first, indexed once. */
export function groupMessages(
  messages: DemoRecord<Message>[]
): Map<string, DemoRecord<Message>[]> {
  const byConversation = new Map<string, DemoRecord<Message>[]>();
  for (const message of messages) {
    const bucket = byConversation.get(message.data.conversationId);
    if (bucket) bucket.push(message);
    else byConversation.set(message.data.conversationId, [message]);
  }
  for (const bucket of byConversation.values()) {
    /* Sent time first, then id: two messages a rule wrote in the same commit
       share a timestamp, and a transcript that reordered itself between reads
       would be unreadable. */
    bucket.sort(
      (a, b) => a.data.sentAt.localeCompare(b.data.sentAt) || a.id.localeCompare(b.id)
    );
  }
  return byConversation;
}

/** The subject's own display name, whichever collection it lives in. */
export function subjectNameOf(
  conversation: Conversation,
  leads: DemoRecord<Lead>[],
  customers: DemoRecord<Customer>[]
): string {
  if (conversation.subjectType === "Lead") {
    return leads.find((l) => l.id === conversation.subjectId)?.data.displayName ?? "Unknown lead";
  }
  return (
    customers.find((c) => c.id === conversation.subjectId)?.data.displayName ??
    "Unknown customer"
  );
}

export function buildConversationRows(world: InboxWorld): ConversationRow[] {
  const byConversation = groupMessages(world.messages);

  return world.conversations.map((conversation) => {
    const thread = byConversation.get(conversation.id) ?? [];
    const latest = thread.length > 0 ? thread[thread.length - 1] : null;
    const assignee = conversation.data.assignedActorId
      ? (world.actors.find((a) => a.id === conversation.data.assignedActorId) ?? null)
      : null;

    return {
      id: conversation.id,
      subjectType: conversation.data.subjectType,
      subjectId: conversation.data.subjectId,
      subjectName: subjectNameOf(conversation.data, world.leads, world.customers),
      channel: conversation.data.channel,
      status: conversation.data.status,
      unread: conversation.data.unread,
      assigneeName: assignee?.data.displayName ?? null,
      preview: latest?.data.body ?? "",
      /* A thread with no message yet sorts by the record's own creation, which
         is the only honest answer to "when did this last move". */
      latestAt: latest?.data.sentAt ?? conversation.createdAt,
      messageCount: thread.length,
    };
  });
}

/**
 * Filter and order the conversation list.
 *
 * Search spans the subject's name and every message body, which is why it is
 * written here rather than handed to the shared `queryList` matcher: that
 * matcher tests fields of one record, and a message body belongs to a
 * different collection.
 *
 * The order is frozen: most recent message first, conversation id ascending to
 * break a tie. Unread does not sort first. A list that reordered itself when a
 * thread was marked read would move the row out from under the person who just
 * clicked it (D-077).
 */
export function selectInboxList(
  rows: ConversationRow[],
  query: InboxQuery,
  bodies: Map<string, string[]>
): InboxListResult {
  const term = query.search.trim().toLowerCase();

  const matched = rows.filter((row) => {
    if (query.status !== "all" && row.status !== query.status) return false;
    if (query.channel !== "all" && row.channel !== query.channel) return false;
    if (query.read === "unread" && !row.unread) return false;
    if (query.read === "read" && row.unread) return false;
    if (!term) return true;
    if (row.subjectName.toLowerCase().includes(term)) return true;
    return (bodies.get(row.id) ?? []).some((body) => body.includes(term));
  });

  const items = [...matched].sort(
    (a, b) => b.latestAt.localeCompare(a.latestAt) || a.id.localeCompare(b.id)
  );

  return {
    items,
    total: items.length,
    unread: items.filter((row) => row.unread).length,
  };
}

/** Lower-cased message bodies per conversation, built once for the search. */
export function searchIndex(messages: DemoRecord<Message>[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const message of messages) {
    const bucket = index.get(message.data.conversationId);
    const body = message.data.body.toLowerCase();
    if (bucket) bucket.push(body);
    else index.set(message.data.conversationId, [body]);
  }
  return index;
}

/* =====================================================================
   TIME
   ===================================================================== */

/**
 * The clock time of a message, in the demo's own UTC.
 *
 * Not the browser's locale: this demo runs at a fixed logical time and every
 * screenshot of it must read the same in every timezone. `relativeDate` says
 * which day; this says which hour, because three messages on one afternoon are
 * all "Yesterday" and a transcript needs to distinguish them.
 */
export function clockTime(iso: string): string {
  return iso.slice(11, 16);
}
