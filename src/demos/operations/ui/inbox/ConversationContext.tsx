"use client";

/**
 * Operations demo: the subject behind a conversation.
 *
 * A lead conversation shows the lead and its brief. A customer conversation
 * shows the customer, and a brief only when there is a lead to compose one
 * from.
 *
 * That asymmetry is the honest reading of the frozen contract rather than a
 * gap in it. The brief is composed from a lead's stage, priority, vehicle
 * interest and follow-up; an established customer has none of those, so the
 * choice is between saying nothing and inventing a stage for someone who never
 * had one. This panel says nothing, and shows the customer's own facts
 * instead (D-078).
 */

import Link from "next/link";

import type { ConversationDetail } from "../../selectors/conversation-detail";
import { absoluteDate, relativeDate } from "../../selectors/leads-list";
import type { Role } from "../../types";
import { canOpenCustomer, canOpenLead, customerHref, leadHref } from "./inbox-view";

type Props = {
  detail: ConversationDetail | null;
  role: Role;
  now: string | null;
};

export default function ConversationContext({ detail, role, now }: Props) {
  if (!detail) {
    return (
      <aside className="ops-context ops-context--empty" aria-label="Conversation context">
        <p className="ops-context__placeholder">
          The lead or customer behind a conversation appears here.
        </p>
      </aside>
    );
  }

  const { lead, customer, sourceLead, brief, briefOrigin } = detail;

  return (
    <aside className="ops-context" aria-label="Conversation context">
      {lead && (
        <section className="ops-context__section">
          <h3 className="ops-context__title">Lead</h3>
          <p className="ops-context__name">{lead.data.displayName}</p>
          <dl className="ops-facts">
            <Fact label="Stage" value={lead.data.stage} />
            <Fact label="Priority" value={lead.data.priority} />
            <Fact label="Vehicle interest" value={lead.data.vehicleInterest} />
            <Fact label="Source" value={lead.data.source} />
            <Fact
              label="Next follow-up"
              value={
                lead.data.nextFollowUpAt && now
                  ? relativeDate(lead.data.nextFollowUpAt, now)
                  : "None scheduled"
              }
              title={
                lead.data.nextFollowUpAt ? absoluteDate(lead.data.nextFollowUpAt) : undefined
              }
            />
          </dl>
          {canOpenLead(role) && (
            <Link className="ops-link-button" href={leadHref(lead.id)}>
              Open lead
            </Link>
          )}
        </section>
      )}

      {customer && (
        <section className="ops-context__section">
          <h3 className="ops-context__title">Customer</h3>
          <p className="ops-context__name">{customer.data.displayName}</p>
          <dl className="ops-facts">
            <Fact label="Status" value={customer.data.status} />
            <Fact label="Segment" value={customer.data.segment} />
            <Fact
              label="Origin"
              value={sourceLead ? "Converted from lead" : "Established"}
            />
          </dl>
          {canOpenCustomer(role) && (
            <Link className="ops-link-button" href={customerHref(customer.id)}>
              Open customer
            </Link>
          )}
        </section>
      )}

      {brief && (
        <section className="ops-context__section ops-context__brief">
          <div className="ops-brief__head">
            <h3 className="ops-context__title">
              {briefOrigin === "source-lead" ? "Lead origin brief" : "Lead brief"}
            </h3>
            {/* The same mark the Leads drawer carries, and it means the same
                thing: composed here, by rule, from records already in hand. */}
            <span className="ops-assist">ASSIST / LOCAL</span>
          </div>
          {briefOrigin === "source-lead" && sourceLead && (
            <p className="ops-context__origin">
              From {sourceLead.data.displayName}, the lead this customer was converted
              from.
              {canOpenLead(role) && (
                <>
                  {" "}
                  <Link className="ops-link-button" href={leadHref(sourceLead.id)}>
                    Open lead
                  </Link>
                </>
              )}
            </p>
          )}
          <p className="ops-brief__summary">{brief.summary}</p>
          <p className="ops-brief__action">
            <span className="ops-brief__action-label">Recommended next action</span>
            <strong className="ops-brief__action-value">{brief.recommendedAction}</strong>
          </p>
        </section>
      )}

      {customer && !brief && (
        /* Said plainly rather than left blank, so the absence reads as a fact
           about this customer rather than as something that failed to load. */
        <p className="ops-context__note">
          This customer was not converted from a lead, so there is no lead brief to
          compose.
        </p>
      )}
    </aside>
  );
}

function Fact({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="ops-facts__row">
      <dt className="ops-facts__label">{label}</dt>
      <dd className="ops-facts__value" title={title}>
        {value}
      </dd>
    </div>
  );
}
