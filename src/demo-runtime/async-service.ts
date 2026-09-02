/**
 * Demo runtime: the mock asynchronous service boundary.
 *
 * Product UI calls domain services as though they crossed an application
 * boundary, because that is what shapes real interface work: pending states,
 * disabled controls, ordering, and what the screen does while a request is in
 * flight. A demo whose data returns synchronously never has to answer any of
 * those questions, and the result looks like a prototype.
 *
 * The delay is deterministic. Each operation's latency is derived from its own
 * name, so a given call always takes the same time. Different operations feel
 * different, but nothing varies between runs. `Math.random()` would make every
 * screenshot and every timing assertion irreproducible for no gain.
 *
 * Latency is the only thing this layer changes. It never alters a result, so a
 * harness running with delay switched off exercises exactly the same
 * behaviour it would with delay switched on.
 */

import { LATENCY_MS, LATENCY_SPREAD_MS, type LatencyKind } from "./config";

/**
 * FNV-1a, 32-bit. A small non-cryptographic hash, used only to spread
 * operation names evenly across a latency band.
 */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The latency an operation of this kind and name will always take. */
export function latencyFor(kind: LatencyKind, operation: string): number {
  const spread = LATENCY_SPREAD_MS[kind];
  return LATENCY_MS[kind] + (spread > 0 ? hash(`${kind}:${operation}`) % (spread + 1) : 0);
}

export type LatencyMode = "interactive" | "instant";

export type AsyncService = {
  readonly mode: LatencyMode;
  /** Run `work` behind a deterministic delay for the given operation. */
  call<T>(kind: LatencyKind, operation: string, work: () => Promise<T> | T): Promise<T>;
};

/**
 * `instant` exists for automated tests, which would otherwise spend minutes
 * waiting on delays that prove nothing. It is a presentation switch, not a
 * behaviour switch: the same code path runs either way.
 */
export function createAsyncService(mode: LatencyMode = "interactive"): AsyncService {
  return {
    mode,
    async call<T>(kind: LatencyKind, operation: string, work: () => Promise<T> | T) {
      if (mode === "instant") return await work();

      const ms = latencyFor(kind, operation);
      /* The delay runs before the work, so a caller's pending state is visible
         for the whole of it rather than only for whatever the work itself
         costs. One timer per call, resolved once; nothing is left running. */
      await new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });
      return await work();
    },
  };
}
