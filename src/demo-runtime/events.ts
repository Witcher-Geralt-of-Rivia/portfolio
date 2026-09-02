/**
 * Demo runtime: domain event bus.
 *
 * A synchronous in-browser publish/subscribe, scoped to one demo. It carries
 * facts about what happened in the domain (a job was reassigned, an
 * assessment was submitted) so that panels which care about a change can be
 * told rather than having to poll for it.
 *
 * There is no timer, no queue drain and no network. Publishing calls the
 * listeners and returns; at rest the bus costs nothing, which is what keeps
 * the runtime inside the project's no-idle-work rule.
 */

import type { DemoId, DomainEvent, DomainEventListener } from "./types";

export type EventBus = {
  subscribe(listener: DomainEventListener): () => void;
  /** Subscribe to one event type only. */
  on(type: string, listener: DomainEventListener): () => void;
  publish(event: DomainEvent): void;
  publishAll(events: readonly DomainEvent[]): void;
  /** Listener count, for QA assertions about teardown. */
  size(): number;
};

export function createEventBus(demoId: DemoId): EventBus {
  const listeners = new Set<DomainEventListener>();

  const publish = (event: DomainEvent) => {
    if (event.demoId !== demoId) {
      /* Cross-demo delivery would let one product's UI react to another's
         state. Isolation is a runtime guarantee, so this is dropped rather
         than delivered. */
      return;
    }
    /* Iterate a copy: a listener that unsubscribes itself during delivery is
       ordinary, and mutating the set mid-iteration would skip its neighbour. */
    for (const listener of [...listeners]) listener(event);
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    on(type, listener) {
      const filtered: DomainEventListener = (event) => {
        if (event.type === type) listener(event);
      };
      listeners.add(filtered);
      return () => {
        listeners.delete(filtered);
      };
    },

    publish,

    publishAll(events) {
      for (const event of events) publish(event);
    },

    size() {
      return listeners.size;
    },
  };
}
