/**
 * 05 / CERTIFICATIONS
 *
 * Wired into the homepage, and currently renders nothing.
 *
 * That is not an oversight and it is not a placeholder. No certification has
 * been issued to this portfolio's author, so there is nothing true to put here,
 * and a Certifications section with invented credentials in it would be the
 * most straightforwardly dishonest thing this site could do. The gate is the
 * same shape as the case-study section's, for the same reason: `status` says
 * somebody confirmed the credential exists, `isComplete` says it carries what a
 * public credential must carry, and both have to pass.
 *
 * The section is imported by `page.tsx` anyway, sitting where it will
 * eventually sit, between the Engineering Lab and the featured build. Returning
 * null from a mounted section rather than leaving the component unimported is
 * the difference between a system that activates when data arrives and one that
 * needs to be wired up first, and the brief asked for the former in as many
 * words. Adding one verified record to `src/content/certifications.ts` is the
 * whole activation step.
 *
 * The consequence on the live page today is nothing at all: no heading, no
 * empty frame, no reserved gap. The page reads exactly as it did before this
 * existed, which is the correct appearance for a section with no content.
 *
 * Server component. Only the deck's choreography needs the client, and it says
 * so itself.
 */

import {
  certificationsArePublishable,
  publishableCertifications,
} from "@/content/certifications";
import type { Certification } from "@/content/certifications";

import CertificationDeck from "./CertificationDeck";

export default function CertificationsSection({
  /* The collection is injectable so the specimen can drive the identical
     component with synthetic fixtures. It defaults to production content, and
     the fixtures go through the same gate: a fixture that would not publish in
     production must not publish in the specimen, or the QA is measuring a
     different component from the one that ships. */
  certifications,
}: {
  certifications?: Certification[];
} = {}) {
  const source = certifications;

  if (source ? !certificationsArePublishable(source) : !certificationsArePublishable()) {
    return null;
  }

  const published = source ? publishableCertifications(source) : publishableCertifications();

  const heading = (
    <div className="certs__intro">
      <div className="certs__intro-lead">
        <p className="eyebrow">05 / CERTIFICATIONS</p>
        <h2 id="certs-title" className="certs__title">
          Certifications
        </h2>
      </div>

      <div className="certs__intro-support">
        {/*
          Deliberately descriptive rather than promotional, and deliberately
          about the credentials rather than about their holder. Every clause
          below is checkable against the cards beside it: each one links to its
          issuer's own verification page, which is a property of the data model
          rather than a claim about achievement.
        */}
        <p className="certs__lead">
          Formal credentials, each one linked to the issuer&rsquo;s own
          verification page so it can be checked rather than taken on trust.
        </p>
        <p className="certs__count">
          {String(published.length).padStart(2, "0")}
          <span aria-hidden="true"> / </span>
          {published.length === 1 ? "CREDENTIAL" : "CREDENTIALS"}
        </p>
      </div>
    </div>
  );

  return (
    <section id="certifications" className="certs" aria-labelledby="certs-title">
      <CertificationDeck certifications={published} heading={heading} />
    </section>
  );
}
