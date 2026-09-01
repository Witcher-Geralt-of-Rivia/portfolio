"use client";

/**
 * Demo runtime — React hooks.
 *
 * Four, not thirty. Each one exists because a demo screen genuinely needs it:
 * reach the runtime, read the simulated role, read data that must refresh when
 * the data changes, and perform a change. Anything more specific belongs to a
 * product's own domain layer.
 *
 * Data freshness runs through `useSyncExternalStore` over the runtime's
 * revision. That is the whole subscription model: a mutation increments the
 * revision, subscribers are notified, and queries re-run. Nothing polls
 * IndexedDB, and there is no timer — at rest the runtime does no work at all.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { MutationBuilder } from "../runtime";
import type { ConnectivityState, MutationResult, SessionState } from "../types";
import { DemoError } from "../types";
import { useDemoRuntimeContext } from "./DemoRuntimeProvider";

/** The runtime itself. Throws if the demo is not ready, so callers can assume it. */
export function useDemoRuntime() {
  const { runtime, status, persistenceMode, error, retry } = useDemoRuntimeContext();
  return { runtime, status, persistenceMode, error, retry };
}

/**
 * The demo's revision, as a React-subscribable value.
 *
 * The server snapshot is a constant: nothing is persisted during prerender, so
 * reporting a revision the server cannot know would be a hydration mismatch
 * waiting to happen.
 */
export function useDemoRevision(): number {
  const { runtime } = useDemoRuntimeContext();

  const subscribe = useCallback(
    (onChange: () => void) => (runtime ? runtime.subscribe(onChange) : () => {}),
    [runtime]
  );

  return useSyncExternalStore(
    subscribe,
    () => (runtime ? runtime.revision() : -1),
    () => -1
  );
}

/** The simulated role, and the controls to change it. */
export function useDemoSession() {
  const { runtime } = useDemoRuntimeContext();

  const subscribe = useCallback(
    (onChange: () => void) => (runtime ? runtime.session.subscribe(onChange) : () => {}),
    [runtime]
  );

  /* getSnapshot must return a stable reference between changes, or
     useSyncExternalStore re-renders forever. The session emits only when the
     role actually changes, so the cached object is replaced exactly then. */
  const cache = useRef<{ key: string; value: SessionState } | null>(null);
  const snapshot = useCallback((): SessionState => {
    const state = runtime
      ? runtime.session.getState()
      : { activeRole: "", activeActorId: "" };
    const key = `${state.activeRole}|${state.activeActorId}`;
    if (!cache.current || cache.current.key !== key) cache.current = { key, value: state };
    return cache.current.value;
  }, [runtime]);

  const state = useSyncExternalStore(subscribe, snapshot, snapshot);

  return {
    ...state,
    roles: runtime?.session.roles ?? [],
    setRole: (role: string) => runtime?.session.setRole(role),
    resetRole: () => runtime?.session.resetRole(),
  };
}

/** Simulated connectivity, for demos that show offline behaviour. */
export function useDemoConnectivity() {
  const { runtime } = useDemoRuntimeContext();

  const subscribe = useCallback(
    (onChange: () => void) => (runtime ? runtime.connectivity.subscribe(onChange) : () => {}),
    [runtime]
  );

  const state = useSyncExternalStore<ConnectivityState>(
    subscribe,
    () => runtime?.connectivity.get() ?? "online",
    () => "online"
  );

  return {
    state,
    isOffline: state === "offline",
    setState: (next: ConnectivityState) => runtime?.connectivity.set(next),
    toggle: () => runtime?.connectivity.toggle(),
  };
}

export type QueryState<T> = {
  data: T | null;
  loading: boolean;
  error: DemoError | null;
};

