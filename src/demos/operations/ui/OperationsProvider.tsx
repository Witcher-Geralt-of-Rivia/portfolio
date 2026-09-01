"use client";

/**
 * Operations demo — the product's own context.
 *
 * A thin layer over the shared `DemoRuntimeProvider`: it resolves the current
 * simulated role into an `OperationsContext` and exposes the actor behind it.
 *
 * Deliberately holds no records. Screens read what they need through
 * `useDemoQuery`, which re-runs on the runtime's revision, so there is one
 * source of truth and no second copy of the data to keep in step.
 */

import { createContext, useContext, useMemo } from "react";

import DemoRuntimeProvider, {
  useOptionalDemoRuntimeContext,
} from "@/demo-runtime/react/DemoRuntimeProvider";
import { useDemoSession } from "@/demo-runtime/react/hooks";

import { ACTOR_IDS } from "../seed/entities";
import { buildOperationsSeed } from "../seed";
import { ROLES, type Role } from "../types";
import type { OperationsContext } from "../services/context";

/** Which synthetic actor plays each role, and what to show for them. */
export const ACTOR_BY_ROLE: Record<Role, { id: string; name: string }> = {
  Admin: { id: ACTOR_IDS.admin, name: "Morgan Reed" },
  "Sales Agent": { id: ACTOR_IDS.sales, name: "Avery Chen" },
  "Fleet Coordinator": { id: ACTOR_IDS.fleet, name: "Jordan Blake" },
  "Finance Analyst": { id: ACTOR_IDS.finance, name: "Taylor Quinn" },
};

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export type OperationsValue = {
  /** Null until the runtime is ready. */
  ctx: OperationsContext | null;
  role: Role;
  actorId: string;
  actorName: string;
  initials: string;
};

const Ctx = createContext<OperationsValue | null>(null);

function Bridge({ children }: { children: React.ReactNode }) {
  const runtimeCtx = useOptionalDemoRuntimeContext();
  const session = useDemoSession();

  const value = useMemo<OperationsValue>(() => {
    const role = (ROLES as readonly string[]).includes(session.activeRole)
      ? (session.activeRole as Role)
      : "Admin";
    const actor = ACTOR_BY_ROLE[role];
    const runtime = runtimeCtx?.runtime ?? null;
    return {
      ctx: runtime ? { runtime, session: { role, actorId: actor.id } } : null,
      role,
      actorId: actor.id,
      actorName: actor.name,
      initials: initialsOf(actor.name),
    };
  }, [runtimeCtx?.runtime, session.activeRole]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * The seed is built once per module load, not per render.
 *
 * `DemoRuntimeProvider` keys its initialization effect on the seed object, so a
 * fresh object each render would tear the runtime down and rebuild it forever.
 */
const OPERATIONS_SEED = buildOperationsSeed();

export default function OperationsProvider({ children }: { children: React.ReactNode }) {
  return (
    <DemoRuntimeProvider seed={OPERATIONS_SEED}>
      <Bridge>{children}</Bridge>
    </DemoRuntimeProvider>
  );
}

export function useOperations(): OperationsValue {
  const value = useContext(Ctx);
  if (!value) {
    throw new Error("useOperations must be used inside an OperationsProvider.");
  }
  return value;
}
