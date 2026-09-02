"use client";

/**
 * Operations demo: one customer, in full.
 *
 * Overview, Relationships and Activity, in the Leads drawer's geometry and with
 * its focus behaviour.
 *
 * The Relationships section is where role matters most. It is composed from
 * `relationSectionsFor(role)`, which derives from the permission matrix, so a
 * section belonging to a module the role cannot open is **not rendered at all**
 * rather than rendered empty. For Finance the order changes too: Contracts and
 * Payments come first, so the drawer reads as a finance view rather than a CRM
 * view with holes cut in it.
 *
 * Conversations are a count and nothing more. Message bodies belong to Inbox,
 * which is 09C3.3; showing them here would be building half of it.
 */

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";

import type { DemoRecord } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { formatCents } from "../../selectors/derive";
import { absoluteDate, relativeDate } from "../../selectors/leads-list";
import { selectCustomerRelations } from "../../selectors/customer-relations";
import { read } from "../../services/context";
import type { Customer } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import {
  STATUS_TONE,
  canOpenSourceLead,
  relationSectionsFor,
  type RelationSection,
} from "./customers-view";

type Props = {
  customer: DemoRecord<Customer> | null;
  missingId: string | null;
  mayWrite: boolean;
  onClose: () => void;
  onDismissMissing: () => void;
  onEdit: (customer: DemoRecord<Customer>) => void;
  onArchive: (customer: DemoRecord<Customer>) => void;
};

