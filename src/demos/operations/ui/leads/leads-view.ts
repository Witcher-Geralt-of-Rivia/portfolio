/**
 * Operations demo — how a lead reads on screen.
 *
 * Presentation only: which tone a stage wears, how a failure is worded, what a
 * sort control is called. No filtering, no ordering, no rules — those live in
 * `selectors/leads-list.ts` and the lead services, and duplicating any of them
 * here would create a second answer to a question the domain already settles.
 */

import { isDemoError } from "@/demo-runtime/types";

import type { LeadSortKey } from "../../selectors/leads-list";
import type { LeadStage, Priority } from "../../types";

/**
 * Stage tones.
 *
 * Colour is the secondary signal; every pill carries its stage in words, so a
 * reader who cannot separate four soft hues loses nothing. Qualified and Won
 * are deliberately different tones — they are the two most consequential
 * states and reading one as the other is the expensive mistake.
 */
export const STAGE_TONE: Record<LeadStage, string> = {
  New: "sky",
  Contacted: "lavender",
  Qualified: "aqua",
  Proposal: "peach",
  Won: "mint",
  Lost: "slate",
};

/**
 * Priority.
 *
 * A dot and a word, not a red badge. Everything in this list is a prospect
 * someone means to call; rendering a third of them as alarms would make the
 * table shout and say nothing.
 */
export const PRIORITY_TONE: Record<Priority, string> = {
  Low: "quiet",
  Normal: "normal",
  High: "high",
};

export const SORT_OPTIONS: readonly { key: LeadSortKey; label: string }[] = [
  { key: "lastActivity", label: "Last activity" },
  { key: "nextFollowUp", label: "Next follow-up" },
  { key: "name", label: "Lead name" },
  { key: "stage", label: "Stage" },
  { key: "priority", label: "Priority" },
  { key: "created", label: "Created" },
];

/** The column a sortable table heading sorts by, in table order. */
export const COLUMN_SORT: Record<string, LeadSortKey | null> = {
  Lead: "name",
  Source: null,
  Interest: null,
  Stage: "stage",
  Owner: null,
  Priority: "priority",
  "Last activity": "lastActivity",
  "Next follow-up": "nextFollowUp",
};

export const LEAD_COLUMNS = [
  "Lead",
  "Source",
  "Interest",
  "Stage",
  "Owner",
  "Priority",
  "Last activity",
  "Next follow-up",
] as const;

/**
 * A failure, in words a visitor can act on.
 *
 * The domain raises typed errors with their own messages, and most of them are
 * already plain — "This lead is already archived." needs no translation. This
 * adds what the code means when the message alone would leave someone
 * guessing, and it never surfaces a stack or an error class name.
 */
export function describeFailure(cause: unknown): string {
  if (!isDemoError(cause)) {
    return "Something went wrong and the change was not saved.";
  }

  switch (cause.code) {
    case "VALIDATION":
      return cause.message;
    case "CONFLICT":
      return cause.message;
    case "FORBIDDEN":
      return "The selected demo role cannot make this change.";
    case "NOT_FOUND":
      return "That lead no longer exists. It may have been reset.";
    case "UNAVAILABLE":
      return "Browser storage is unavailable, so the change was not saved.";
    default:
      return cause.message;
  }
}

/** The field a validation failure points at, when it names one. */
export function failedField(cause: unknown): string | null {
  if (!isDemoError(cause)) return null;
  return cause.code === "VALIDATION" ? (cause.detail ?? null) : null;
}
