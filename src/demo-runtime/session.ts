/**
 * Demo runtime: simulated role session.
 *
 * Which role the visitor is currently viewing the product as.
 *
 * This is an interaction simulation and nothing more. There is no
 * authentication, no authorisation and no security boundary: every record
 * stays in browser storage and stays readable whatever role is selected.
 * Switching role changes what the interface offers, which is the thing worth
 * demonstrating: what an operator sees versus what an administrator sees.
 * It must never be described as RBAC or as access control.
 *
 * The role is lightweight view state, so it lives in `localStorage` rather
 * than in the demo database: it is not business data, it should not be part
 * of a mutation's transaction, and losing it costs nothing. It is namespaced
 * per demo so a choice in one product cannot alter another.
 */

import { roleStorageKey } from "./config";
import type { DemoId, SessionState } from "./types";
import { DemoError } from "./types";

/**
 * Storage access that cannot throw.
 *
 * `localStorage` is not merely absent during server rendering: reading it
 * throws outright in a browser configured to block site data, and that throw
 * would take down a demo over a preference the visitor is entitled to have.
 */
function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* A demo that cannot remember the selected role still works; it simply
       starts from the default next time. */
  }
}

function clearStored(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* Nothing to recover: the value was never stored. */
  }
}

export type DemoSession = {
  readonly demoId: DemoId;
  readonly roles: readonly string[];
  getState(): SessionState;
  setRole(role: string): SessionState;
  resetRole(): SessionState;
  subscribe(listener: (state: SessionState) => void): () => void;
};

/** Actor id derived from the role, so audit entries have a stable author. */
export function actorIdFor(demoId: DemoId, role: string): string {
  return `${demoId}:${role}`;
}

export function createSession(
  demoId: DemoId,
  roles: readonly string[],
  initialRole: string
): DemoSession {
  if (roles.length === 0) {
    throw new DemoError("VALIDATION", `Demo "${demoId}" declares no roles.`);
  }
  if (!roles.includes(initialRole)) {
    throw new DemoError(
      "VALIDATION",
      `Demo "${demoId}" sets an initial role "${initialRole}" that is not in its role list.`,
      initialRole
    );
  }

  const key = roleStorageKey(demoId);
  const listeners = new Set<(state: SessionState) => void>();

  /* A stored role that is no longer offered (because the demo's role list
     changed between releases) falls back to the initial role rather than
     leaving the session pointing at something that does not exist. */
  const stored = readStored(key);
  let activeRole = stored && roles.includes(stored) ? stored : initialRole;

  const state = (): SessionState => ({
    activeRole,
    activeActorId: actorIdFor(demoId, activeRole),
  });

  const emit = () => {
    const snapshot = state();
    for (const listener of [...listeners]) listener(snapshot);
  };

  return {
    demoId,
    roles,

    getState: state,

    setRole(role) {
      if (!roles.includes(role)) {
        throw new DemoError(
          "VALIDATION",
          `"${role}" is not a role offered by demo "${demoId}".`,
          role
        );
      }
      if (role !== activeRole) {
        activeRole = role;
        writeStored(key, role);
        emit();
      }
      return state();
    },

    resetRole() {
      if (activeRole !== initialRole) {
        activeRole = initialRole;
        emit();
      }
      clearStored(key);
      return state();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
