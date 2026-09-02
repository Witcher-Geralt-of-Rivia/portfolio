"use client";

/**
 * Operations demo: one conversation, read and worked.
 *
 * A header that says what this thread is, the operational actions beside it,
 * the transcript, and the composer.
 *
 * The transcript is a plain ordered list, not a live region. A reply appends
 * one message and the screen announces that in a single polite line; making
 * the history itself live would re-read the whole transcript to a screen
 * reader every time anything changed (D-081).
 *
 * This is an operations inbox, not a messenger. Customer and staff messages
 * are differentiated because who spoke matters operationally, and a System
 * note is neither: it is a neutral event line, because a rule is not a person.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";

import type { DemoRecord } from "@/demo-runtime/types";

import type { ConversationDetail } from "../../selectors/conversation-detail";
import { clockTime } from "../../selectors/inbox-list";
import { absoluteDate, relativeDate } from "../../selectors/leads-list";
import type { Actor } from "../../types";
import OpsSelect from "../OpsSelect";
import ReplyComposer from "./ReplyComposer";
import { STATUS_TONE, canOpenCustomer, canOpenLead, customerHref, leadHref } from "./inbox-view";
import type { Role } from "../../types";

const UNASSIGNED = "unassigned";

type Props = {
  detail: ConversationDetail | null;
  role: Role;
  now: string | null;
  assignees: DemoRecord<Actor>[];
  pending: boolean;
  /** An action that failed: assignment, read state, close or reopen. */
  error: string | null;
  /** A reply that failed, shown against the field that produced it. */
  replyError: string | null;
  /** Set on a phone, where the thread is the whole screen and needs a way back. */
  onBack?: () => void;
  onSend: (body: string) => Promise<boolean>;
  onAssign: (actorId: string | null) => void;
  onToggleRead: () => void;
  onToggleStatus: () => void;
};

export default function ConversationThread({
  detail,
  role,
  now,
  assignees,
  pending,
  error,
  replyError,
  onBack,
  onSend,
  onAssign,
  onToggleRead,
  onToggleStatus,
}: Props) {
  const historyRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const conversationId = detail?.conversation.id ?? null;
  const messageCount = detail?.messages.length ?? 0;

  /**
   * Land on the newest message, and stay there when one is added.
   *
   * Set outright rather than animated: a scroll that has to be told to respect
   * reduced motion is a scroll that did not need to move smoothly (D-081).
   */
  useEffect(() => {
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversationId, messageCount]);

  useEffect(() => {
    if (conversationId) headingRef.current?.focus();
  }, [conversationId]);

  if (!detail) {
    return (
      <div className="ops-thread ops-thread--empty">
        <p className="ops-thread__placeholder">
          Select a conversation to view its history.
        </p>
      </div>
    );
  }

  const { conversation, subjectName, messages } = detail;
  const open = conversation.data.status === "Open";
  const unread = conversation.data.unread;
  const subjectId = conversation.data.subjectId;
  const isLead = conversation.data.subjectType === "Lead";
  const canOpenSubject = isLead ? canOpenLead(role) : canOpenCustomer(role);

  return (
    <div className="ops-thread">
      <div className="ops-thread__head">
        <div className="ops-thread__identity">
          {onBack && (
            <button
              type="button"
              className="ops-thread__back"
              onClick={onBack}
              aria-label="Back to conversations"
            >
              <span aria-hidden="true">←</span> Conversations
            </button>
          )}
          <h2 className="ops-thread__title" tabIndex={-1} ref={headingRef}>
            {subjectName}
          </h2>
          <p className="ops-thread__marks">
            <span className={`ops-pill ops-pill--${STATUS_TONE[conversation.data.status]}`}>
              {conversation.data.status}
            </span>
            <span className="ops-thread__fact">{conversation.data.subjectType}</span>
            <span className="ops-thread__fact">{conversation.data.channel}</span>
            <span className="ops-thread__fact">{unread ? "Unread" : "Read"}</span>
            {canOpenSubject && (
              <Link
                className="ops-link-button"
                href={isLead ? leadHref(subjectId) : customerHref(subjectId)}
              >
                {isLead ? "Open lead" : "Open customer"}
              </Link>
            )}
          </p>
        </div>

        {/* Ranked rather than a row of equal buttons: assignment is a choice,
            the two toggles are quiet, and the reply below is the real action. */}
        <div className="ops-thread__actions">
          <div className="ops-thread__assign">
            <OpsSelect
              label="Assigned"
              srLabel="Assigned to"
              compact
              value={conversation.data.assignedActorId ?? UNASSIGNED}
              disabled={pending}
              onChange={(v) => onAssign(v === UNASSIGNED ? null : v)}
              options={[
                { value: UNASSIGNED, label: "Unassigned" },
                ...assignees.map((a) => ({ value: a.id, label: a.data.displayName })),
              ]}
            />
          </div>
          <div className="ops-thread__buttons">
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={onToggleRead}
              disabled={pending}
            >
              {unread ? "Mark read" : "Mark unread"}
            </button>
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={onToggleStatus}
              disabled={pending}
            >
              {open ? "Close" : "Reopen"}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="ops-alert ops-thread__alert" role="alert">
          {error}
        </p>
      )}

      <div className="ops-thread__history" ref={historyRef}>
        <ol className="ops-messages">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`ops-message ops-message--${message.authorType.toLowerCase()}`}
            >
              <p className="ops-message__meta">
                <span className="ops-message__author">{message.authorName}</span>
                <span className="ops-message__dot" aria-hidden="true">
                  ·
                </span>
                <time dateTime={message.sentAt} title={absoluteDate(message.sentAt)}>
                  {now ? relativeDate(message.sentAt, now) : ""} {clockTime(message.sentAt)}
                </time>
              </p>
              {/* Plain text, deliberately. No markup, no linkification: the body
                  is whatever someone typed and it is displayed as typed. */}
              <p className="ops-message__body">{message.body}</p>
            </li>
          ))}
          {messages.length === 0 && (
            <li className="ops-empty">This conversation has no messages.</li>
          )}
        </ol>
      </div>

      {open ? (
        <ReplyComposer
          /* A different thread is a different draft: the key discards the
             words typed for the last one rather than carrying them over. */
          key={conversation.id}
          pending={pending}
          error={replyError}
          onSend={onSend}
        />
      ) : (
        <div className="ops-thread__closed">
          <p className="ops-thread__closed-text">This conversation is closed.</p>
          <button
            type="button"
            className="ops-button"
            onClick={onToggleStatus}
            disabled={pending}
          >
            Reopen conversation
          </button>
        </div>
      )}
    </div>
  );
}
