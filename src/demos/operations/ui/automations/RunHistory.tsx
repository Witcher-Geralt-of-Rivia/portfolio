"use client";

/**
 * Operations demo: the automation run history.
 *
 * A recent-activity feed beside the rules, not a second audit trail. The audit
 * trail already exists and every record's own drawer shows its slice of it;
 * this answers one narrower question, which is what the rules have actually
 * been doing.
 *
 * Every run is named by its rule rather than by its rule id, because a column
 * of `automation_rule_0003` tells a reader nothing. The run id stays, because
 * it is the record a visitor can go and look for, and because the Test dialog
 * hands them exactly that id when they run a rule themselves.
 *
 * A Skipped run is not a gap in the feed. A disabled rule still records that
 * an event woke it and that it did nothing, which is the whole reason the
 * history is more useful than a silence.
 */

import type { RunRow } from "../../selectors/automations-list";
import { absoluteDate, relativeDate } from "../../selectors/leads-list";
import type { AutomationRunStatus } from "../../types";
import { RUN_TONE } from "./automations-view";

type Props = {
  /** The recent slice, newest first, already capped by the selector. */
  runs: RunRow[];
  tally: Record<AutomationRunStatus, number>;
  /** Every run in the history, so a shortened list can say it is shortened. */
  total: number;
  now: string;
  /** Set when the feed is narrowed to one rule, so the panel can say so. */
  ruleName?: string | null;
  onShowAll?: () => void;
};

export default function RunHistory({
  runs,
  tally,
  total,
  now,
  ruleName = null,
  onShowAll,
}: Props) {
  const counted = `${tally.Success} succeeded, ${tally.Skipped} skipped, ${tally.Failed} failed`;
  /* The tally counts the whole history and the list shows the newest few, so
     the note says which is which rather than letting the two disagree. */
  const note = total > runs.length ? `${counted}, latest ${runs.length} shown` : counted;

  return (
    <section className="ops-panel" aria-labelledby="ops-runs-title">
      <div className="ops-panel__head">
        <h3 className="ops-panel__title" id="ops-runs-title">
          {ruleName ? `Runs: ${ruleName}` : "Recent runs"}
        </h3>
        {/* Narrowed, the tally would describe a different set from the list, so
            the note becomes a plain count of what is actually shown. */}
        <p className="ops-panel__note">
          {ruleName ? `${total} ${total === 1 ? "run" : "runs"}` : note}
        </p>
      </div>

      {ruleName && onShowAll && (
        <p className="ops-runs__meta">
          <button type="button" className="ops-link-button" onClick={onShowAll}>
            Show all runs
          </button>
        </p>
      )}

      {runs.length === 0 ? (
        <p className="ops-empty">
          {ruleName ? "This rule has not run yet." : "No rule has run yet."}
        </p>
      ) : (
        /* List semantics without a list element. The panel gives `.ops-runs`
           no user-agent reset, and the indent one would bring would push each
           item's rule away from the edge it is measured against. */
        <div className="ops-runs" role="list">
          {runs.map((run) => (
            <div className="ops-runs__item" role="listitem" key={run.id}>
              <div className="ops-runs__head">
                <span className="ops-runs__rule">{run.ruleName}</span>
                <span className={`ops-pill ops-pill--${RUN_TONE[run.status]}`}>
                  {run.status}
                </span>
              </div>
              <p className="ops-runs__summary">{run.summary}</p>
              <p className="ops-runs__meta">
                <time dateTime={absoluteDate(run.startedAt)} title={absoluteDate(run.startedAt)}>
                  {relativeDate(run.startedAt, now)}
                </time>
                <span className="ops-rule__dot" aria-hidden="true"> · </span>
                {run.id}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
