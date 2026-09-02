"use client";

/**
 * Operations demo: Leads on a phone.
 *
 * Eight columns do not survive 360px. Squeezing them produces a table nobody
 * can read and horizontal scrolling nobody expects, so below 768px the same
 * records are rendered as a list instead.
 *
 * Each card carries what a person needs to choose between two leads (name,
 * stage, interest, owner, priority, next follow-up) and leaves source and
 * last activity to the detail, because those are the two that least often
 * decide which record to open.
 *
 * The card is one button. Unlike the table there is no second interactive
 * element inside it, so the whole surface can be the control without swallowing
 * anything, and the touch target is the full width of the screen.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { absoluteDate, ownerNameOf, relativeDate } from "../../selectors/leads-list";
import type { Actor, Lead } from "../../types";
import { PRIORITY_TONE, STAGE_TONE } from "./leads-view";

type Props = {
  result: { items: DemoRecord<Lead>[] } | null;
  actors: DemoRecord<Actor>[];
  now: string | null;
  selectedId: string | null;
  onSelect: (id: string, trigger: HTMLElement) => void;
};

export default function LeadsMobileList({
  result,
  actors,
  now,
  selectedId,
  onSelect,
}: Props) {
  if (!result) {
    return (
      <div className="ops-leads__cards" aria-busy="true">
        <div className="ops-skeleton ops-skeleton--cards" />
      </div>
    );
  }

  return (
    <ul className="ops-leads__cards">
      {result.items.map((lead) => {
        const owner = ownerNameOf(lead.data.assignedActorId, actors);
        return (
          <li key={lead.id}>
            <button
              type="button"
              className={`ops-leadcard${lead.id === selectedId ? " ops-leadcard--selected" : ""}`}
              aria-current={lead.id === selectedId ? "true" : undefined}
              onClick={(e) => onSelect(lead.id, e.currentTarget)}
            >
              <span className="ops-leadcard__top">
                <span className="ops-leadcard__name">{lead.data.displayName}</span>
                <span className={`ops-pill ops-pill--${STAGE_TONE[lead.data.stage]}`}>
                  {lead.data.stage}
                </span>
              </span>

              <span className="ops-leadcard__meta">
                <span className="ops-leadcard__interest">{lead.data.vehicleInterest}</span>
                <span className={`ops-prio ops-prio--${PRIORITY_TONE[lead.data.priority]}`}>
                  <span className="ops-prio__dot" aria-hidden="true" />
                  {lead.data.priority}
                </span>
              </span>

              <span className="ops-leadcard__foot">
                <span className="ops-leadcard__owner">
                  {owner ?? "Unassigned"}
                </span>
                <span className="ops-leadcard__follow">
                  {lead.data.nextFollowUpAt && now ? (
                    <>
                      <span className="ops-leadcard__follow-label">Follow-up</span>{" "}
                      <time dateTime={absoluteDate(lead.data.nextFollowUpAt)}>
                        {relativeDate(lead.data.nextFollowUpAt, now)}
                      </time>
                    </>
                  ) : (
                    <span className="ops-leadcard__follow-label">No follow-up set</span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
