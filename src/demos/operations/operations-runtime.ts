/**
 * Operations demo: the composition root.
 *
 * Binds the canonical seed to a shared demo runtime and re-exports the domain
 * surface, so a future screen imports one module rather than reaching into
 * services individually.
 *
 * The dependency direction is one way: this imports the runtime, and the
 * runtime never imports anything under `src/demos/`. The QA harness asserts it.
 */

import { createDemoRuntime, type DemoRuntime } from "@/demo-runtime/runtime";
import type { DemoPersistenceAdapter } from "@/demo-runtime/persistence/adapter";
import type { LatencyMode } from "@/demo-runtime/async-service";

import { DEFAULT_ROLE } from "./constants";
import { buildOperationsSeed } from "./seed";
import type { OperationsSession, Role } from "./types";
import { ACTOR_IDS } from "./seed/entities";
import type { OperationsContext } from "./services/context";

export type CreateOperationsRuntimeOptions = {
  latency?: LatencyMode;
  adapter?: DemoPersistenceAdapter;
  broadcast?: boolean;
};

export function createOperationsRuntime(
  options: CreateOperationsRuntimeOptions = {}
): DemoRuntime {
  return createDemoRuntime({
    seed: buildOperationsSeed(),
    ...(options.latency ? { latency: options.latency } : {}),
    ...(options.adapter ? { adapter: options.adapter } : {}),
    ...(options.broadcast !== undefined ? { broadcast: options.broadcast } : {}),
  });
}

/** The actor that plays each simulated role. */
const ACTOR_FOR_ROLE: Record<Role, string> = {
  Admin: ACTOR_IDS.admin,
  "Sales Agent": ACTOR_IDS.sales,
  "Fleet Coordinator": ACTOR_IDS.fleet,
  "Finance Analyst": ACTOR_IDS.finance,
};

export function sessionFor(role: Role): OperationsSession {
  return { role, actorId: ACTOR_FOR_ROLE[role] };
}

/**
 * A service context for the runtime's currently selected role.
 *
 * The role lives in the shared runtime's session, so switching it in the demo
 * chrome changes what every service will permit: one source of truth rather
 * than a role the UI holds and the domain never sees.
 */
export function contextFor(runtime: DemoRuntime): OperationsContext {
  const role = runtime.session.getState().activeRole as Role;
  return { runtime, session: sessionFor(role) };
}

export function contextAs(runtime: DemoRuntime, role: Role): OperationsContext {
  return { runtime, session: sessionFor(role) };
}

export const DEFAULT_OPERATIONS_ROLE = DEFAULT_ROLE;

/* --- domain surface ------------------------------------------------- */

export * as leads from "./services/leads";
export * as leadWorkflows from "./services/lead-workflows";
export * as workflows from "./services/workflows";
export * as reservationWorkflows from "./services/reservation-workflows";
export * as customers from "./services/customers";
export * as reservations from "./services/reservations";
export * as contracts from "./services/contracts";
export * as payments from "./services/payments";
export * as maintenance from "./services/maintenance";
export * as inbox from "./services/inbox";
export * as notifications from "./services/notifications";
export * as automations from "./services/automations";

export * as derive from "./selectors/derive";
export * as overview from "./selectors/overview";
export * as queries from "./selectors/queries";
export * as leadsList from "./selectors/leads-list";
export * as customersList from "./selectors/customers-list";
export * as customerRelations from "./selectors/customer-relations";
export * as reservationsList from "./selectors/reservations-list";
export * as inboxList from "./selectors/inbox-list";
export * as conversationDetail from "./selectors/conversation-detail";

export * as permissions from "./permissions";
export * from "./constants";
export type * from "./types";
export { ACTOR_IDS };
export type { OperationsContext };
