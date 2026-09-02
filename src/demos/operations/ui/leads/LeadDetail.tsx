"use client";

/**
 * Operations demo: one lead, in full.
 *
 * A drawer beside the table on a wide screen so the list stays visible and the
 * record keeps its context; a full surface on a phone, where a 440px drawer
 * would be the whole viewport anyway and pretending otherwise only costs
 * padding.
 *
 * Three sections and no more. Overview is the record, Lead Brief is what the
 * demo makes of it, Activity is what has happened to it. A fourth tab would be
 * invented to fill space.
 *
 * The lead's id is shown, quietly, under the name. Ordinarily an id has no
 * place on a user-facing screen, but the synthetic name pool repeats every
 * twenty leads, so three of the forty-eight are called "Alina Danforth", and a
 * drawer headed by the name alone cannot tell a visitor which one they opened.
 */

import { useEffect, useMemo, useRef } from "react";

import type { DemoRecord } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import {
  absoluteDate,
  ownerNameOf,
  relativeDate,
  selectLeadActivity,
  type OwnerOption,
} from "../../selectors/leads-list";
import { assignLead } from "../../services/leads";
import { getLeadBrief } from "../../services/inbox";
import { changeLeadStageWorkflow } from "../../services/lead-workflows";
import { LEAD_STAGES, type Actor, type Lead, type LeadStage } from "../../types";
import { useOperations } from "../OperationsProvider";
import type { ConfirmKind } from "./LeadConfirm";
import { PRIORITY_TONE, STAGE_TONE } from "./leads-view";
import OpsSelect from "../OpsSelect";
import OpsOverlay from "./OpsOverlay";
import { useLeadAction } from "./use-lead-action";

/**
 * The stages a visitor can choose.
 *
 * Won is absent by design and the domain agrees: `changeLeadStage` raises
 * CONFLICT for it. A lead reaches Won by being converted, so that a Won lead
 * always has a customer behind it. Offering it here and letting the service
 * refuse would be a menu item that exists to fail.
 */
const SELECTABLE_STAGES = LEAD_STAGES.filter((s) => s !== "Won");

type Props = {
  lead: DemoRecord<Lead> | null;
  /** Set when the URL names a lead that is not in the list. */
  missingId: string | null;
  actors: DemoRecord<Actor>[];
  owners: OwnerOption[];
  mayWrite: boolean;
  onClose: () => void;
  onDismissMissing: () => void;
  onEdit: (lead: DemoRecord<Lead>) => void;
  onConfirm: (kind: ConfirmKind, lead: DemoRecord<Lead>) => void;
  onAnnounce: (message: string) => void;
};

