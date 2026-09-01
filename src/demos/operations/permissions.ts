/**
 * Operations demo — the role policy.
 *
 * One table, consulted by the domain services and later by the UI. Putting it
 * here rather than in each screen means a permission cannot be enforced in the
 * sidebar and forgotten in the service beneath it — which is the bug that makes
 * frontend role handling look like decoration.
 *
 * This is an interaction simulation, not a security boundary. Nothing is
 * authenticated, every record stays readable in browser storage whatever role
 * is selected, and none of it should ever be described as RBAC or access
 * control. What it demonstrates is that an application enforces its rules in
 * one place, which is a real engineering property even when the rules
 * themselves are simulated.
 */

import { DemoError } from "@/demo-runtime/types";

import type { ModuleName, OperationsSession, Role } from "./types";

export type Access = "rw" | "r" | "none";

/**
 * The frozen matrix from `docs/DEMO_OPERATIONS_SPEC.md`.
 *
 * `rw` read and write, `r` read-only, `none` the module is not visible.
 */
const MATRIX: Record<Role, Record<ModuleName, Access>> = {
  Admin: {
    Overview: "rw",
    Leads: "rw",
    Customers: "rw",
    Reservations: "rw",
    Contracts: "rw",
    Fleet: "rw",
    Maintenance: "rw",
    Payments: "rw",
    Automations: "rw",
    Inbox: "rw",
    Reports: "rw",
  },
  "Sales Agent": {
    Overview: "r",
    Leads: "rw",
    Customers: "rw",
    Reservations: "rw",
    Contracts: "r",
    Fleet: "none",
    Maintenance: "none",
    Payments: "none",
    Automations: "none",
    Inbox: "rw",
    Reports: "none",
  },
  "Fleet Coordinator": {
    Overview: "r",
    Leads: "none",
    Customers: "none",
    Reservations: "rw",
    Contracts: "r",
    Fleet: "rw",
    Maintenance: "rw",
    Payments: "none",
    Automations: "none",
    Inbox: "none",
    Reports: "none",
  },
  "Finance Analyst": {
    Overview: "r",
    Leads: "none",
    Customers: "r",
    Reservations: "none",
    Contracts: "r",
    Fleet: "none",
    Maintenance: "none",
    Payments: "rw",
    Automations: "none",
    Inbox: "none",
    Reports: "r",
  },
};

export function accessFor(role: Role, module: ModuleName): Access {
  return MATRIX[role][module];
}

export function canViewModule(role: Role, module: ModuleName): boolean {
  return MATRIX[role][module] !== "none";
}

export function canWriteModule(role: Role, module: ModuleName): boolean {
  return MATRIX[role][module] === "rw";
}

/** Modules the role may see, in canonical order. */
export function visibleModules(role: Role): ModuleName[] {
  return (Object.keys(MATRIX[role]) as ModuleName[]).filter((m) => canViewModule(role, m));
}

/**
 * Guard for a mutating service.
 *
 * Called by the service itself, not by its caller, so a write cannot reach
 * persistence merely because some future screen forgot to check first. The
 * message deliberately says the action is unavailable for the selected demo
 * role rather than talking about authorisation, because nothing here is
 * authorised in any meaningful sense.
 */
export function requireWrite(session: OperationsSession, module: ModuleName): void {
  if (!canWriteModule(session.role, module)) {
    throw new DemoError(
      "FORBIDDEN",
      `${module} is unavailable for the selected demo role.`,
      module
    );
  }
}

export function requireRead(session: OperationsSession, module: ModuleName): void {
  if (!canViewModule(session.role, module)) {
    throw new DemoError(
      "FORBIDDEN",
      `${module} is unavailable for the selected demo role.`,
      module
    );
  }
}

/**
 * The four modules the mobile bottom bar offers, plus More.
 *
 * The canonical four are Overview, Leads, Reservations and Fleet; where the
 * role cannot see one, the slot is filled from canonical module order so the
 * bar always offers four.
 */
const BOTTOM_NAV_PREFERRED: ModuleName[] = ["Overview", "Leads", "Reservations", "Fleet"];

export function bottomNavModules(role: Role): ModuleName[] {
  const preferred = BOTTOM_NAV_PREFERRED.filter((m) => canViewModule(role, m));
  const filler = visibleModules(role).filter((m) => !preferred.includes(m));
  return [...preferred, ...filler].slice(0, 4);
}
