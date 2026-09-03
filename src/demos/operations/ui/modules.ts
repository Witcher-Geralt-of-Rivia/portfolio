/**
 * Operations demo: module route configuration.
 *
 * The eleven modules, their canonical paths and their grouping.
 *
 * This file used to carry a second, temporary field. `implemented` was false
 * for every module whose stage had not run yet, and the sidebar rendered those
 * as non-interactive labels rather than links to a 404. It was always declared
 * as build state rather than product domain, and it was always going to be
 * deleted once the eleventh module landed. 09C4.B is that moment, so it is
 * gone, along with the sidebar branch and the two styles that read it.
 *
 * What remains is one question, answered in one place. Whether a module
 * appears at all is `permissions.ts`, and nothing else.
 */

import type { ModuleName } from "../types";

export type ModuleGroup = "primary" | "Customer operations" | "Operations" | "System";

export type ModuleRoute = {
  id: ModuleName;
  label: string;
  href: string;
  group: ModuleGroup;
  /** The top bar's secondary line for this module. */
  context: string;
};

const ROOT = "/demos/operations";

/**
 * Declaration order is the sidebar order, and the grouping the specification
 * freezes. `Overview` sits alone above the groups.
 */
export const MODULE_ROUTES: readonly ModuleRoute[] = [
  { id: "Overview", label: "Overview", href: ROOT, group: "primary", context: "Rental operations at a glance" },

  { id: "Leads", label: "Leads", href: `${ROOT}/leads`, group: "Customer operations", context: "CRM pipeline" },
  { id: "Customers", label: "Customers", href: `${ROOT}/customers`, group: "Customer operations", context: "Accounts and history" },
  { id: "Reservations", label: "Reservations", href: `${ROOT}/reservations`, group: "Customer operations", context: "Bookings and availability" },
  { id: "Contracts", label: "Contracts", href: `${ROOT}/contracts`, group: "Customer operations", context: "Active and closed agreements" },

  { id: "Fleet", label: "Fleet", href: `${ROOT}/fleet`, group: "Operations", context: "Vehicles and status" },
  { id: "Maintenance", label: "Maintenance", href: `${ROOT}/maintenance`, group: "Operations", context: "Work orders" },
  { id: "Payments", label: "Payments", href: `${ROOT}/payments`, group: "Operations", context: "Balances and settlement" },

  { id: "Automations", label: "Automations", href: `${ROOT}/automations`, group: "System", context: "Rules and runs" },
  { id: "Inbox", label: "Inbox", href: `${ROOT}/inbox`, group: "System", context: "Conversations" },
  { id: "Reports", label: "Reports", href: `${ROOT}/reports`, group: "System", context: "Derived figures" },
];

export const MODULE_GROUPS: readonly ModuleGroup[] = [
  "primary",
  "Customer operations",
  "Operations",
  "System",
];

export function routesInGroup(group: ModuleGroup): ModuleRoute[] {
  return MODULE_ROUTES.filter((m) => m.group === group);
}

export function routeFor(id: ModuleName): ModuleRoute {
  const hit = MODULE_ROUTES.find((m) => m.id === id);
  if (!hit) throw new Error(`No route configured for module "${id}".`);
  return hit;
}

/**
 * The module a pathname belongs to.
 *
 * The shell reads this instead of being told by each page, so the URL is the
 * one thing that decides which navigation entry is current and what the top
 * bar says. Longest match wins, or `/demos/operations/leads` would resolve to
 * Overview, whose href is a prefix of every other module's.
 */
export function routeForPath(pathname: string): ModuleRoute {
  const matches = MODULE_ROUTES.filter(
    (m) => pathname === m.href || pathname.startsWith(`${m.href}/`)
  ).sort((a, b) => b.href.length - a.href.length);
  return matches[0] ?? routeFor("Overview");
}
