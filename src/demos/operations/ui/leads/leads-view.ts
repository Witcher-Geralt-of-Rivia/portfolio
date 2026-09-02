/**
 * Operations demo — how a lead reads on screen.
 *
 * Presentation only: which tone a stage wears, how a failure is worded, what a
 * sort control is called. No filtering, no ordering, no rules — those live in
 * `selectors/leads-list.ts` and the lead services, and duplicating any of them
 * here would create a second answer to a question the domain already settles.
 */

import { isDemoError } from "@/demo-runtime/types";

import type { SortDirection } from "@/demo-runtime/types";

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

/**
 * Sort, as one choice rather than two.
 *
 * The screen used to offer a field in a select and a direction in a small
 * square button beside it. The button showed an arrow and nothing else, so it
 * asked the visitor to work out that it belonged to the select, and then which
 * way the arrow meant — two guesses to answer one question.
 *
 * Each field is listed with both of its directions, worded for the field
 * rather than as "ascending" and "descending": dates have a newest and an
 * oldest end, a name has A-Z, and a pipeline has an early and a late end.
 * Twelve options, which is a menu a person can read.
 *
 * The direction words carry the meaning; there is no arrow to interpret, and a
 * screen reader announces the whole choice rather than a symbol.
 */
export type SortChoice = { value: string; label: string; key: LeadSortKey; direction: SortDirection };

const choice = (
  key: LeadSortKey,
  direction: SortDirection,
  label: string
): SortChoice => ({ value: `${key}:${direction}`, label, key, direction });

export const SORT_CHOICES: readonly SortChoice[] = [
  choice("lastActivity", "desc", "Last activity — newest"),
  choice("lastActivity", "asc", "Last activity — oldest"),
  choice("nextFollowUp", "asc", "Next follow-up — soonest"),
  choice("nextFollowUp", "desc", "Next follow-up — latest"),
  choice("name", "asc", "Lead name — A–Z"),
  choice("name", "desc", "Lead name — Z–A"),
  choice("stage", "asc", "Stage — early first"),
  choice("stage", "desc", "Stage — late first"),
  choice("priority", "desc", "Priority — high first"),
  choice("priority", "asc", "Priority — low first"),
  choice("created", "desc", "Created — newest"),
  choice("created", "asc", "Created — oldest"),
];

export function sortValue(key: LeadSortKey, direction: SortDirection): string {
  return `${key}:${direction}`;
}

export function parseSortValue(value: string): { key: LeadSortKey; direction: SortDirection } {
  const hit = SORT_CHOICES.find((c) => c.value === value);
  /* The default is the frozen one, not the first entry by accident. */
  return hit
    ? { key: hit.key, direction: hit.direction }
    : { key: "lastActivity", direction: "desc" };
}

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
