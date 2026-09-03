"use client";

/**
 * Operations demo: the Automations module.
 *
 * Five rules and their history, and that is the whole screen. There is no
 * table, no search, no filter, no drawer and no rule builder. The five rules
 * are frozen: their triggers are a union in `types.ts` and their actions are
 * functions in `automations.ts`, so a builder here would be an interface for a
 * capability the domain does not have, and a create button would be a promise
 * no service can keep.
 *
 * What a visitor may do is switch a rule off, switch it back on, and run one
 * against a synthetic event. All three are Admin only, because these rules act
 * on every other module: switching one off changes what Leads, Reservations,
 * Payments and Maintenance do next.
 *
 * Two columns, one read. A rule card answers "what does this rule do, and how
 * has it been going"; the history answers "what happened, most recent first".
 * They are the same records seen from two sides rather than two derivations
 * that could disagree.
 */

import { useCallback, useMemo, useRef, useState } from "react";

import { useDemoQuery } from "@/demo-runtime/react/hooks";

import { C } from "../../constants";
import {
  buildRuleRows,
  buildRunRows,
  runTally,
  type RuleRow,
} from "../../selectors/automations-list";
import type { AutomationRule, AutomationRun, Role } from "../../types";
import { useOperations } from "../OperationsProvider";
import RuleCard from "./RuleCard";
import RuleConfirmAction, { type RuleActionKind } from "./RuleConfirmAction";
import RunHistory from "./RunHistory";
import { canOpenAutomations, canWorkAutomations } from "./automations-view";

type Overlay = { kind: "none" } | { kind: "rule"; action: RuleActionKind; ruleId: string };

const CLOSED: Overlay = { kind: "none" };

