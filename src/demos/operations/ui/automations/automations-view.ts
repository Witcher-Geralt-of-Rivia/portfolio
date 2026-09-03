/**
 * Operations demo: what the Automations module shows, and to whom.
 *
 * Admin only, read and write. The other three roles do not see the module at
 * all, which is the frozen matrix and also the right answer: the rules act on
 * every other module, so being able to switch one off is the most consequential
 * control in the product.
 *
 * There is no rule builder here and there will not be one. The five rules are
 * the product: they are seeded, their triggers are a frozen union, and their
 * actions are functions in `automations.ts`. What a visitor may do is enable
 * one, disable one, and run one against a synthetic event.
 */

import { canViewModule, canWriteModule } from "../../permissions";
import type { AutomationRunStatus, Role } from "../../types";

export function canOpenAutomations(role: Role): boolean {
  return canViewModule(role, "Automations");
}

export function canWorkAutomations(role: Role): boolean {
  return canWriteModule(role, "Automations");
}

/* =====================================================================
   PRESENTATION
   ===================================================================== */

/**
 * Run outcomes.
 *
 * Failed is peach rather than red for the same reason nothing else in this
 * product is red: a rule that could not complete is information, and the word
 * says it. Skipped is the quiet one, because a skipped run is the normal and
 * correct behaviour of a rule someone deliberately turned off.
 */
export const RUN_TONE: Record<AutomationRunStatus, string> = {
  Success: "mint",
  Skipped: "slate",
  Failed: "peach",
};

/** Enabled and disabled, as a state a reader can see without decoding a colour. */
export const ENABLED_TONE: Record<"on" | "off", string> = {
  on: "sky",
  off: "slate",
};

const ROOT = "/demos/operations";

/**
 * Where a visitor goes to make a trigger happen for real.
 *
 * The Test action runs a rule against a synthetic event, which is useful and
 * honest but is not the same as the rule firing because something happened.
 * These links are the other half of that: the module where the real cause
 * lives.
 */
export const MODULE_HREF: Record<string, string> = {
  Leads: `${ROOT}/leads`,
  Reservations: `${ROOT}/reservations`,
  Payments: `${ROOT}/payments`,
  Maintenance: `${ROOT}/maintenance`,
};
