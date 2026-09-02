"use client";

/**
 * Operations demo: the conversation list.
 *
 * One column, one row per thread, and every row a real button. A clickable
 * `<div>` would leave the whole module unreachable from a keyboard, and this
 * list is the only way into a thread.
 *
 * Unread is said three ways: the subject text is heavier, a dot sits beside
 * it, and the accessible name carries the word. A single colour cue would be
 * invisible to a reader who cannot see it and to one who cannot distinguish it
 * (D-079).
 */

import type { ConversationRow } from "../../selectors/inbox-list";
import { clockTime } from "../../selectors/inbox-list";
import { relativeDate, absoluteDate } from "../../selectors/leads-list";
import { STATUS_TONE } from "./inbox-view";

type Props = {
  rows: ConversationRow[] | null;
  selectedId: string | null;
  now: string | null;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

export default function ConversationList({ rows, selectedId, now, onSelect }: Props) {
  if (!rows) {
    return (
      <div className="ops-inbox__list" aria-busy="true">
        <div className="ops-skeleton ops-skeleton--cards" />
        <p className="visually-hidden" role="status">
          Loading conversations
        </p>
      </div>
    );
  }

  return (
    <ul className="ops-inbox__list" aria-label="Conversations">
      {rows.map((row) => (
        <li key={row.id}>
          <button
            type="button"
            className={`ops-convo${row.id === selectedId ? " ops-convo--selected" : ""}${
              row.unread ? " ops-convo--unread" : ""
            }`}
            aria-current={row.id === selectedId ? "true" : undefined}
            onClick={(e) => onSelect(row.id, e.currentTarget)}
          >
            <span className="ops-convo__top">
              <span className="ops-convo__subject">
                {row.unread && <span className="ops-convo__dot" aria-hidden="true" />}
                {row.subjectName}
              </span>
              <time className="ops-convo__time" dateTime={absoluteDate(row.latestAt)}>
                {now ? relativeDate(row.latestAt, now) : clockTime(row.latestAt)}
              </time>
            </span>

            <span className="ops-convo__preview">{row.preview}</span>

            <span className="ops-convo__meta">
              <span className={`ops-pill ops-pill--${STATUS_TONE[row.status]}`}>
                {row.status}
              </span>
              <span className="ops-convo__facts">
                {row.subjectType} · {row.channel} · {row.messageCount}{" "}
                {row.messageCount === 1 ? "message" : "messages"}
              </span>
              <span className="ops-convo__owner">
                {row.assigneeName ?? "Unassigned"}
              </span>
            </span>

            {/* The state, in words, for a reader who gets none of the above. */}
            <span className="visually-hidden">
              {row.unread ? ", unread" : ", read"}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
