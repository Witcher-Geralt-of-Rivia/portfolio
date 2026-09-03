"use client";

/**
 * Operations demo: one work order, in full.
 *
 * The shared drawer geometry and focus behaviour. Three sections: the job, the
 * line someone wrote about it, and what has happened to it since.
 *
 * The drawer also reads the contracts, which no other detail panel here does.
 * It is the only way to answer the one question this record raises that the
 * record itself cannot: whether the vehicle is out on an active rental right
 * now. When it is, the note below states the rule plainly rather than leaving
 * a visitor to discover it by pressing Start work and being refused.
 */

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";

import type { DemoRecord } from "@/demo-runtime/types";
import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { C } from "../../constants";
import { absoluteDate, relativeDate } from "../../selectors/leads-list";
import { selectActivity } from "../../selectors/queries";
import { read } from "../../services/context";
import type { MaintenanceWorkOrder } from "../../types";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import {
  PRIORITY_TONE,
  STATUS_TONE,
  actionsFor,
  canOpenFleet,
  vehicleHref,
} from "./maintenance-view";

type Props = {
  workOrder: DemoRecord<MaintenanceWorkOrder> | null;
  vehicleLabel: string;
  missingId: string | null;
  mayWrite: boolean;
  onClose: () => void;
  onDismissMissing: () => void;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
};

