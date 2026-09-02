/**
 * Operations demo: what each role sees on Customers.
 *
 * One policy table, derived from `permissions.ts` rather than restated, so the
 * two cannot drift. The rule it encodes is the one `overview-policy.ts`
 * established: **a role must not see a surface belonging to a module it cannot
 * open.** A customer's reservations are the Reservations module's data in
 * summary form, and a Finance Analyst cannot open Reservations.
 *
 * That applies to the table as well as the drawer. A column the role may not
 * see is not rendered empty or dashed out, because a column of dashes still
 * tells the reader that something exists and is being withheld: it is not
 * defined at all for that role.
 */

import { canViewModule, canWriteModule } from "../../permissions";
import type { ModuleName, Role } from "../../types";
import type { CustomerSortKey } from "../../selectors/customers-list";
import type { SortDirection } from "@/demo-runtime/types";

/* =====================================================================
   TABLE COLUMNS
   ===================================================================== */

export type CustomerColumn =
  | "Customer"
  | "Status"
  | "Segment"
  | "Origin"
  | "Contracts"
  | "Reservations"
  | "Updated";

/** The module whose data each column summarises. Null means the customer's own. */
const COLUMN_MODULE: Record<CustomerColumn, ModuleName | null> = {
  Customer: null,
  Status: null,
  Segment: null,
  /* Origin names the lead this customer came from, so it belongs to Leads.
     The column still appears for a role that cannot open Leads: what it shows
     then is provenance without the link, which is the customer's own fact. */
  Origin: null,
  Contracts: "Contracts",
  Reservations: "Reservations",
  Updated: null,
};

const COLUMN_ORDER: CustomerColumn[] = [
  "Customer",
  "Status",
  "Segment",
  "Origin",
  "Contracts",
  "Reservations",
  "Updated",
];

export function customerColumnsFor(role: Role): CustomerColumn[] {
  return COLUMN_ORDER.filter((column) => {
    const owner = COLUMN_MODULE[column];
    return owner === null || canViewModule(role, owner);
  });
}

/** Which columns a header may sort by. */
export const COLUMN_SORT: Partial<Record<CustomerColumn, CustomerSortKey>> = {
  Customer: "name",
  Status: "status",
  Segment: "segment",
  Updated: "updated",
};

/* =====================================================================
   DETAIL SECTIONS
   ===================================================================== */

export type RelationSection =
  | "origin"
  | "reservations"
  | "contracts"
  | "payments"
  | "conversations";

const SECTION_MODULE: Record<RelationSection, ModuleName> = {
  origin: "Leads",
  reservations: "Reservations",
  contracts: "Contracts",
  payments: "Payments",
  conversations: "Inbox",
};

/**
 * Section order, per role.
 *
 * Finance is not Admin with sections blanked out. Its order puts what it can
 * act on first, so the drawer reads as a purpose-built finance view rather
 * than a CRM view with holes in it.
 */
const ORDER_BY_ROLE: Record<Role, RelationSection[]> = {
  Admin: ["origin", "reservations", "contracts", "payments", "conversations"],
  "Sales Agent": ["origin", "reservations", "contracts", "conversations"],
  "Finance Analyst": ["contracts", "payments"],
  /* Fleet Coordinator cannot open Customers at all, so this is never read. */
  "Fleet Coordinator": [],
};

export function relationSectionsFor(role: Role): RelationSection[] {
  return ORDER_BY_ROLE[role].filter((section) =>
    canViewModule(role, SECTION_MODULE[section])
  );
}

/**
 * Whether the origin may be a link rather than a label.
 *
 * A converted customer always says so. Only a role that can open Leads gets a
 * way through to the record, and only then is the lead's own data read at all.
 */
export function canOpenSourceLead(role: Role): boolean {
  return canViewModule(role, "Leads");
}

export function canMutateCustomers(role: Role): boolean {
  return canWriteModule(role, "Customers");
}

/* =====================================================================
   PRESENTATION
   ===================================================================== */

/** Active reads as a quiet positive; Inactive is colourless rather than a warning. */
export const STATUS_TONE: Record<string, string> = {
  Active: "mint",
  Inactive: "slate",
};

/**
 * Segment is quieter than status.
 *
 * Status is a state someone acts on. Segment is a classification, and giving
 * its three values three colours would make the table louder without making it
 * more legible.
 */
export const SEGMENT_TONE = "quiet";

export type CustomerSortChoice = {
  value: string;
  label: string;
  key: CustomerSortKey;
  direction: SortDirection;
};

const choice = (
  key: CustomerSortKey,
  direction: SortDirection,
  label: string
): CustomerSortChoice => ({ value: `${key}:${direction}`, label, key, direction });

/** Field and direction as one choice, worded for the field (D-069). */
export const SORT_CHOICES: readonly CustomerSortChoice[] = [
  choice("updated", "desc", "Updated: newest"),
  choice("updated", "asc", "Updated: oldest"),
  choice("name", "asc", "Customer name: A-Z"),
  choice("name", "desc", "Customer name: Z-A"),
  choice("created", "desc", "Created: newest"),
  choice("created", "asc", "Created: oldest"),
  choice("segment", "asc", "Segment: A-Z"),
  choice("status", "asc", "Status: Active first"),
];

export function sortValue(key: CustomerSortKey, direction: SortDirection): string {
  return `${key}:${direction}`;
}

export function parseSortValue(value: string): {
  key: CustomerSortKey;
  direction: SortDirection;
} {
  const hit = SORT_CHOICES.find((c) => c.value === value);
  return hit ? { key: hit.key, direction: hit.direction } : { key: "updated", direction: "desc" };
}