export default function CustomerDetail({
  customer,
  missingId,
  mayWrite,
  onClose,
  onDismissMissing,
  onEdit,
  onArchive,
}: Props) {
  const { ctx, role } = useOperations();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const customerId = customer?.id ?? null;

  const sections = useMemo(() => relationSectionsFor(role), [role]);
  const wants = (section: RelationSection) => sections.includes(section);

  /**
   * Keyed on the role as well as the record.
   *
   * That is what stops a section from surviving a role change for a frame: a
   * new role is a different question, so the previous answer is dropped rather
   * than shown while the new one is read (D-058).
   */
  const { data } = useDemoQuery(async () => {
    if (!ctx || !customerId) return null;
    const [customers, leads, reservations, contracts, payments, conversations, vehicles, audit] =
      await Promise.all([
        read.customers(ctx),
        wants("origin") ? read.leads(ctx) : Promise.resolve([]),
        wants("reservations") ? read.reservations(ctx) : Promise.resolve([]),
        wants("contracts") ? read.contracts(ctx) : Promise.resolve([]),
        wants("payments") ? read.payments(ctx) : Promise.resolve([]),
        wants("conversations") ? read.conversations(ctx) : Promise.resolve([]),
        wants("contracts") ? read.vehicles(ctx) : Promise.resolve([]),
        ctx.runtime.listAudit(),
      ]);
    const record = customers.find((c) => c.id === customerId);
    if (!record) return null;
    return selectCustomerRelations({
      customer: record,
      leads,
      reservations,
      contracts,
      payments,
      conversations,
      vehicles,
      audit,
      now: ctx.runtime.now(),
    });
  }, [role, customerId]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [customerId]);

  if (missingId) {
    return (
      <OpsOverlay variant="drawer" label="Customer unavailable" onClose={onDismissMissing}>
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Customer unavailable
          </h2>
          <button
            type="button"
            className="ops-icon-button"
            onClick={onDismissMissing}
            aria-label="Close"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="ops-detail__body">
          <p className="ops-detail__missing">
            No customer in this demo has the id <code>{missingId}</code>. It may have been
            archived, or the demo data may have been reset since the link was made.
          </p>
          <button type="button" className="ops-button" onClick={onDismissMissing}>
            Back to the list
          </button>
        </div>
      </OpsOverlay>
    );
  }

  if (!customer) {
    return (
      <OpsOverlay variant="drawer" label="Customer" onClose={onClose} className="ops-detail">
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Customer
          </h2>
          <button type="button" className="ops-icon-button" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="ops-detail__body" aria-busy="true">
          <div className="ops-skeleton ops-skeleton--line" />
          <div className="ops-skeleton ops-skeleton--line" />
          <p className="visually-hidden" role="status">
            Loading customer
          </p>
        </div>
      </OpsOverlay>
    );
  }

  const now = ctx?.runtime.now() ?? null;
  const converted = Boolean(customer.data.sourceLeadId);

  return (
    <OpsOverlay
      variant="drawer"
      label={`Customer ${customer.data.displayName}`}
      onClose={onClose}
      className="ops-detail"
    >
      <div className="ops-detail__head">
        <div className="ops-detail__identity">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            {customer.data.displayName}
          </h2>
          <p className="ops-detail__id">{customer.id}</p>
          <p className="ops-detail__marks">
            <span className={`ops-pill ops-pill--${STATUS_TONE[customer.data.status]}`}>
              {customer.data.status}
            </span>
            <span className="ops-detail__interest">{customer.data.segment}</span>
            <span className="ops-detail__interest">
              {converted ? "Converted lead" : "Established customer"}
            </span>
          </p>
        </div>
        <button type="button" className="ops-icon-button" onClick={onClose} aria-label="Close customer">
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="ops-detail__body">
        {customer.data.archived && (
          <p className="ops-detail__banner">
            This customer is archived and is no longer in the working list.
          </p>
        )}

        <section className="ops-detail__section" aria-labelledby="ops-customer-overview">
          <h3 className="ops-detail__section-title" id="ops-customer-overview">
            Overview
          </h3>
          <dl className="ops-facts">
            <Fact label="Status" value={customer.data.status} />
            <Fact label="Segment" value={customer.data.segment} />
            <Fact label="Origin" value={converted ? "Converted from lead" : "Established"} />
            <Fact
              label="Created"
              value={now ? relativeDate(customer.createdAt, now) : "-"}
              title={absoluteDate(customer.createdAt)}
            />
            <Fact
              label="Updated"
              value={now ? relativeDate(customer.updatedAt, now) : "-"}
              title={absoluteDate(customer.updatedAt)}
            />
          </dl>
          {customer.data.notes ? (
            <p className="ops-customers__notes">{customer.data.notes}</p>
          ) : (
            <p className="ops-empty">No notes on this customer.</p>
          )}
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-customer-relations">
          <h3 className="ops-detail__section-title" id="ops-customer-relations">
            Relationships
          </h3>

          {sections.map((section) => (
            <div className="ops-relation" key={section}>
              {section === "origin" && (
                <>
                  <p className="ops-relation__title">Lead origin</p>
                  {data?.sourceLead ? (
                    canOpenSourceLead(role) ? (
                      <p className="ops-relation__line">
                        <Link
                          className="ops-link-button"
                          href={`/demos/operations/leads?selected=${data.sourceLead.id}`}
                        >
                          {data.sourceLead.data.displayName}
                        </Link>{" "}
                        <span className="ops-relation__muted">
                          converted from {data.sourceLead.data.source}
                        </span>
                      </p>
                    ) : (
                      <p className="ops-relation__line">Converted lead</p>
                    )
                  ) : (
                    <p className="ops-empty">Established customer, not converted from a lead.</p>
                  )}
                </>
              )}

              {section === "reservations" && (
                <>
                  <p className="ops-relation__title">Reservations</p>
                  {data && data.reservations.length > 0 ? (
                    <>
                      <ul className="ops-relation__list">
                        {data.reservations.slice(0, 3).map((r) => (
                          <li className="ops-relation__row" key={r.id}>
                            <span className="ops-relation__status">{r.status}</span>
                            <span className="ops-relation__muted">
                              {absoluteDate(r.startAt)} to {absoluteDate(r.endAt)}
                            </span>
                            <span className="ops-relation__muted">{r.vehicleClass}</span>
                          </li>
                        ))}
                      </ul>
                      {data.reservations.length > 3 && (
                        <p className="ops-relation__more">{data.reservations.length} total</p>
                      )}
                    </>
                  ) : (
                    <p className="ops-empty">No reservations.</p>
                  )}
                </>
              )}

              {section === "contracts" && (
                <>
                  <p className="ops-relation__title">Contracts</p>
                  {data && data.contracts.length > 0 ? (
                    <>
                      <ul className="ops-relation__list">
                        {data.contracts.slice(0, 3).map((c) => (
                          <li className="ops-relation__row" key={c.id}>
                            <span className="ops-relation__status">{c.status}</span>
                            <span className="ops-relation__muted">{c.vehicleLabel}</span>
                            <span className="ops-relation__money">
                              {formatCents(c.paidCents)} of {formatCents(c.totalCents)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {data.contracts.length > 3 && (
                        <p className="ops-relation__more">{data.contracts.length} total</p>
                      )}
                    </>
                  ) : (
                    <p className="ops-empty">No contracts.</p>
                  )}
                </>
              )}

              {section === "payments" && (
                <>
                  <p className="ops-relation__title">Payments</p>
                  {data && data.payments.total > 0 ? (
                    <p className="ops-relation__line">
                      <span className="ops-relation__count">{data.payments.paid} paid</span>
                      <span className="ops-relation__count">{data.payments.pending} pending</span>
                      <span className="ops-relation__count">{data.payments.overdue} overdue</span>
                      <span className="ops-relation__money">
                        {formatCents(data.payments.paidCents)} received
                      </span>
                    </p>
                  ) : (
                    <p className="ops-empty">No payment records.</p>
                  )}
                </>
              )}

              {section === "conversations" && (
                <>
                  <p className="ops-relation__title">Conversations</p>
                  {data && data.conversations.total > 0 ? (
                    /* A count, deliberately. Threads and replies are the Inbox
                       module's job, and half-building it here would be worse
                       than pointing at it. */
                    <p className="ops-relation__line">
                      <span className="ops-relation__count">
                        {data.conversations.total}{" "}
                        {data.conversations.total === 1 ? "conversation" : "conversations"}
                      </span>
                      <span className="ops-relation__count">{data.conversations.open} open</span>
                      {data.conversations.unread > 0 && (
                        <span className="ops-relation__count">
                          {data.conversations.unread} unread
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="ops-empty">No conversations.</p>
                  )}
                </>
              )}
            </div>
          ))}
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-customer-activity">
          <h3 className="ops-detail__section-title" id="ops-customer-activity">
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
            <p className="ops-empty">{data ? "Nothing has happened to this customer yet." : " "}</p>
          )}
        </section>
      </div>

      {mayWrite && !customer.data.archived && (
        <div className="ops-detail__actions">
          <div className="ops-detail__buttons">
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={() => onEdit(customer)}
            >
              Edit
            </button>
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={() => onArchive(customer)}
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
