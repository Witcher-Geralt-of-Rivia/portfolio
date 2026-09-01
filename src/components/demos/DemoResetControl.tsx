"use client";

/**
 * Reset demo data.
 *
 * Lives in the shared demo chrome rather than inside a fictional product's own
 * settings screen. A visitor who has changed things while exploring must
 * always be able to get the canonical dataset back, and hunting for that
 * control inside the simulation is exactly when they would give up instead.
 *
 * The confirmation is a native `<dialog>` opened with `showModal()`, which
 * brings focus containment, Escape-to-close and inertness of the page behind
 * it from the platform. `window.confirm` would block the main thread, cannot
 * be styled to match the project, and reads as a browser error rather than a
 * deliberate choice.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useOptionalDemoRuntimeContext } from "@/demo-runtime/react/DemoRuntimeProvider";

export default function DemoResetControl() {
  const context = useOptionalDemoRuntimeContext();
  const runtime = context?.runtime ?? null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setFailed(false);
  }, []);

  /* `showModal` is imperative, so opening is an effect keyed on intent rather
     than a render-time call. */
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const confirm = async () => {
    if (!runtime) return;
    setBusy(true);
    setFailed(false);
    try {
      await runtime.reset();
      setOpen(false);
    } catch {
      /* Reset is transactional, so a failure means the demo is untouched
         rather than half-cleared. Say so and leave the dialog open. */
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="demo-chrome__action demo-chrome__reset"
        onClick={() => setOpen(true)}
        disabled={!runtime}
      >
        <span className="demo-chrome__reset-long">Reset demo data</span>
        <span className="demo-chrome__reset-short">Reset</span>
      </button>

      <dialog
        ref={dialogRef}
        className="demo-dialog"
        aria-labelledby="demo-reset-title"
        onClose={() => {
          setOpen(false);
          setFailed(false);
        }}
        onCancel={close}
      >
        <h2 id="demo-reset-title" className="demo-dialog__title">
          Reset demo data?
        </h2>
        <p className="demo-dialog__body">
          This restores the original synthetic dataset and removes changes made in
          this browser.
        </p>
        {failed && (
          <p className="demo-dialog__error" role="alert">
            The reset did not complete. Nothing was changed.
          </p>
        )}
        <div className="demo-dialog__actions">
          <button
            type="button"
            className="demo-dialog__button"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="demo-dialog__button demo-dialog__button--primary"
            onClick={confirm}
            disabled={busy || !runtime}
          >
            {busy ? "Resetting…" : "Reset demo"}
          </button>
        </div>
      </dialog>
    </>
  );
}
