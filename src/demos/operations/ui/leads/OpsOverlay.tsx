"use client";

/**
 * Operations demo: one overlay, three presentations.
 *
 * The detail drawer, the filter sheet, the forms and the confirmations are the
 * same thing wearing different geometry, so they are one component. Five
 * hand-rolled overlays would be five places to get focus wrong.
 *
 * Built on the native `<dialog>` with `showModal()`, which is what makes the
 * modality real: the page behind becomes inert, focus is trapped without a
 * hand-written key handler, Escape is delivered as a `cancel` event, and focus
 * returns to whatever opened it when it closes. Reimplementing any of that in
 * React would be worse in every case, and this codebase already uses `<dialog>`
 * for the reset confirmation.
 *
 * Two things the platform does not do:
 *
 * - A modal dialog does not reliably stop the page behind from scrolling, so
 *   the counted lock is still taken.
 * - The project's reset (`* { margin: 0 }`) beats the user-agent's
 *   `margin: auto` on a modal dialog and pins it to the top-left corner. Each
 *   variant restates its own margins in CSS; this is the trap that cost Stage
 *   09A an afternoon, recorded here so it is not rediscovered.
 */

import { useEffect, useRef } from "react";

import { lockPageScroll } from "../scroll-lock";

export type OverlayVariant = "drawer" | "sheet" | "dialog";

export default function OpsOverlay({
  variant,
  label,
  onClose,
  busy = false,
  className = "",
  children,
}: {
  variant: OverlayVariant;
  /** Names the dialog for assistive technology. */
  label: string;
  onClose: () => void;
  /** While true, Escape and backdrop dismissal are refused. */
  busy?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    const release = lockPageScroll();
    return () => {
      release();
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`ops-overlay ops-overlay--${variant} ${className}`.trim()}
      aria-label={label}
      onCancel={(e) => {
        /* Escape during a save would leave the visitor unsure whether the
           change landed. The dialog stays until the mutation settles. */
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        /* A click that lands on the dialog element itself is a click on the
           backdrop: the panel inside stops its own clicks. */
        if (e.target === ref.current && !busy) onClose();
      }}
    >
      <div className="ops-overlay__panel">{children}</div>
    </dialog>
  );
}
