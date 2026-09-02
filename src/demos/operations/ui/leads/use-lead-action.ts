"use client";

/**
 * Operations demo: running one lead mutation.
 *
 * `useDemoMutation` from the shared runtime takes a mutation builder and
 * commits it directly. The lead services do their own committing (that is
 * where the permission check and the business rules live), so a screen calling
 * them needs the same three things around a different shape of call: a pending
 * flag that survives the await, a failure translated into words, and a
 * guarantee that a second click cannot start a second commit.
 *
 * Nothing here knows what any action does. It runs what it is handed.
 */

import { useCallback, useRef, useState } from "react";

import { describeFailure, failedField } from "./leads-view";

export type LeadActionState = {
  pending: boolean;
  error: string | null;
  /** The field a validation failure named, for `aria-describedby` wiring. */
  errorField: string | null;
};

export function useLeadAction() {
  const [state, setState] = useState<LeadActionState>({
    pending: false,
    error: null,
    errorField: null,
  });

  /* A ref, not the state: two clicks in the same tick would both read the
     pre-update state and both start a commit. */
  const running = useRef(false);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      if (running.current) return null;
      running.current = true;
      setState({ pending: true, error: null, errorField: null });
      try {
        const value = await action();
        setState({ pending: false, error: null, errorField: null });
        return value;
      } catch (cause) {
        setState({
          pending: false,
          error: describeFailure(cause),
          errorField: failedField(cause),
        });
        return null;
      } finally {
        running.current = false;
      }
    },
    []
  );

  const clearError = useCallback(
    () => setState((s) => ({ ...s, error: null, errorField: null })),
    []
  );

  return { ...state, run, clearError };
}
