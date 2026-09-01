"use client";

/**
 * QA FIXTURE — not part of the product, and not a route while it lives here.
 *
 * Publishes the demo runtime's factories on `window` so `qa/stage09a-runtime.mjs`
 * can exercise the real bundled modules against a real browser IndexedDB. The
 * runtime cannot be tested in Node: it is compiled by the bundler and its whole
 * purpose is browser persistence.
 *
 * To run the harness:
 *
 *   cp qa/fixtures/demos-qa-probe.page.tsx src/app/demos/qa-probe/page.tsx
 *   npm run dev
 *   node qa/stage09a-runtime.mjs
 *   rm -r src/app/demos/qa-probe
 *
 * It lives under `qa/` rather than `src/app/` precisely so that copying it is a
 * deliberate act: a QA route must never exist in production. Note that naming
 * the folder `_probe` would not work — a leading underscore marks a Next.js
 * private folder, which produces no route at all.
 */

import { useEffect } from "react";

import { createJobHandlers } from "@/demo-runtime/jobs";
import {
  createIndexedDbAdapter,
  deleteDemoDatabase,
  indexedDbAvailable,
} from "@/demo-runtime/persistence/indexed-db";
import { createMemoryAdapter } from "@/demo-runtime/persistence/memory";
import { runQuery } from "@/demo-runtime/repository";
import { createDemoRuntime } from "@/demo-runtime/runtime";
import { DemoError, isDemoError } from "@/demo-runtime/types";

type ProbeApi = {
  createDemoRuntime: typeof createDemoRuntime;
  createMemoryAdapter: typeof createMemoryAdapter;
  createIndexedDbAdapter: typeof createIndexedDbAdapter;
  deleteDemoDatabase: typeof deleteDemoDatabase;
  indexedDbAvailable: typeof indexedDbAvailable;
  createJobHandlers: typeof createJobHandlers;
  runQuery: typeof runQuery;
  DemoError: typeof DemoError;
  isDemoError: typeof isDemoError;
};

declare global {
  interface Window {
    __demoProbe?: ProbeApi;
  }
}

export default function DemoProbePage() {
  /* Publishing to `window` is the whole job, and it is exactly the kind of
     external-system synchronisation an effect is for. No state is set here:
     the harness waits on `window.__demoProbe`, not on rendered text, so a
     "ready" flag would only add a cascading render. */
  useEffect(() => {
    window.__demoProbe = {
      createDemoRuntime,
      createMemoryAdapter,
      createIndexedDbAdapter,
      deleteDemoDatabase,
      indexedDbAvailable,
      createJobHandlers,
      runQuery,
      DemoError,
      isDemoError,
    };
    return () => {
      delete window.__demoProbe;
    };
  }, []);

  return (
    <p id="probe-status" style={{ fontFamily: "monospace", padding: 24 }}>
      demo runtime probe
    </p>
  );
}
