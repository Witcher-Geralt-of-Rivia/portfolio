"use client";

/**
 * One credential, as a card.
 *
 * The interesting problem here is not visual. The brief asks for three things
 * that pull against each other:
 *
 *   clicking the card body opens the detail modal
 *   clicking the certification title goes to the issuer's verification page
 *   the markup stays valid and the whole thing works from a keyboard
 *
 * The obvious implementation is a `<button>` wrapping the card with an `<a>`
 * inside it. That is invalid HTML: interactive content may not nest, and every
 * browser resolves it differently. The second obvious implementation is a
 * `<div onClick>` with `tabIndex={0}` and a key handler, which is valid but is
 * a button reimplemented badly, and it makes the whole card one enormous
 * unlabelled tab stop that a screen reader announces as a wall of text.
 *
 * So the card is an `<article>`, and it is not focusable. Two real controls sit
 * inside it: the title anchor, and an explicit "View details" button that opens
 * the modal. The card's own click handler is a convenience for a mouse, and it
 * defers to whichever control was actually clicked:
 *
 *   event.target.closest("a, button")
 *
 * A DOM ancestry test, not a pointer-coordinate test. It stays correct when the
 * layout changes, when a control moves, and when the click arrives from a
 * keyboard's Enter on a nested control, which reports the control as its
 * target. Nothing here depends on where the card happens to be on screen.
 *
 * The result is that a keyboard user gets exactly two tab stops per card, both
 * labelled and both doing something a mouse user can also do, and a mouse user
 * still gets the whole card as a target.
 */

import type { Certification } from "@/content/certifications";

import { formatCredentialDate, credentialHost } from "./certification-format";

export default function CertificationCard({
  certification,
  index,
  total,
  onOpen,
}: {
  certification: Certification;
  /** 1-based, matching the visible counter. */
  index: number;
  total: number;
  onOpen: () => void;
}) {
  const host = credentialHost(certification.credentialUrl);

  return (
    <article
      className="cert-card__inner"
      onClick={(event) => {
        /* A real control inside the card handled this. Let it. */
        if ((event.target as HTMLElement).closest("a, button")) return;
        onOpen();
      }}
    >
      <header className="cert-card__head">
        <p className="cert-card__index">
          CERT
          <span aria-hidden="true"> / </span>
          {String(index).padStart(2, "0")}
        </p>
        {certification.category ? (
          <p className="cert-card__category">{certification.category}</p>
        ) : null}
      </header>

      <p className="cert-card__issuer">{certification.issuer}</p>

      <h3 className="cert-card__title">
        <a
          className="cert-link"
          href={certification.credentialUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {certification.title}
          <span className="cert-link__mark" aria-hidden="true" />
        </a>
      </h3>

      <dl className="cert-card__meta">
        <div className="cert-card__meta-row">
          <dt>Issued</dt>
          <dd>{formatCredentialDate(certification.issuedAt)}</dd>
        </div>
        {certification.expiresAt ? (
          <div className="cert-card__meta-row">
            <dt>Expires</dt>
            <dd>{formatCredentialDate(certification.expiresAt)}</dd>
          </div>
        ) : null}
        {certification.credentialId ? (
          <div className="cert-card__meta-row">
            <dt>ID</dt>
            <dd className="cert-card__meta-mono">{certification.credentialId}</dd>
          </div>
        ) : null}
      </dl>

      <footer className="cert-card__foot">
        <button type="button" className="cert-card__open" onClick={onOpen}>
          View details
          <span className="visually-hidden">
            {" "}
            for {certification.title}, issued by {certification.issuer}
          </span>
        </button>
        {host ? <p className="cert-card__host">{host}</p> : null}
        <p className="cert-card__count" aria-hidden="true">
          {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </p>
      </footer>
    </article>
  );
}
