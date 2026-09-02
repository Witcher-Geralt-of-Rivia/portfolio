"use client";

/**
 * Operations demo: the Inbox module.
 *
 * The third module that writes, and the one that joins the other two: a
 * conversation is always about a lead or a customer, so this screen is where
 * the CRM stops being three lists and starts being one product.
 *
 * The shape is different from Leads and Customers because the work is. Those
 * are tables you filter and then open a record from; this is a list you keep
 * beside the thread you are reading. So there is no drawer and no pagination,
 * and the three panels are laid out rather than stacked in overlays: list,
 * thread, and the subject behind it (D-077).
 *
 * Everything else is theirs. The same URL contract for selection, the same
 * approved selects, the same toolbar grammar, the same role gate, the same
 * single polite announcement.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { DemoRecord } from "@/demo-runtime/types";
import { isDemoError } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { read } from "../../services/context";
import {
  addMessage,
  assignConversation,
  closeConversation,
  inboxAssignees,
  markConversationRead,
  markConversationUnread,
  reopenConversation,
} from "../../services/inbox";
import {
  DEFAULT_INBOX_QUERY,
  buildConversationRows,
  isDefaultInboxQuery,
  searchIndex,
  selectInboxList,
  type InboxQuery,
} from "../../selectors/inbox-list";
import { selectConversationDetail } from "../../selectors/conversation-detail";
import type { Actor, Role } from "../../types";
import { useOperations } from "../OperationsProvider";
import ConversationContext from "./ConversationContext";
import ConversationList from "./ConversationList";
import ConversationThread from "./ConversationThread";
import InboxToolbar from "./InboxToolbar";
import { canOpenInbox, canWorkInbox } from "./inbox-view";

export default function InboxScreen() {
  const { ctx, role } = useOperations();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("selected");

  const mayView = canOpenInbox(role);
  const mayWrite = canWorkInbox(role);

  const [query, setQuery] = useState<InboxQuery>(DEFAULT_INBOX_QUERY);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);

  const returnFocusRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<"heading" | HTMLElement | null>(null);

  /* A role that can no longer open the module must not be left looking at its
     filter sheet. Done during render so no frame paints with it. */
  const [gatedFor, setGatedFor] = useState(String(mayView));
  if (gatedFor !== String(mayView)) {
    setGatedFor(String(mayView));
    if (!mayView) {
      setFiltersOpen(false);
      setContextOpen(false);
    }
  }

  /**
   * Everything the module reads, in one query keyed on the role.
   *
   * Keyed on the role because a role change is a different question: the
   * previous answer is dropped rather than shown while the new one is read,
   * which is what stops a conversation staying on screen for a frame after
   * switching to a role that cannot open the Inbox (D-058).
   */
  const { data, loading } = useDemoQuery(async () => {
    if (!ctx || !mayView) return null;
    const [conversations, messages, leads, customers, actors, audit, assignees] =
      await Promise.all([
        read.conversations(ctx),
        read.messages(ctx),
        read.leads(ctx),
        read.customers(ctx),
        read.actors(ctx),
        ctx.runtime.listAudit(),
        inboxAssignees(ctx),
      ]);
    return { conversations, messages, leads, customers, actors, audit, assignees };
  }, [role, mayView]);

  const rows = useMemo(
    () => (data ? buildConversationRows(data) : null),
    [data]
  );
  const bodies = useMemo(() => (data ? searchIndex(data.messages) : new Map()), [data]);
  const result = useMemo(
    () => (rows ? selectInboxList(rows, query, bodies) : null),
    [rows, query, bodies]
  );

  const detail = useMemo(() => {
    if (!data || !selectedId || !ctx) return null;
    return selectConversationDetail({
      conversationId: selectedId,
      conversations: data.conversations,
      messages: data.messages,
      leads: data.leads,
      customers: data.customers,
      actors: data.actors,
      audit: data.audit,
      now: ctx.runtime.now(),
    });
  }, [data, selectedId, ctx]);

  /* "Not a conversation" and "not read yet" are different answers. */
  const missingId = selectedId && !detail && !loading ? selectedId : null;

  const select = useCallback(
    (id: string | null, trigger?: HTMLElement | null) => {
      if (trigger) returnFocusRef.current = trigger;
      setActionError(null);
      setReplyError(null);
      setContextOpen(false);
      const next = id ? `${pathname}?selected=${encodeURIComponent(id)}` : pathname;
      router.push(next, { scroll: false });
    },
    [pathname, router]
  );

  /* Focus is claimed once the navigation has landed: the router moves focus
     after the thread unmounts, so claiming it earlier is undone. */
  useEffect(() => {
    if (selectedId) return;
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target !== "heading" && target.isConnected) target.focus();
    else headingRef.current?.focus();
  }, [selectedId]);

  const patch = useCallback((next: Partial<InboxQuery>) => {
    setQuery((current) => ({ ...current, ...next }));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery(DEFAULT_INBOX_QUERY);
    setAnnouncement("Filters cleared");
  }, []);

  /**
   * One place where a mutation is run, so a second click cannot start a second
   * commit and every failure is reported the same way.
   */
  const run = useCallback(
    async (
      operation: () => Promise<unknown>,
      announce: string,
      into: "action" | "reply"
    ): Promise<boolean> => {
      if (!ctx || pending) return false;
      setPending(true);
      setActionError(null);
      setReplyError(null);
      try {
        await operation();
        setAnnouncement(announce);
        return true;
      } catch (cause) {
        const message = isDemoError(cause)
          ? cause.message
          : "That could not be completed in this demo.";
        if (into === "reply") setReplyError(message);
        else setActionError(message);
        return false;
      } finally {
        setPending(false);
      }
    },
    [ctx, pending]
  );

  const send = useCallback(
    async (body: string) => {
      if (!ctx || !selectedId) return false;
      return run(() => addMessage(ctx, selectedId, body), "Reply added", "reply");
    },
    [ctx, selectedId, run]
  );

  const assign = useCallback(
    (actorId: string | null) => {
      if (!ctx || !selectedId) return;
      const name =
        data?.assignees.find((a: DemoRecord<Actor>) => a.id === actorId)?.data.displayName ??
        null;
      void run(
        () => assignConversation(ctx, selectedId, actorId),
        name ? `Conversation assigned to ${name}` : "Conversation unassigned",
        "action"
      );
    },
    [ctx, selectedId, data, run]
  );

  const toggleRead = useCallback(() => {
    if (!ctx || !selectedId || !detail) return;
    const unread = detail.conversation.data.unread;
    void run(
      () =>
        unread
          ? markConversationRead(ctx, selectedId)
          : markConversationUnread(ctx, selectedId),
      unread ? "Conversation marked read" : "Conversation marked unread",
      "action"
    );
  }, [ctx, selectedId, detail, run]);

  const toggleStatus = useCallback(() => {
    if (!ctx || !selectedId || !detail) return;
    const open = detail.conversation.data.status === "Open";
    void run(
      () =>
        open ? closeConversation(ctx, selectedId) : reopenConversation(ctx, selectedId),
      open ? "Conversation closed" : "Conversation reopened",
      "action"
    );
  }, [ctx, selectedId, detail, run]);

  if (!mayView) {
    return <InboxUnavailable role={role} />;
  }

  const isDefault = isDefaultInboxQuery(query);

  return (
    <div
      className={`ops-inbox${contextOpen ? " ops-inbox--context-open" : ""}`}
      data-selected={selectedId ? "true" : undefined}
    >
      <h2 className="visually-hidden" ref={headingRef} tabIndex={-1}>
        Inbox
      </h2>

      <div className="ops-inbox__panel ops-inbox__panel--list">
        <InboxToolbar
          query={query}
          total={result?.total ?? null}
          unread={result?.unread ?? null}
          isDefault={isDefault}
          filtersOpen={filtersOpen}
          onPatch={patch}
          onClear={clearFilters}
          onOpenFilters={() => setFiltersOpen(true)}
          onCloseFilters={() => setFiltersOpen(false)}
        />

        {result && result.total === 0 ? (
          <div className="ops-leads__empty">
            <p className="ops-leads__empty-text">No conversations match these filters.</p>
            {!isDefault && (
              <button type="button" className="ops-button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ConversationList
            rows={result?.items ?? null}
            selectedId={selectedId}
            now={ctx?.runtime.now() ?? null}
            onSelect={select}
          />
        )}
      </div>

      <div className="ops-inbox__panel ops-inbox__panel--thread">
        {missingId ? (
          <div className="ops-thread ops-thread--empty">
            <p className="ops-thread__placeholder">
              No conversation in this demo has the id <code>{missingId}</code>. It may
              have been removed, or the demo data may have been reset since the link was
              made.
            </p>
            <button type="button" className="ops-button" onClick={() => select(null)}>
              Back to conversations
            </button>
          </div>
        ) : (
          <ConversationThread
            detail={detail}
            role={role}
            now={ctx?.runtime.now() ?? null}
            assignees={mayWrite ? (data?.assignees ?? []) : []}
            pending={pending}
            error={actionError}
            replyError={replyError}
            onBack={() => {
              pendingFocus.current = returnFocusRef.current ?? "heading";
              select(null);
            }}
            onSend={send}
            onAssign={assign}
            onToggleRead={toggleRead}
            onToggleStatus={toggleStatus}
          />
        )}

        {/* Below 1180px the context becomes a disclosure rather than a third
            column or another overlay: the page already stacks a notification
            panel, a mobile drawer and the select menus, and one more layer is
            one more thing to get wrong (D-082). */}
        {detail && (
          <button
            type="button"
            className="ops-inbox__context-toggle"
            aria-expanded={contextOpen}
            aria-controls="ops-inbox-context"
            onClick={() => setContextOpen((v) => !v)}
          >
            {contextOpen ? "Hide context" : "Show context"}
          </button>
        )}
      </div>

      <div className="ops-inbox__panel ops-inbox__panel--context" id="ops-inbox-context">
        <ConversationContext detail={detail} role={role} now={ctx?.runtime.now() ?? null} />
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

/**
 * What a role that cannot open the Inbox sees.
 *
 * Contained rather than redirected, for the reason Leads and Customers give:
 * sending someone elsewhere hides both that the module exists and that their
 * role is why it is closed.
 */
function InboxUnavailable({ role }: { role: Role }) {
  return (
    <div className="ops-unavailable" role="note">
      <p className="ops-unavailable__eyebrow">Module unavailable</p>
      <p className="ops-unavailable__text">
        The <strong>{role}</strong> role does not work the Inbox in this simulation.
        Switch the demo role in the bar above to Admin or Sales Agent to read the
        conversations.
      </p>
      <p className="ops-unavailable__note">
        The permission matrix is simulated to show where rules are enforced. It is not
        authentication, and the synthetic records stay in this browser either way.
      </p>
    </div>
  );
}
