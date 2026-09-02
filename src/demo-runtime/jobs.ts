/**
 * Demo runtime: client-side job queue.
 *
 * Persistent deferred work: an automation run, a queued mutation waiting for
 * simulated reconnection, a notification to be delivered. Jobs are records
 * like any other, so they survive a reload and are cleared by reset.
 *
 * There is no worker and no timer. A job moves only when a workflow calls
 * `processPending`, which is a deliberate choice on two counts: the project
 * forbids anything running on a timer at rest, and explicit processing is what
 * makes a queue demonstrable. A visitor can press a control and watch the
 * backlog drain one step at a time instead of guessing when a hidden loop
 * decided to run.
 *
 * A future UI may honestly call these background jobs or a sync queue, because
 * that is the concept being modelled. It must not imply a server is doing the
 * work.
 */

import type { Job, JobStatus } from "./types";
import { DemoError } from "./types";

/** What a handler reports back about one attempt. */
export type JobOutcome =
  | { status: "complete" }
  | { status: "failed"; error: string }
  | { status: "retry"; error: string };

export type JobHandler = (job: Job) => Promise<JobOutcome> | JobOutcome;

/**
 * The result of draining the queue once.
 *
 * Returned rather than logged so a workflow can decide what the UI should say,
 * and so the QA harness can assert on it.
 */
export type ProcessReport = {
  processed: number;
  completed: string[];
  failed: string[];
  retried: string[];
  /** Jobs with no registered handler, left pending and untouched. */
  skipped: string[];
};

export function nextJobStatus(job: Job, outcome: JobOutcome): JobStatus {
  if (outcome.status === "complete") return "complete";
  if (outcome.status === "failed") return "failed";
  /* A retry that has exhausted its attempts is a failure, not an endless
     pending row: a queue that never gives up is indistinguishable from one
     that is stuck, and the demo would be showing a lie. */
  return job.attempts + 1 >= job.maxAttempts ? "failed" : "pending";
}

export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * A registry of handlers, one per job type.
 *
 * Kept separate from the queue's persistence so the runtime can own the
 * storage while each demo owns the meaning of its own job types.
 */
export function createJobHandlers() {
  const handlers = new Map<string, JobHandler>();
  return {
    register(type: string, handler: JobHandler) {
      if (handlers.has(type)) {
        throw new DemoError("CONFLICT", `A handler for job type "${type}" is already registered.`);
      }
      handlers.set(type, handler);
      return () => {
        handlers.delete(type);
      };
    },
    get(type: string): JobHandler | undefined {
      return handlers.get(type);
    },
    has(type: string): boolean {
      return handlers.has(type);
    },
    size(): number {
      return handlers.size;
    },
  };
}

export type JobHandlerRegistry = ReturnType<typeof createJobHandlers>;

/** Jobs a caller may still act on. */
export function isTerminal(status: JobStatus): boolean {
  return status === "complete" || status === "failed";
}
