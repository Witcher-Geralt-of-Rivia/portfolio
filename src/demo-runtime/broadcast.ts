/**
 * Demo runtime — cross-tab invalidation.
 *
 * When a demo changes in one tab, other tabs of the same origin showing the
 * same demo are told to re-read. This is what allows a future Field
 * Operations demo to put a web view and a mobile view in two windows and have
 * a dispatch in one appear in the other.
 *
 * Only an invalidation signal travels: demo id, new revision, and why.
 * Broadcasting the records themselves would mean two copies of the truth in
 * flight, a message size that grows with the dataset, and a receiver that has
 * to merge rather than simply re-read. Re-reading from persistence is both
 * smaller and correct by construction — the database is already the single
 * source of truth, and both tabs share it.
 *
 * Multi-tab sync is an enhancement, never a requirement. Where
 * `BroadcastChannel` is unavailable the demo behaves normally in its own tab.
 */

import { BROADCAST_CHANNEL_NAME } from "./config";
import type { DemoId } from "./types";

export type InvalidationReason = "mutation" | "reset" | "seed";

export type InvalidationMessage = {
  demoId: DemoId;
  revision: number;
  reason: InvalidationReason;
};

export type BroadcastLink = {
  readonly available: boolean;
  post(message: InvalidationMessage): void;
  subscribe(listener: (message: InvalidationMessage) => void): () => void;
  close(): void;
};

function isMessage(value: unknown): value is InvalidationMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.demoId === "string" &&
    typeof m.revision === "number" &&
    (m.reason === "mutation" || m.reason === "reset" || m.reason === "seed")
  );
}

/**
 * A link that does nothing, used when the API is missing or the channel
 * cannot be constructed. Returning a working object rather than null means no
 * caller has to branch on availability.
 */
function inertLink(): BroadcastLink {
  return {
    available: false,
    post() {},
    subscribe() {
      return () => {};
    },
    close() {},
  };
}

export function createBroadcastLink(channelName: string = BROADCAST_CHANNEL_NAME): BroadcastLink {
  if (typeof globalThis === "undefined" || typeof globalThis.BroadcastChannel === "undefined") {
    return inertLink();
  }

  let channel: BroadcastChannel;
  try {
    channel = new globalThis.BroadcastChannel(channelName);
  } catch {
    return inertLink();
  }

  const listeners = new Set<(message: InvalidationMessage) => void>();

  channel.onmessage = (event: MessageEvent) => {
    /* Anything on this channel came from another script on this origin, so it
       is validated before use rather than trusted for its shape. */
    if (!isMessage(event.data)) return;
    for (const listener of [...listeners]) listener(event.data);
  };

  return {
    available: true,

    post(message) {
      try {
        channel.postMessage(message);
      } catch {
        /* A closed channel, or a message that failed to clone. Neither is
           worth failing a mutation that has already been committed. */
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    close() {
      listeners.clear();
      try {
        channel.close();
      } catch {
        /* Already closed. */
      }
    },
  };
}
