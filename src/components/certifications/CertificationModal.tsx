"use client";

/**
 * One credential, in full.
 *
 * Built on the native `<dialog>` with `showModal()`, which is the pattern the
 * Operations demo already uses and for the same reasons: the page behind
 * becomes inert, focus is trapped without a hand-written key handler, Escape
 * arrives as a `cancel` event, and focus returns to whatever opened it. Every
 * one of those is worse when reimplemented in React.
 *
 * This is a separate component from the demo's `OpsOverlay` rather than a reuse
 * of it. That component lives inside Demo 01, carries three geometry variants
 * this needs none of, and importing it would run a landing-page section through
 * the demo tree. The shared thing here is the pattern, not the module.
 *
 * The CSS trap that cost Stage 09A an afternoon applies here too and is
 * restated in `certifications.css`: the project's reset (`* { margin: 0 }`)
 * beats the user agent's `margin: auto` on a modal dialog and pins it to the
 * top-left corner, so the dialog restates its own margins. D-093 is the other
 * half of it: a `<dialog>` is `position: fixed; inset: 0`, so `height: auto`
 * stretches to the containing block and `height: fit-content` is what `auto`
 * was meant to say.
 */

import { useEffect, useRef } from "react";

import { lockPageScroll } from "@/lib/scroll-lock";
import type { Certification } from "@/content/certifications";

import { formatCredentialDate, credentialHost } from "./certification-format";

export default function CertificationModal({
  certification,
  index,
  total,
  onClose,
}: {
  certification: Certification;
  /** 1-based, to match the card's own counter. */
  index: number;
  total: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;

    /* Captured before `showModal()`, which moves focus into the dialog: after
       that call the opener is no longer the active element and there is nothing
       left to remember. */
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    dialog.showModal();
    const release = lockPageScroll();

    return () => {
      release();
      if (dialog.open) dialog.close();

      /* Restoring focus by hand, because the platform's own restore does not
         survive React's unmount ordering.

         `close()` returns focus to whatever opened the dialog, but only while
         the dialog is still in the document. This is a passive effect, so its
         cleanup runs AFTER the commit that removed the element: by the time
         `close()` is reached the dialog is detached and the restore is a no-op.
         Measured, not assumed. Escape left `document.activeElement` on
         `<body>`, which drops a keyboard visitor at the top of the page having
         lost the credential they were reading.

         `isConnected` covers the case where the card that opened this has since
         been unmounted, where focusing it would throw away the position
         entirely for nothing. */
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  const titleId = `cert-modal-title-${certification.id}`;
  const descId = `cert-modal-desc-${certification.id}`;

  return (
    <dialog
      ref={ref}
      className="cert-modal"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(event) => {
        /* Escape. Prevented so React owns the unmount rather than the platform
           closing the element out from under it. */
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        /* The backdrop is the dialog element itself: a click that lands on the
           panel has a different target. No coordinate arithmetic. */
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="cert-modal__panel">
        <header className="cert-modal__head">
          <p className="cert-modal__index">
            <span className="visually-hidden">Certification </span>
            {String(index).padStart(2, "0")}
            <span aria-hidden="true"> / </span>
            <span className="visually-hidden">of </span>
            {String(total).padStart(2, "0")}
          </p>
          <button
            type="button"
            className="cert-modal__close"
            onClick={onClose}
            aria-label="Close certification details"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </header>

        <p className="cert-modal__issuer">{certification.issuer}</p>

        <h2 id={titleId} className="cert-modal__title">
          <a
            className="cert-link"
            href={certification.credentialUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {certification.title}
            <span className="cert-link__mark" aria-hidden="true" />
          </a>
        </h2>

        <p id={descId} className="cert-modal__summary">
          Issued by {certification.issuer} on {formatCredentialDate(certification.issuedAt)}
          {certification.expiresAt
            ? `, valid until ${formatCredentialDate(certification.expiresAt)}`
            : ""}
          . Opens the issuer&rsquo;s verification page at {credentialHost(certification.credentialUrl)}.
        </p>

        {certification.image ? (
          <figure className="cert-modal__figure">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="cert-modal__image"
              src={certification.image}
              alt={`Certificate: ${certification.title}, issued by ${certification.issuer}`}
              loading="lazy"
              decoding="async"
            />
          </figure>
        ) : null}

        {/*
          Where a certificate image would go, the metadata goes instead, framed.

          Not a broken image placeholder, and not a separate panel repeating
          what is already on screen: the first version of this drew a plate
          carrying the title and the issuer directly beneath the heading that
          already said both, which read as a rendering mistake rather than as a
          deliberate substitute. A credential with no picture of itself is still
          a complete credential, so its facts take the space and are presented
          as the artefact.
        */}
        <dl
          className={`cert-modal__meta${certification.image ? "" : " cert-modal__meta--plate"}`}
        >
          <div className="cert-modal__meta-row">
            <dt>Issued</dt>
            <dd>{formatCredentialDate(certification.issuedAt)}</dd>
          </div>
          {certification.expiresAt ? (
            <div className="cert-modal__meta-row">
              <dt>Expires</dt>
              <dd>{formatCredentialDate(certification.expiresAt)}</dd>
            </div>
          ) : null}
          {certification.category ? (
            <div className="cert-modal__meta-row">
              <dt>Category</dt>
              <dd>{certification.category}</dd>
            </div>
          ) : null}
          {certification.credentialId ? (
            <div className="cert-modal__meta-row">
              <dt>Credential ID</dt>
              <dd className="cert-modal__meta-mono">{certification.credentialId}</dd>
            </div>
          ) : null}
        </dl>

        <a
          className="cert-modal__action"
          href={certification.credentialUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Verify with {certification.issuer}
          <span className="cert-modal__action-arrow" aria-hidden="true">
            &rarr;
          </span>
        </a>
      </div>
    </dialog>
  );
}