export default function MaintenanceDetail({
  workOrder,
  vehicleLabel,
  missingId,
  mayWrite,
  onClose,
  onDismissMissing,
  onStart,
  onComplete,
  onCancel,
}: Props) {
  const { ctx, role } = useOperations();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const workOrderId = workOrder?.id ?? null;
  const vehicleId = workOrder?.data.vehicleId ?? null;

  /**
   * Keyed on the role as well as the record, so a role change drops the
   * previous answer rather than showing it for a frame (D-058).
   *
   * The contracts are read whatever the status: reading them only for an open
   * order would make the answer depend on a value that the same query is
   * watching change, and this is a local store read either way.
   */
  const { data } = useDemoQuery(async () => {
    if (!ctx || !workOrderId) return null;
    const [contracts, audit] = await Promise.all([
      read.contracts(ctx),
      ctx.runtime.listAudit(),
    ]);
    return {
      onActiveRental: contracts.some(
        (c) => c.data.vehicleId === vehicleId && c.data.status === "Active"
      ),
      /* Opening a work order writes no audit entry: only starting, completing
         and cancelling do. A record created in this session therefore shows an
         empty feed until someone acts on it, which is correct and not a gap. */
      activity: selectActivity(audit, C.maintenance, workOrderId),
    };
  }, [role, workOrderId, vehicleId]);

  useEffect(() => {
    titleRef.current?.focus();
  }, [workOrderId]);

  const actions = useMemo(
    () => (workOrder ? actionsFor(workOrder.data.status) : null),
    [workOrder]
  );

  if (missingId) {
    return (
      <OpsOverlay variant="drawer" label="Work order unavailable" onClose={onDismissMissing}>
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Work order unavailable
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
            No work order in this demo has the id <code>{missingId}</code>. The demo data
            may have been reset since the link was made.
          </p>
          <button type="button" className="ops-button" onClick={onDismissMissing}>
            Back to the list
          </button>
        </div>
      </OpsOverlay>
    );
  }

  if (!workOrder) {
    return (
      <OpsOverlay variant="drawer" label="Work order" onClose={onClose} className="ops-detail">
        <div className="ops-detail__head">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            Work order
          </h2>
          <button type="button" className="ops-icon-button" onClick={onClose} aria-label="Close">
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="ops-detail__body" aria-busy="true">
          <div className="ops-skeleton ops-skeleton--line" />
          <div className="ops-skeleton ops-skeleton--line" />
          <p className="visually-hidden" role="status">
            Loading work order
          </p>
        </div>
      </OpsOverlay>
    );
  }

  const now = ctx?.runtime.now() ?? null;
  const w = workOrder.data;
  const heldByRental = w.status === "Open" && data?.onActiveRental === true;

  return (
    <OpsOverlay
      variant="drawer"
      label={`Work order on ${vehicleLabel}`}
      onClose={onClose}
      className="ops-detail"
    >
      <div className="ops-detail__head">
        <div className="ops-detail__identity">
          <h2 className="ops-detail__title" tabIndex={-1} ref={titleRef}>
            {vehicleLabel}
          </h2>
          <p className="ops-detail__id">{workOrder.id}</p>
          <p className="ops-detail__marks">
            <span className={`ops-pill ops-pill--${STATUS_TONE[w.status]}`}>{w.status}</span>
            <span className={`ops-prio ops-prio--${PRIORITY_TONE[w.priority]}`}>
              <span className="ops-prio__dot" aria-hidden="true" />
              {w.priority}
            </span>
            <span className="ops-detail__interest">{w.type}</span>
          </p>
        </div>
        <button
          type="button"
          className="ops-icon-button"
          onClick={onClose}
          aria-label="Close work order"
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div className="ops-detail__body">
        <section className="ops-detail__section" aria-labelledby="ops-mnt-order">
          <h3 className="ops-detail__section-title" id="ops-mnt-order">
            Work order
          </h3>
          <dl className="ops-facts">
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Vehicle</dt>
              <dd className="ops-facts__value">
                {canOpenFleet(role) ? (
                  <Link className="ops-link-button" href={vehicleHref(w.vehicleId)}>
                    {vehicleLabel}
                  </Link>
                ) : (
                  /* Both roles that can open this module can also open Fleet,
                     so today this branch never renders. It is written anyway:
                     the policy lives in the permission table, not in whichever
                     matrix happens to be frozen this stage (D-092). */
                  vehicleLabel
                )}
              </dd>
            </div>
            <Fact label="Type" value={w.type} />
            <Fact label="Priority" value={w.priority} />
            <Fact label="Opened" value={absoluteDate(w.openedAt)} />
            <Fact
              label="Started"
              value={w.startedAt ? absoluteDate(w.startedAt) : "Not started"}
            />
            <Fact
              label="Completed"
              value={w.completedAt ? absoluteDate(w.completedAt) : "Not completed"}
            />
            <Fact
              label="Updated"
              value={now ? relativeDate(workOrder.updatedAt, now) : "-"}
              title={absoluteDate(workOrder.updatedAt)}
            />
          </dl>

          {heldByRental && (
            <p className="ops-maintenance__note">
              This vehicle is out on an active rental, so the work cannot be started until
              that contract completes. The open work order already shows the vehicle as
              Maintenance in the fleet register, which is what keeps it from being booked
              again in the meantime.
            </p>
          )}
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-mnt-summary">
          <h3 className="ops-detail__section-title" id="ops-mnt-summary">
            Summary
          </h3>
          <p className="ops-maintenance__body">{w.summary}</p>
        </section>

        <section className="ops-detail__section" aria-labelledby="ops-mnt-activity">
          <h3 className="ops-detail__section-title" id="ops-mnt-activity">
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
              {data ? "Nothing has happened to this work order yet." : " "}
            </p>
          )}
        </section>
      </div>

      {mayWrite && actions && (actions.start || actions.complete || actions.cancel) && (
        <div className="ops-detail__actions">
          <div className="ops-detail__buttons">
            {actions.start && (
              <button type="button" className="ops-button ops-button--primary" onClick={onStart}>
                Start work
              </button>
            )}
            {actions.complete && (
              <button
                type="button"
                className="ops-button ops-button--primary"
                onClick={onComplete}
              >
                Complete work
              </button>
            )}
            {actions.cancel && (
              <button type="button" className="ops-button ops-button--quiet" onClick={onCancel}>
                Cancel work order
              </button>
            )}
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