export default function LeadDetail({
  lead,
  missingId,
  actors,
  owners,
  mayWrite,
  onClose,
  onDismissMissing,
  onEdit,
  onConfirm,
  onAnnounce,
}: Props) {
  const { ctx, role } = useOperations();
  const action = useLeadAction();
  const titleRef = useRef<HTMLHeadingElement>(null);

  const leadId = lead?.id ?? null;

  const { data } = useDemoQuery(async () => {
    if (!ctx || !leadId) return null;
    const [brief, audit] = await Promise.all([
      getLeadBrief(ctx, leadId),
      ctx.runtime.listAudit(),
    ]);
    return { brief, activity: selectLeadActivity(audit, leadId) };
  }, [role, leadId]);

  /* The heading takes focus when a different record is opened, so a keyboard
     or screen-reader user lands on what changed rather than at the top of a
     dialog they must re-explore. */
  useEffect(() => {
    titleRef.current?.focus();
  }, [leadId]);

  const actorName = useMemo(
    () => ownerNameOf(lead?.data.assignedActorId ?? null, actors),
    [lead, actors]
  );

  if (missingId) {
    return (
      <OpsOverlay variant="drawer" label="Lead unavailable" onClose={onDismissMissing}>
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Lead unavailable
          </h2>
          <button type="button" className="ops-icon-button" onClick={onDismissMissing} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="ops-detail__body">
          <p className="ops-detail__missing">
            No lead in this demo has the id <code>{missingId}</code>. It may have been
            archived, or the demo data may have been reset since the link was made.
          </p>
          <button type="button" className="ops-button" onClick={onDismissMissing}>
            Back to the list
          </button>
        </div>
      </OpsOverlay>
    );
  }

  /* Selected, but the list has not been re-read yet. The drawer opens now and
     fills in: waiting for the data would make the record appear to open a
     beat after it was asked for, and rendering nothing would look like the
     click was ignored. */
  if (!lead) {
    return (
      <OpsOverlay variant="drawer" label="Lead" onClose={onClose} className="ops-detail">
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Lead
          </h2>
          <button type="button" className="ops-icon-button" onClick={onClose} aria-label="Close lead">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="ops-detail__body" aria-busy="true">
          <div className="ops-skeleton ops-skeleton--line" />
          <div className="ops-skeleton ops-skeleton--line" />
          <p className="visually-hidden" role="status">
            Loading lead
          </p>
        </div>
      </OpsOverlay>
    );
  }

  const converted = Boolean(lead.data.convertedCustomerId);
  const now = ctx?.runtime.now() ?? null;

  const setStage = async (stage: LeadStage) => {
    if (!ctx) return;
    const done = await action.run(() => changeLeadStageWorkflow(ctx, lead.id, stage));
    if (done) onAnnounce(`Lead moved to ${stage}`);
  };

  const setOwner = async (actorId: string) => {
    if (!ctx) return;
    const next = actorId === "unassigned" ? null : actorId;
    const done = await action.run(() => assignLead(ctx, lead.id, next));
    if (done) {
      const name = next ? (owners.find((o) => o.id === next)?.name ?? "a colleague") : null;
      onAnnounce(name ? `Lead assigned to ${name}` : "Lead owner cleared");
    }
  };

  return (
    <OpsOverlay
      variant="drawer"
      label={`Lead ${lead.data.displayName}`}
      onClose={onClose}
      busy={action.pending}
      className="ops-detail"
    >
      <div className="ops-detail__head">
        <div className="ops-detail__identity">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            {lead.data.displayName}
          </h2>
          <p className="ops-detail__id">{lead.id}</p>
          <p className="ops-detail__marks">
            <span className={`ops-pill ops-pill--${STAGE_TONE[lead.data.stage]}`}>
              {lead.data.stage}
            </span>
            <span className={`ops-prio ops-prio--${PRIORITY_TONE[lead.data.priority]}`}>
              <span className="ops-prio__dot" aria-hidden="true" />
              {lead.data.priority}
            </span>
            <span className="ops-detail__interest">{lead.data.vehicleInterest}</span>
          </p>
        </div>
        <button type="button" className="ops-icon-button" onClick={onClose} aria-label="Close lead">
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="ops-detail__body">
        {action.error && (
          <p className="ops-alert" role="alert">
            {action.error}
          </p>
        )}

        {lead.data.archived && (
          <p className="ops-detail__banner">
            This lead is archived and is no longer in the working list.
          </p>
        )}

        <section className="ops-detail__section" aria-labelledby="ops-detail-overview">
          <h3 className="ops-detail__section-title" id="ops-detail-overview">
            Overview
          </h3>
          <dl className="ops-facts">
            <Fact label="Source" value={lead.data.source} />
            <Fact label="Vehicle interest" value={lead.data.vehicleInterest} />
            <Fact label="Owner" value={actorName ?? "Unassigned"} />
            <Fact label="Stage" value={lead.data.stage} />
            <Fact
              label="Created"
              value={now ? relativeDate(lead.createdAt, now) : "-"}
              title={absoluteDate(lead.createdAt)}
            />
            <Fact
              label="Last activity"
              value={now ? relativeDate(lead.data.lastActivityAt, now) : "-"}
              title={absoluteDate(lead.data.lastActivityAt)}
            />
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
            {converted && (
              /* Named, not linked. The Customers module does not exist yet and
                 a link to a route that 404s is worse than a plain fact. */
              <Fact label="Converted customer" value={lead.data.convertedCustomerId ?? ""} />
            )}
          </dl>
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-detail-brief">
          <div className="ops-brief__head">
            <h3 className="ops-detail__section-title" id="ops-detail-brief">
              Lead brief
            </h3>
            {/* Says where this came from without a paragraph of disclaimer:
                the demo's provenance bar above already states the whole
                product is synthetic and frontend-only. */}
            <span className="ops-assist">ASSIST / LOCAL</span>
          </div>
          {data ? (
            <>
              <p className="ops-brief__summary">{data.brief.summary}</p>
              <p className="ops-brief__action">
                <span className="ops-brief__action-label">Recommended next action</span>
                <strong className="ops-brief__action-value">{data.brief.recommendedAction}</strong>
              </p>
            </>
          ) : (
            <p className="ops-brief__summary ops-skeleton ops-skeleton--line" aria-hidden="true" />
          )}
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-detail-activity">
          <h3 className="ops-detail__section-title" id="ops-detail-activity">
            Activity
          </h3>
          {data && data.activity.length > 0 ? (
            <ol className="ops-activity">
              {data.activity.map((entry) => (
                <li className="ops-activity__item" key={entry.sequence}>
                  <p className="ops-activity__summary">{entry.summary}</p>
                  <p className="ops-activity__meta">
                    <span className="ops-activity__actor">{entry.actor}</span>
                    <span className="ops-activity__dot" aria-hidden="true">
                      ·
                    </span>
                    <time dateTime={absoluteDate(entry.occurredAt)}>
                      {now ? relativeDate(entry.occurredAt, now) : ""}
                    </time>
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ops-empty">
              {data ? "Nothing has happened to this lead yet." : " "}
            </p>
          )}
        </section>
      </div>

      {mayWrite && !lead.data.archived && (
        <div className="ops-detail__actions">
          {converted ? (
            <p className="ops-detail__converted">
              Converted to a customer. This lead is closed at Won.
            </p>
          ) : (
            <>
              <div className="ops-field ops-field--stacked">
                <span className="ops-field__label">Stage</span>
                <OpsSelect
                  srLabel="Stage"
                  value={lead.data.stage}
                  disabled={action.pending}
                  onChange={(v) => setStage(v as LeadStage)}
                  options={SELECTABLE_STAGES.map((stage) => ({ value: stage, label: stage }))}
                />
              </div>

              <div className="ops-field ops-field--stacked">
                <span className="ops-field__label">Owner</span>
                <OpsSelect
                  srLabel="Owner"
                  value={lead.data.assignedActorId ?? "unassigned"}
                  disabled={action.pending}
                  onChange={setOwner}
                  options={[
                    { value: "unassigned", label: "Unassigned" },
                    ...owners.map((owner) => ({ value: owner.id, label: owner.name })),
                  ]}
                />
              </div>
            </>
          )}

          <div className="ops-detail__buttons">
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={() => onEdit(lead)}
              disabled={action.pending}
            >
              Edit
            </button>
            {!converted && lead.data.stage !== "Lost" && (
              <button
                type="button"
                className="ops-button ops-button--primary"
                onClick={() => onConfirm("convert", lead)}
                disabled={action.pending}
              >
                Convert to customer
              </button>
            )}
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={() => onConfirm("archive", lead)}
              disabled={action.pending}
            >
              Archive
            </button>
          </div>
        </div>
      )}
    </OpsOverlay>
  );
}

function Fact({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="ops-facts__row">
      <dt className="ops-facts__label">{label}</dt>
      <dd className="ops-facts__value" title={title}>
        {value}
      </dd>
    </div>
  );
}