/**
 * Read data through the async boundary, re-running whenever the demo changes.
 *
 * `read` closes over whatever it needs; `deps` declares what would make it a
 * different query. The revision is always part of the trigger, so any
 * committed mutation refreshes every live query — which is what makes a
 * dashboard count agree with the list it counts.
 *
 * `deps` must be primitives (ids, filter strings, page numbers). They are
 * folded into a token that identifies the current query, and `loading` is
 * derived by comparing that token with the settled result's. Deriving it
 * rather than assigning it is deliberate: setting state at the top of the
 * effect would be a synchronous write inside an effect, which cascades a
 * render. Two different objects would stringify alike and quietly never
 * refetch, hence the restriction.
 *
 * **A revalidation keeps the previous data.** Discarding it meant every
 * mutation blanked every live query until the re-read settled, and a caller
 * writing `data ?? []` rendered that blank as fact: marking eight
 * notifications read cleared the badge and emptied the list after the first
 * write, while seven were still unwritten. `loading` still says a read is in
 * flight; a caller that shows a skeleton on `loading` behaves exactly as
 * before.
 *
 * The identity of the query is what decides this, not the trigger. A new
 * revision re-reads the *same* question, so the old answer is stale but still
 * this query's. Changed `deps` ask a *different* question — switching role,
 * page or filter — and the previous answer is then someone else's data, so it
 * is dropped rather than shown for a frame.
 */
export function useDemoQuery<T>(
  read: () => Promise<T>,
  deps: readonly (string | number | boolean | null | undefined)[] = []
): QueryState<T> & { refetch: () => void } {
  const { runtime, status } = useDemoRuntimeContext();
  const revision = useDemoRevision();
  const [nonce, setNonce] = useState(0);

  const identity = `${status}|${deps.map(String).join("~::~")}`;
  const token = `${identity}|${revision}|${nonce}`;
  const [settled, setSettled] = useState<{
    token: string;
    identity: string;
    data: T | null;
    error: DemoError | null;
  } | null>(null);

  /* Settled for this exact trigger: the read is done. */
  const fresh = settled && settled.token === token ? settled : null;
  /* Settled for this question but an older revision: stale, still ours. */
  const stale = settled && settled.identity === identity ? settled : null;
  const shown = fresh ?? stale;

  useEffect(() => {
    if (status !== "ready" || !runtime) return;
    let live = true;

    read()
      .then((data) => {
        if (live) setSettled({ token, identity, data, error: null });
      })
      .catch((cause: unknown) => {
        if (!live) return;
        /* A failed read drops the data it failed to refresh: showing stale
           rows beside an error would state the failure and contradict it. */
        setSettled({
          token,
          identity,
          data: null,
          error:
            cause instanceof DemoError
              ? cause
              : new DemoError("UNAVAILABLE", "The query failed."),
        });
      });

    return () => {
      live = false;
    };
    /* `token` is the whole trigger: it already folds in status, revision,
       nonce and every declared dep. `read` is intentionally excluded — it is
       usually an inline arrow and would re-run this on every render. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, token]);

  return {
    data: shown?.data ?? null,
    loading: fresh === null,
    error: fresh?.error ?? null,
    refetch: () => setNonce((n) => n + 1),
  };
}

export type MutationState = {
  pending: boolean;
  error: DemoError | null;
};

/**
 * Perform a change through the runtime.
 *
 * Returns the pending flag a real interface needs — a disabled button, a
 * spinner on the row being saved — because the mock service boundary makes
 * mutations genuinely asynchronous.
 */
export function useDemoMutation() {
  const { runtime } = useDemoRuntimeContext();
  const [state, setState] = useState<MutationState>({ pending: false, error: null });

  const mutate = useCallback(
    async <T,>(build: MutationBuilder<T>): Promise<MutationResult<T> | null> => {
      if (!runtime) return null;
      setState({ pending: true, error: null });
      try {
        const result = await runtime.commit(build);
        setState({ pending: false, error: null });
        return result;
      } catch (cause) {
        const failure =
          cause instanceof DemoError
            ? cause
            : new DemoError("UNAVAILABLE", "The change could not be saved.");
        setState({ pending: false, error: failure });
        return null;
      }
    },
    [runtime]
  );

  return { mutate, ...state };
}
