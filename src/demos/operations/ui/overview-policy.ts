/**
 * Operations demo: what each role sees on the Overview.
 *
 * One table, not a scatter of `role === "..."` tests through the JSX. The
 * rule it encodes is stronger than hiding KPI cards: **a role must not see a
 * panel for a module it cannot open.** A KPI, a funnel or a reservation table
 * is that module's data in summary form, so leaving one on screen would make
 * the Overview a hole in the permission matrix it is supposed to respect.
 *
 * Every entry is derived from `permissions.ts` rather than restated, so the
 * two cannot drift: a panel appears only when its module is visible to the
 * role. The table below records which module each surface belongs to, and the
 * composition falls out of that.
 */

import { canViewModule } from "../permissions";
import type { ModuleName, Role } from "../types";

export type PanelId =
  | "leadFunnel"
  | "fleetStatus"
  | "upcomingReservations"
  | "paymentStatus"
  | "contractStatus"
  | "actionQueue";

export type KpiKey =
  | "openLeads"
  | "confirmedReservations"
  | "vehiclesAvailable"
  | "paymentsRequiringAttention";

export type ActionCategory = "payment" | "maintenance" | "lead" | "notification";

/** The module whose data each surface summarises. */
const KPI_MODULE: Record<KpiKey, ModuleName> = {
  openLeads: "Leads",
  confirmedReservations: "Reservations",
  vehiclesAvailable: "Fleet",
  paymentsRequiringAttention: "Payments",
};

const PANEL_MODULE: Record<Exclude<PanelId, "actionQueue">, ModuleName> = {
  leadFunnel: "Leads",
  fleetStatus: "Fleet",
  upcomingReservations: "Reservations",
  paymentStatus: "Payments",
  contractStatus: "Contracts",
};

const ACTION_MODULE: Record<ActionCategory, ModuleName> = {
  payment: "Payments",
  maintenance: "Maintenance",
  lead: "Leads",
  /* A notification is only ever raised about something; a role that can see no
     module that raises them has no business seeing the notifications either.
     Overview is visible to every role, so this is the permissive case and the
     category filter below does the real work. */
  notification: "Overview",
};

/**
 * Payment Status and Contract Status are Finance's substitutes for the
 * operational panels it cannot see. Showing them to Admin as well would
 * duplicate what the Reports module will carry, so they appear only where a
 * role has no richer operational panel to show.
 */
const FINANCE_ONLY_PANELS: PanelId[] = ["paymentStatus", "contractStatus"];

const KPI_ORDER: KpiKey[] = [
  "openLeads",
  "confirmedReservations",
  "vehiclesAvailable",
  "paymentsRequiringAttention",
];

const PANEL_ORDER: PanelId[] = [
  "leadFunnel",
  "fleetStatus",
  "paymentStatus",
  "contractStatus",
  "upcomingReservations",
  "actionQueue",
];

const ACTION_ORDER: ActionCategory[] = ["payment", "maintenance", "lead", "notification"];

export type OverviewComposition = {
  kpis: KpiKey[];
  panels: PanelId[];
  actionCategories: ActionCategory[];
};

/**
 * Whether a role's operational panels are thin enough to warrant the finance
 * summaries. Finance can open Payments and Contracts but neither Leads, Fleet
 * nor Reservations, so it would otherwise have a KPI and an action list and
 * nothing else.
 */
function needsFinancePanels(role: Role): boolean {
  const operational: ModuleName[] = ["Leads", "Fleet", "Reservations"];
  return (
    canViewModule(role, "Payments") && operational.every((m) => !canViewModule(role, m))
  );
}

export function overviewFor(role: Role): OverviewComposition {
  const financePanels = needsFinancePanels(role);

  return {
    kpis: KPI_ORDER.filter((k) => canViewModule(role, KPI_MODULE[k])),
    panels: PANEL_ORDER.filter((panel) => {
      if (panel === "actionQueue") return true;
      if (FINANCE_ONLY_PANELS.includes(panel)) {
        return financePanels && canViewModule(role, PANEL_MODULE[panel]);
      }
      return canViewModule(role, PANEL_MODULE[panel]);
    }),
    actionCategories: ACTION_ORDER.filter((c) => canViewModule(role, ACTION_MODULE[c])),
  };
}

/**
 * Notifications a role should not see.
 *
 * A notification carries a category naming the area it came from, so a role
 * that cannot open that area should not be told about it either. Otherwise
 * the action queue leaks through the door the panel filter just closed.
 */
const NOTIFICATION_MODULE: Record<string, ModuleName> = {
  CRM: "Leads",
  Reservation: "Reservations",
  Finance: "Payments",
  Maintenance: "Maintenance",
  Automation: "Automations",
};

export function canSeeNotification(role: Role, category: string): boolean {
  /* Not named `module`: Next reserves that identifier. */
  const owner = NOTIFICATION_MODULE[category];
  return owner ? canViewModule(role, owner) : true;
}
