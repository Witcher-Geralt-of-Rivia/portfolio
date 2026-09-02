/**
 * Operations demo: module route configuration.
 *
 * The eleven modules, their canonical paths, and which of them exist yet.
 *
 * `implemented` is **temporary build state, not part of the product domain**.
 * It exists because 09C2 ships the shell and Overview while the other ten
 * screens arrive in 09C3 to 09C5, and a navigation item that leads to a 404 is
 * worse than one that plainly says it is not there yet. By 09C5 every module
 * is interactive and this flag (and the styling that reads it) is deleted.
 *
 * Nothing outside the shell consults it. Role permission is a separate
 * question answered by `permissions.ts`: a module can be unimplemented and
 * permitted, or implemented and hidden from the current role, and the two are
 * resolved independently.
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
  /** TEMPORARY: false until that module's stage builds it. */
  implemented: boolean;
};

const ROOT = "/demos/operations";

/**
 * Declaration order is the sidebar order, and the grouping the specification
 * freezes. `Overview` sits alone above the groups.
 */
export const MODULE_ROUTES: readonly ModuleRoute[] = [
  { id: "Overview", label: "Overview", href: ROOT, group: "primary", context: "Rental operations at a glance", implemented: true },

  { id: "Leads", label: "Leads", href: `${ROOT}/leads`, group: "Customer operations", context: "CRM pipeline", implemented: true },
  { id: "Customers", label: "Customers", href: `${ROOT}/customers`, group: "Customer operations", context: "Accounts and history", implemented: true },
  { id: "Reservations", label: "Reservations", href: `${ROOT}/reservations`, group: "Customer operations", context: "Bookings and availability", implemented: false },
  { id: "Contracts", label: "Contracts", href: `${ROOT}/contracts`, group: "Customer operations", context: "Active and closed agreements", implemented: false },

  { id: "Fleet", label: "Fleet", href: `${ROOT}/fleet`, group: "Operations", context: "Vehicles and status", implemented: false },
  { id: "Maintenance", label: "Maintenance", href: `${ROOT}/maintenance`, group: "Operations", context: "Work orders", implemented: false },
  { id: "Payments", label: "Payments", href: `${ROOT}/payments`, group: "Operations", context: "Balances and settlement", implemented: false },

  { id: "Automations", label: "Automations", href: `${ROOT}/automations`, group: "System", context: "Rules and runs", implemented: false },
  { id: "Inbox", label: "Inbox", href: `${ROOT}/inbox`, group: "System", context: "Conversations", implemented: false },
  { id: "Reports", label: "Reports", href: `${ROOT}/reports`, group: "System", context: "Derived figures", implemented: false },
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
