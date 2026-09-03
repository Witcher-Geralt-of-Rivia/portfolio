"use client";

/**
 * Operations demo: confirming an automation rule control.
 *
 * Three actions that deserve a deliberate second step, sharing one dialog
 * because they share a shape: state what will happen, name the rule, and let
 * the service refuse in its own words if it is going to.
 *
 * These calls go to `setRuleEnabled` and `testRule` rather than to a workflow
 * wrapper, and that is a decision rather than an oversight of D-088. The rule
 * that says mutations go through the workflow layer exists so a screen does
 * not have to know which service happens to have a rule listening behind it.
 * Here the answer is settled by the trigger union itself: nothing fires on
 * `automation.rule_enabled` or `automation.rule_disabled`, and nothing can,
 * because the five triggers are frozen and none of them is an automation
 * event. So there is no wrapper to depend on. Both services already do their
 * own permission check and their own commit, and `testRule` already records
 * the AutomationRun, which makes them the application boundary for this
 * module rather than bare persistence reached around the side.
 *
 * Test is the one action that does not close on success. It writes a real run
 * and the visitor should see the run it wrote, so the outcome is shown here,
 * in the dialog, with the id of the record. A toast claiming it worked would
 * be the component telling the visitor what the service said instead of
 * showing it.
 */

import { useEffect, useRef, useState } from "react";

import type { RuleRow } from "../../selectors/automations-list";
import {
  setRuleEnabled,
  testRule,
  type AutomationOutcome,
} from "../../services/automations";
import { useOperations } from "../OperationsProvider";
import OpsOverlay from "../leads/OpsOverlay";
import { useLeadAction } from "../leads/use-lead-action";
import { RUN_TONE } from "./automations-view";

export type RuleActionKind = "enable" | "disable" | "test";

const COPY: Record<
  RuleActionKind,
  { title: string; body: string; action: string; pending: string }
> = {
  disable: {
    title: "Disable this rule?",
    body:
      "The rule stops acting. Events that would have woken it are still recorded as runs, marked Skipped, so the history shows what did not happen rather than falling silent.",
    action: "Disable rule",
    pending: "Disabling...",
  },
  enable: {
    title: "Enable this rule?",
    body:
      "The rule starts acting again on the next matching event. Nothing that was skipped while it was off is replayed: those runs are a record of what happened, not a queue.",
    action: "Enable rule",
    pending: "Enabling...",
  },
  test: {
    title: "Test this rule?",
    body:
      "The rule runs against a synthetic event and writes a real AutomationRun, so the result lands in the history exactly as a real one would. It deliberately does not touch business records: a Test button that quietly reassigned a real lead would be a trap. A rule that is acting raises an in-app notification and nothing else, a rule that is switched off records a Skipped run, and nothing is sent anywhere.",
    action: "Run test",
    pending: "Running...",
  },
};

type Props = {
  kind: RuleActionKind;
  rule: RuleRow;
  onCancel: () => void;
  onDone: (message: string) => void;
};

export default function RuleConfirmAction({ kind, rule, onCancel, onDone }: Props) {
  const { ctx } = useOperations();
  const action = useLeadAction();
  const [outcome, setOutcome] = useState<AutomationOutcome | null>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  const copy = COPY[kind];

  /* The button that started the test is replaced by the one that closes the
     dialog, so focus is moved rather than dropped to the dialog itself. */
  useEffect(() => {
    if (outcome) doneRef.current?.focus();
  }, [outcome]);

  const run = async () => {
    if (!ctx) return;

    if (kind === "test") {
      const result = await action.run(() => testRule(ctx, rule.id));
      /* Success is not the end of this one: the run that was written is what
         the visitor came to see, so the dialog stays and shows it. */
      if (result) setOutcome(result);
      return;
    }

    /* Test returned above, so the only two kinds left are the two directions
       of one call. The service refuses a rule that is already in the state
       being asked for, which is the one refusal this dialog can provoke. */
    const enabling = kind === "enable";
    const settled = await action.run(async () => {
      await setRuleEnabled(ctx, rule.id, enabling);
      return true;
    });
    if (settled) onDone(`${rule.name} ${enabling ? "enabled" : "disabled"}`);
    /* A refusal leaves the dialog open carrying the service's own sentence:
       closing would hide the one thing the visitor needs to read. */
  };

  const title = outcome ? "Test run recorded" : copy.title;

  return (
    <OpsOverlay
      variant="dialog"
      label={title}
      onClose={onCancel}
      busy={action.pending}
      className="ops-confirm"
    >
      <h2 className="ops-confirm__title">{title}</h2>
      <p className="ops-confirm__subject">
        {rule.name} <span className="ops-confirm__id">{rule.id}</span>
      </p>

      {outcome ? (
        <>
          <p className="ops-confirm__body">
            The rule ran against a synthetic event, and this is the AutomationRun it
            wrote. It sits in the history beside the runs that real events caused. No
            business record was changed and nothing was sent anywhere.
          </p>

          <dl className="ops-facts">
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Outcome</dt>
              <dd className="ops-facts__value">
                <span className={`ops-pill ops-pill--${RUN_TONE[outcome.status]}`}>
                  {outcome.status}
                </span>
              </dd>
            </div>
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Summary</dt>
              <dd className="ops-facts__value">{outcome.summary}</dd>
            </div>
            <div className="ops-facts__row">
              <dt className="ops-facts__label">Run</dt>
              <dd className="ops-facts__value">
                <span className="ops-mono">{outcome.runId}</span>
              </dd>
            </div>
          </dl>

          <div className="ops-confirm__actions">
            <button
              type="button"
              className="ops-button ops-button--primary"
              ref={doneRef}
              onClick={() => onDone(`Test run completed: ${outcome.status}`)}
            >
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="ops-confirm__body">{copy.body}</p>

          {action.error && (
            <p className="ops-alert" role="alert">
              {action.error}
            </p>
          )}

          <div className="ops-confirm__actions">
            <button
              type="button"
              className="ops-button ops-button--quiet"
              onClick={onCancel}
              disabled={action.pending}
            >
              Back
            </button>
            <button
              type="button"
              className="ops-button ops-button--primary"
              onClick={run}
              disabled={action.pending}
            >
              {action.pending ? copy.pending : copy.action}
            </button>
          </div>
        </>
      )}
    </OpsOverlay>
  );
}
