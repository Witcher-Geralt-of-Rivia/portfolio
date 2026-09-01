"use client";

/**
 * QA FIXTURE — not part of the product, and not a route while it lives here.
 *
 * Publishes the Operations domain and the shared runtime on `window` so
 * `qa/stage09c1-operations.mjs` can exercise the real bundled modules against a
 * real browser IndexedDB.
 *
 * To run the harness:
 *
 *   cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
 *   npm run dev
 *   node qa/stage09c1-operations.mjs
 *   rm -r src/app/demos/qa-operations
 *
 * It lives under `qa/` so that creating the route is a deliberate act: a QA
 * route must never exist in production.
 */

import { useEffect } from "react";

import { createDemoRuntime } from "@/demo-runtime/runtime";
import { createMemoryAdapter } from "@/demo-runtime/persistence/memory";
import { deleteDemoDatabase } from "@/demo-runtime/persistence/indexed-db";
import { DemoError, isDemoError } from "@/demo-runtime/types";
import * as operations from "@/demos/operations/operations-runtime";
import { assertOperationsSeedIntegrity, buildOperationsSeed } from "@/demos/operations/seed";

type OperationsProbeApi = {
  operations: typeof operations;
  /** The shared factory, so isolation tests can seed Field and Learning. */
  createDemoRuntime: typeof createDemoRuntime;
  buildOperationsSeed: typeof buildOperationsSeed;
  assertOperationsSeedIntegrity: typeof assertOperationsSeedIntegrity;
  createMemoryAdapter: typeof createMemoryAdapter;
  deleteDemoDatabase: typeof deleteDemoDatabase;
  DemoError: typeof DemoError;
  isDemoError: typeof isDemoError;
};

declare global {
  interface Window {
    __opsProbe?: OperationsProbeApi;
  }
}

export default function OperationsProbePage() {
  useEffect(() => {
    window.__opsProbe = {
      operations,
      createDemoRuntime,
      buildOperationsSeed,
      assertOperationsSeedIntegrity,
      createMemoryAdapter,
      deleteDemoDatabase,
      DemoError,
      isDemoError,
    };
    return () => {
      delete window.__opsProbe;
    };
  }, []);

  return (
    <p id="ops-probe" style={{ fontFamily: "monospace", padding: 24 }}>
      operations domain probe
    </p>
  );
}
