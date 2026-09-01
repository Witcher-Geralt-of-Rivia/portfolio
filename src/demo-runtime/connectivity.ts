/**
 * Demo runtime — simulated connectivity.
 *
 * A visitor-controlled online/offline flag, so a demo can show what an
 * application does when the network disappears and what it does when the
 * network comes back.
 *
 * It deliberately does not read `navigator.onLine`. Real connectivity is not
 * reproducible, is usually true on a desk, and would make the offline path
 * impossible to demonstrate on purpose. This is a switch the visitor throws.
 *
 * The state is session-scoped and not persisted: a reload returns to online,
 * which is the honest default — nothing about the browser is actually
 * offline, and a demo that remembered a simulated outage across reloads would
 * look broken rather than instructive.
 */

import type { ConnectivityState } from "./types";

export type Connectivity = {
  get(): ConnectivityState;
  set(state: ConnectivityState): void;
  toggle(): ConnectivityState;
  isOffline(): boolean;
  subscribe(listener: (state: ConnectivityState) => void): () => void;
};

export function createConnectivity(initial: ConnectivityState = "online"): Connectivity {
  let state: ConnectivityState = initial;
  const listeners = new Set<(state: ConnectivityState) => void>();

  const emit = () => {
    for (const listener of [...listeners]) listener(state);
  };

  return {
    get: () => state,

    set(next) {
      if (next === state) return;
      state = next;
      emit();
    },

    toggle() {
      state = state === "online" ? "offline" : "online";
      emit();
      return state;
    },

    isOffline: () => state === "offline",

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
