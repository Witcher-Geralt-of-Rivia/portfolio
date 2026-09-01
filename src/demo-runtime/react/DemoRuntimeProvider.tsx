"use client";

/**
 * Demo runtime — React provider.
 *
 * Owns one demo's runtime for the lifetime of a demo route: creates it,
 * initializes it, exposes it through context, and disposes of it on unmount.
 *
 * It deliberately holds no product state. A single context carrying every
 * demo's screens would make each product's concerns everyone else's problem
 * and would re-render the whole application on any change. What lives here is
 * the runtime handle and its lifecycle; what a screen is showing lives in that
 * screen.
 *
 * Everything browser-specific happens inside the effect. The module is
 * imported by a server-rendered layout and is evaluated during prerender, so
 * touching `indexedDB`, `localStorage` or `BroadcastChannel` at module scope
 * or in the render body would run it on the server.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { createDemoRuntime, type DemoRuntime } from "../runtime";
import type { DemoError, DemoSeed, PersistenceMode, RuntimeStatus } from "../types";

export type DemoRuntimeContextValue = {
  runtime: DemoRuntime | null;
  status: RuntimeStatus;
  persistenceMode: PersistenceMode | null;
  error: DemoError | null;
  /** Re-attempt initialization after a failure, without a page reload. */
  retry(): void;
};

const DemoRuntimeContext = createContext<DemoRuntimeContextValue | null>(null);

export type DemoRuntimeProviderProps = {
  seed: DemoSeed;
  children: React.ReactNode;
};

/**
 * The outcome of one initialization attempt, tagged with the attempt it
 * belongs to.
 *
 * Tagging is what lets `status` be derived rather than assigned. Setting
 * "initializing" at the top of the effect would be a synchronous state write
 * inside an effect — a cascading render, and the thing React's rules
 * explicitly warn against. Instead, an attempt with no matching outcome yet
 * simply *is* initializing.
 */
type Attempt = {
  key: number;
  runtime: DemoRuntime | null;
  status: Extract<RuntimeStatus, "ready" | "error">;
  error: DemoError | null;
};

export default function DemoRuntimeProvider({ seed, children }: DemoRuntimeProviderProps) {
  const [key, setKey] = useState(0);
  const [outcome, setOutcome] = useState<Attempt | null>(null);

  const settled = outcome && outcome.key === key ? outcome : null;
  const status: RuntimeStatus = settled ? settled.status : "initializing";
  const runtime = settled?.runtime ?? null;
  const error = settled?.error ?? null;

  useEffect(() => {
    /* A run that has been superseded — by a seed change, a retry or an
       unmount — must not write into state belonging to the current one. */
    let live = true;
    const instance = createDemoRuntime({ seed });

    instance
      .initialize()
      .then(() => {
        if (!live) {
          instance.dispose();
          return;
        }
        setOutcome({ key, runtime: instance, status: "ready", error: null });
      })
      .catch((cause: unknown) => {
        if (!live) {
          instance.dispose();
          return;
        }
        setOutcome({ key, runtime: null, status: "error", error: cause as DemoError });
      });

    return () => {
      live = false;
      instance.dispose();
    };
  }, [seed, key]);

  const value = useMemo<DemoRuntimeContextValue>(
    () => ({
      runtime,
      status,
      persistenceMode: runtime ? runtime.persistenceMode() : null,
      error,
      retry: () => setKey((n) => n + 1),
    }),
    [runtime, status, error]
  );

  return <DemoRuntimeContext.Provider value={value}>{children}</DemoRuntimeContext.Provider>;
}

/** The runtime context. Throws outside a provider rather than returning null. */
export function useDemoRuntimeContext(): DemoRuntimeContextValue {
  const value = useContext(DemoRuntimeContext);
  if (!value) {
    throw new Error("useDemoRuntime must be used inside a DemoRuntimeProvider.");
  }
  return value;
}

/**
 * The context if there is one, otherwise null.
 *
 * The shared demo chrome uses this rather than the throwing accessor. The bar
 * is real, finished furniture that has to render before any demo exists to
 * put inside it, and a shell that crashed without a provider could not be
 * measured or reviewed until the first product was built.
 */
export function useOptionalDemoRuntimeContext(): DemoRuntimeContextValue | null {
  return useContext(DemoRuntimeContext);
}