export default function AutomationsScreen() {
  const { ctx, role } = useOperations();

  const mayView = canOpenAutomations(role);
  const mayWrite = canWorkAutomations(role);

  const [overlay, setOverlay] = useState<Overlay>(CLOSED);
  const [announcement, setAnnouncement] = useState("");
  /* Which rule the history is narrowed to, or null for all of them. Held here
     rather than in the URL because it is a reading aid on one screen, not a
     selection worth deep-linking or restoring. */
  const [viewingRuleId, setViewingRuleId] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /* A role that can no longer open the module, or no longer write in it, must
     not be left looking at a live rule dialog. Done during render so no frame
     paints with it. */
  const [gatedFor, setGatedFor] = useState(`${mayView}:${mayWrite}`);
  if (gatedFor !== `${mayView}:${mayWrite}`) {
    setGatedFor(`${mayView}:${mayWrite}`);
    setOverlay(CLOSED);
  }

  /**
   * One role-keyed query for both collections.
   *
   * A run names its rule by id and nothing else, so the rules have to be read
   * beside the runs or the history would be a column of ids. Keyed on the role
   * because a role change is a different question: the previous answer is
   * dropped rather than shown while the new one is read (D-058).
   *
   * The clock is read here with the data it describes. Never the browser's
   * clock: this demo runs at a fixed logical time, and reading the real one
   * would make "Today" mean whenever the page happened to be opened.
   */
  const { data } = useDemoQuery(async () => {
    if (!ctx || !mayView) return null;
    const [rules, runs] = await Promise.all([
      ctx.runtime.repository.all<AutomationRule>(C.automationRules),
      ctx.runtime.repository.all<AutomationRun>(C.automationRuns),
    ]);
    return { rules, runs, now: ctx.runtime.now() };
  }, [role, mayView]);

  const ruleRows = useMemo(() => (data ? buildRuleRows(data) : null), [data]);
  const runRows = useMemo(() => {
    if (!data) return null;
    if (!viewingRuleId) return buildRunRows(data);
    /* Filtered before the cap, so narrowing to one rule shows that rule's
       twelve most recent runs rather than whatever survived the global slice. */
    return buildRunRows({
      rules: data.rules,
      runs: data.runs.filter((r) => r.data.ruleId === viewingRuleId),
    });
  }, [data, viewingRuleId]);
  const tally = useMemo(() => (data ? runTally(data) : null), [data]);

  /* The live row rather than the one the button was clicked on, so a dialog
     left open across a re-read describes the rule as it is now. */
  const selected: RuleRow | null = useMemo(() => {
    if (overlay.kind !== "rule" || !ruleRows) return null;
    return ruleRows.find((r) => r.id === overlay.ruleId) ?? null;
  }, [overlay, ruleRows]);

  const act = useCallback(
    (action: RuleActionKind, ruleId: string) => setOverlay({ kind: "rule", action, ruleId }),
    []
  );

  if (!mayView) {
    return <AutomationsUnavailable role={role} />;
  }

  /* The skeleton is for having nothing to show, not for refreshing what is
     already on screen. `useDemoQuery` keeps the previous answer while it
     re-reads, so a rule switching off updates the cards in place rather than
     blanking the module once per write. */
  if (!data || !ruleRows || !runRows || !tally) {
    return <AutomationsSkeleton />;
  }

  return (
    <div className="ops-automations">
      {/* Focusable, the grammar every module here uses. Nothing on this screen
          navigates away and back, so focus is left to the dialog, which returns
          it to the button that opened it. */}
      <h2 className="visually-hidden" ref={headingRef} tabIndex={-1}>
        Automations
      </h2>

      <div className="ops-automations__grid">
        <div className="ops-rules">
          {ruleRows.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              now={data.now}
              role={role}
              mayWrite={mayWrite}
              onAction={act}
              onViewRuns={setViewingRuleId}
              viewing={viewingRuleId === rule.id}
            />
          ))}
        </div>

        <RunHistory
          runs={runRows}
          tally={tally}
          total={
            viewingRuleId
              ? data.runs.filter((r) => r.data.ruleId === viewingRuleId).length
              : data.runs.length
          }
          now={data.now}
          ruleName={
            viewingRuleId
              ? (ruleRows.find((r) => r.id === viewingRuleId)?.name ?? null)
              : null
          }
          onShowAll={() => setViewingRuleId(null)}
        />
      </div>

      {overlay.kind === "rule" && selected && (
        <RuleConfirmAction
          kind={overlay.action}
          rule={selected}
          onCancel={() => setOverlay(CLOSED)}
          onDone={(message) => {
            setOverlay(CLOSED);
            /* Announcing is enough to refresh the screen as well as the
               visitor: the query re-runs on the runtime revision, so the cards
               and the history have already been re-read by the time this is
               read out. */
            setAnnouncement(message);
          }}
        />
      )}

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

function AutomationsSkeleton() {
  return (
    <div className="ops-automations" aria-busy="true">
      <div className="ops-automations__grid">
        <div className="ops-rules">
          <div className="ops-skeleton ops-skeleton--cards" />
        </div>
        <div className="ops-panel ops-skeleton ops-skeleton--panel" />
      </div>
      <p className="visually-hidden" role="status">
        Loading automation rules
      </p>
    </div>
  );
}

/**
 * What a role that cannot open Automations sees.
 *
 * Contained rather than a redirect, for the reason every module here gives:
 * sending someone elsewhere hides both that the module exists and that their
 * role is why it is closed. Three of the four roles land here, and the panel
 * says why rather than treating the closed door as self-evident.
 */
function AutomationsUnavailable({ role }: { role: Role }) {
  return (
    <div className="ops-unavailable" role="note">
      <p className="ops-unavailable__eyebrow">Module unavailable</p>
      <p className="ops-unavailable__text">
        The <strong>{role}</strong> role does not open the automation rules in this
        simulation. Switch the demo role in the bar above to Admin to see them.
      </p>
      <p className="ops-unavailable__text">
        The rules act on every other module: one assigns a new lead, one moves a
        follow-up date, one writes into a customer conversation, and two raise
        notifications. Switching one off is the most consequential control in the
        product, which is why only Admin holds it.
      </p>
      <p className="ops-unavailable__note">
        The permission matrix is simulated to show where rules are enforced. It is not
        authentication, and the synthetic records stay in this browser either way.
      </p>
    </div>
  );
}
