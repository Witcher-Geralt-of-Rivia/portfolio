/**
 * Operations demo: what the Inbox shows, and to whom.
 *
 * The policy table, in the shape `customers-view.ts` established: derived from
 * `permissions.ts` rather than restated, so the two cannot drift.
 *
 * Inbox is simpler than Customers on that front. Only Admin and Sales Agent
 * open it at all, and both hold it read-write, so there is no partly-visible
 * composition to decide: a role either works the Inbox or is told it is not
 * theirs. What varies is who is replying, which the domain reads from the
 * session rather than from anything here.
 */

import { canViewModule, canWriteModule } from "../../permissions";
import type { ConversationChannel, ConversationStatus, Role } from "../../types";
import type {
  InboxChannelFilter,
  InboxQuery,
  InboxReadFilter,
  InboxStatusFilter,
} from "../../selectors/inbox-list";

export function canOpenInbox(role: Role): boolean {
  return canViewModule(role, "Inbox");
}

export function canWorkInbox(role: Role): boolean {
  return canWriteModule(role, "Inbox");
}

/** Whether the origin of a conversation may be opened in its own module. */
export function canOpenLead(role: Role): boolean {
  return canViewModule(role, "Leads");
}

export function canOpenCustomer(role: Role): boolean {
  return canViewModule(role, "Customers");
}

/* =====================================================================
   PRESENTATION
   ===================================================================== */

/**
 * Open is the working state and reads as one; Closed is finished rather than
 * failed, so it is colourless. The same reasoning that kept Lost grey in the
 * lead pipeline: an ordinary outcome should not look like a fault.
 */
export const STATUS_TONE: Record<ConversationStatus, string> = {
  Open: "mint",
  Closed: "slate",
};

/** A channel is a fact about where a message arrived, not a state to act on. */
export const CHANNEL_LABEL: Record<ConversationChannel, string> = {
  "Web chat": "Web chat",
  "In-app": "In-app",
};

/* =====================================================================
   FILTER OPTIONS
   ===================================================================== */

export const STATUS_OPTIONS: readonly { value: InboxStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Open", label: "Open" },
  { value: "Closed", label: "Closed" },
];

export const CHANNEL_OPTIONS: readonly { value: InboxChannelFilter; label: string }[] = [
  { value: "all", label: "All channels" },
  { value: "Web chat", label: "Web chat" },
  { value: "In-app", label: "In-app" },
];

export const READ_OPTIONS: readonly { value: InboxReadFilter; label: string }[] = [
  { value: "all", label: "All conversations" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

/** How many filters are away from their default, for the phone's Filters button. */
export function activeFilterCount(query: InboxQuery): number {
  return (
    (query.search.trim() ? 1 : 0) +
    (query.status !== "all" ? 1 : 0) +
    (query.channel !== "all" ? 1 : 0) +
    (query.read !== "all" ? 1 : 0)
  );
}

/* =====================================================================
   CROSS-NAVIGATION
   ===================================================================== */

const ROOT = "/demos/operations";

export const leadHref = (id: string) => `${ROOT}/leads?selected=${encodeURIComponent(id)}`;
export const customerHref = (id: string) =>
  `${ROOT}/customers?selected=${encodeURIComponent(id)}`;
export const conversationHref = (id: string) =>
  `${ROOT}/inbox?selected=${encodeURIComponent(id)}`;
