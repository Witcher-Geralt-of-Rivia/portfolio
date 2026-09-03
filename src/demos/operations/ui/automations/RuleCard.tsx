"use client";

/**
 * Operations demo: one automation rule.
 *
 * A card rather than a table row, because a rule is not a record anyone scans
 * a hundred of. There are five, they are frozen, and each has to explain
 * itself: what wakes it, what it does when it wakes, how often it has run and
 * how those runs went.
 *
 * The trigger is printed twice on purpose. The sentence is for a reader; the
 * event type beside it is because this is an engineering demonstration, and a
 * product that hid its own wiring would be missing the point.
 *
 * Nothing here is editable. The name, the trigger and the action are the rule,
 * and the services that own them offer no way to change any of the three, so
 * the card offers none either. The two controls it does offer are the two the
 * domain actually has.
 */

import { useId } from "react";
import Link from "next/link";

import { canViewModule } from "../../permissions";
import {
  TRIGGER_DESCRIPTION,
  TRIGGER_SOURCE,
  type RuleRow,
} from "../../selectors/automations-list";
import { absoluteDate, relativeDate } from "../../selectors/leads-list";
import type { ModuleName, Role } from "../../types";
import type { RuleActionKind } from "./RuleConfirmAction";
import { ENABLED_TONE, MODULE_HREF, RUN_TONE } from "./automations-view";

type Props = {
  rule: RuleRow;
  /** The demo's logical clock, passed in so nothing here reads the real one. */
  now: string;
  role: Role;
  mayWrite: boolean;
  onAction: (action: RuleActionKind, ruleId: string) => void;
  /** Narrows the run history beside the rules to this one rule, or back. */
  onViewRuns: (ruleId: string | null) => void;
  /** True when the history is already showing only this rule. */
  viewing: boolean;
};

/** The separator between meta items, which carries no meaning of its own. */
function Dot() {
  return (
    <span className="ops-rule__dot" aria-hidden="true">
      ·
    </span>
  );
}

export default function RuleCard({
  rule,
  now,
  role,
  mayWrite,
  onAction,
  onViewRuns,
  viewing,
}: Props) {
  const nameId = useId();
  /* Every value in TRIGGER_SOURCE is a module name. The map is typed as string
     so the view module does not have to import the domain union, and the
     narrowing happens here, where the permission check needs it. */
  const source = TRIGGER_SOURCE[rule.trigger] as ModuleName;

  return (
    <article
      className={`ops-rule${rule.enabled ? "" : " ops-rule--off"}`}
      aria-labelledby={nameId}
    >
      <div className="ops-rule__head">
        <h3 className="ops-rule__name" id={nameId}>
          {rule.name}
        </h3>
        {/* The state as a word. A quieter card would say it too, but a reader
            who cannot separate two soft hues would be reading nothing. */}
        <span className={`ops-pill ops-pill--${ENABLED_TONE[rule.enabled ? "on" : "off"]}`}>
          {rule.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      <div className="ops-rule__trigger">
        <p className="ops-rule__when">{TRIGGER_DESCRIPTION[rule.trigger]}</p>
        {/* The raw event type, deliberately. It is what the engine matches on,
            and it is the one line that ties this card to the code. */}
        <p className="ops-rule__event">{rule.trigger}</p>
      </div>

      <p className="ops-rule__action">{rule.action}</p>

      <p className="ops-rule__meta">
        <span>
          {rule.runCount} {rule.runCount === 1 ? "run" : "runs"}
        </span>
        <Dot />
        <span title={rule.lastRunAt ? absoluteDate(rule.lastRunAt) : undefined}>
          {rule.lastRunAt ? `Last run ${relativeDate(rule.lastRunAt, now)}` : "Never run"}
        </span>
        <Dot />
        {/* Three counts, each with its own word. The tally is over this rule's
            own runs, which is the denominator the run count beside it gives. */}
        <span>{rule.successes} succeeded</span>
        <Dot />
        <span>{rule.skipped} skipped</span>
        <Dot />
        <span>{rule.failures} failed</span>
      </p>

      {rule.lastStatus && (
        <p className="ops-rule__last">
          <span className={`ops-pill ops-pill--${RUN_TONE[rule.lastStatus]}`}>
            {rule.lastStatus}
          </span>
          <span className="ops-rule__last-summary">{rule.lastSummary}</span>
        </p>
      )}

      {canViewModule(role, source) && (
        /* The other half of Test. A synthetic run is honest, but it is not the
           rule firing because something happened, and this is where the real
           cause lives. Guarded by the role even though only Admin reaches this
           card today: the policy lives in `permissions.ts`, and a link that
           assumed the matrix never moves would be a second copy of it.

           The meta row shape is reused so the link sits with the rest of the
           small print, and so the underline stays on the words rather than
           stretching across the card. */
        <p className="ops-rule__meta">
          <Link className="ops-link-button" href={MODULE_HREF[source]}>
            Make this happen in {source}
          </Link>
        </p>
      )}

      <div className="ops-rule__foot">
        {mayWrite && (
          <>
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={() => onAction(rule.enabled ? "disable" : "enable", rule.id)}
            >
              {rule.enabled ? "Disable" : "Enable"}
              {/* Five cards carry the same two verbs, so each button says which
                  rule it belongs to when it is read on its own. */}
              <span className="visually-hidden"> {rule.name}</span>
            </button>
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={() => onAction("test", rule.id)}
            >
              Test rule
              <span className="visually-hidden"> {rule.name}</span>
            </button>
          </>
        )}
        {/* Reading is not writing, so this one is not behind `mayWrite`. It
            narrows the feed beside the rules rather than opening a second
            screen: the history is already on the page, and a rule's runs are
            the same records seen through one filter. */}
        <button
          type="button"
          className="ops-button ops-button--quiet"
          aria-pressed={viewing}
          onClick={() => onViewRuns(viewing ? null : rule.id)}
        >
          {viewing ? "Show all runs" : "View runs"}
          <span className="visually-hidden"> {viewing ? "" : `for ${rule.name}`}</span>
        </button>
      </div>
    </article>
  );
}
