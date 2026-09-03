/**
 * Certifications: the canonical source, and it is empty.
 *
 * No certification has been issued to this portfolio's author. That is the
 * whole reason this file reads the way it does.
 *
 * The section that renders these is built, tested and wired into the homepage.
 * It renders nothing, because there is nothing true to render. When a real
 * credential arrives, adding it here is the entire activation step: no
 * component work, no wiring, no stylesheet to import. That was the design
 * brief's actual requirement, and an empty array is what makes it testable
 * today rather than promised for later.
 *
 * The same two-gate shape as `src/content/case-studies.ts`, for the same
 * reason. Status alone is a checkbox somebody ticks; completeness alone would
 * publish a credential that happens to have all its fields filled in while it
 * is still being drafted. Both have to pass:
 *
 *   status === "verified"   somebody confirmed the credential exists
 *   isComplete(c)           it carries what a public credential must carry
 *
 * What must never happen here, stated plainly because the temptation is real
 * and the file is empty:
 *
 *   no example credentials, not even commented out
 *   no issuer names as placeholders (AWS, Google, Microsoft, Coursera)
 *   no invented credential ids or verification URLs
 *   no "coming soon" entry, which is a claim about the future dressed as data
 *
 * Synthetic certifications exist for QA and live in `qa/fixtures/`, outside the
 * route tree, following the fixture convention `docs/DEMO_PLATFORM.md` sets
 * out. They are never imported from here and never reach the public page.
 */

export type CertificationStatus = "draft" | "verified";

export type Certification = {
  id: string;
  /**
   * `"draft"` until somebody has the credential in hand and has opened its
   * verification URL. Nothing but `"verified"` reaches a page.
   */
  status: CertificationStatus;
  /** The credential's own name, as the issuer writes it. Never paraphrased. */
  title: string;
  issuer: string;
  /** ISO 8601 date, `YYYY-MM-DD`. The day the issuer states, not the day it was added here. */
  issuedAt: string;
  /** Present only when the credential actually expires. Absent is not "never checked". */
  expiresAt?: string;
  /** The issuer's own identifier, when they publish one. */
  credentialId?: string;
  /**
   * The issuer's verification page. Required, and required to be https.
   *
   * A certification a visitor cannot verify is an assertion, and this portfolio
   * does not publish assertions about its own credentials. `isComplete` refuses
   * anything that is not a parseable https URL, which also means no
   * `javascript:` or `data:` URL can ever reach an href.
   */
  credentialUrl: string;
  /** An image of the certificate itself, when one exists. The modal reads without it. */
  image?: string;
  /** Optional grouping label, e.g. the discipline the credential sits in. */
  category?: string;
  /**
   * Repository-only note on how the credential was confirmed. Never rendered.
   * The repository is public, so this holds no private URL and no account
   * identifier: it is a note to a future maintainer, not a private channel.
   */
  verificationSource?: string;
};

/**
 * Empty, and not a placeholder for something that exists elsewhere.
 *
 * Do not populate this from the Stage 06-08 demonstration data or from the
 * Operations demo's synthetic records. Those are simulations that say so in
 * their own source, and `docs/CASE_STUDY_SOURCE_AUDIT.md` records that none of
 * them may be promoted into a public claim.
 */
export const CERTIFICATIONS: Certification[] = [];

/** Only https survives. Anything else is not a credential link, whatever it claims. */
export function isSafeCredentialUrl(url: string): boolean {
  if (typeof url !== "string" || url.trim().length === 0) return false;
  try {
    return new URL(url.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

/** `YYYY-MM-DD`, and a date the calendar actually has. */
export function isIsoDate(value: string): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * The minimum a public credential must carry.
 *
 * Optional fields are genuinely optional and are not required here, but an
 * optional field that is PRESENT has to be valid: a malformed expiry date is a
 * worse failure than an absent one, because it renders.
 */
export function isComplete(c: Certification): boolean {
  if (c.id.trim().length === 0) return false;
  if (c.title.trim().length === 0) return false;
  if (c.issuer.trim().length === 0) return false;
  if (!isIsoDate(c.issuedAt)) return false;
  if (!isSafeCredentialUrl(c.credentialUrl)) return false;
  if (c.expiresAt !== undefined && !isIsoDate(c.expiresAt)) return false;
  if (c.credentialId !== undefined && c.credentialId.trim().length === 0) return false;
  if (c.category !== undefined && c.category.trim().length === 0) return false;
  if (c.image !== undefined && c.image.trim().length === 0) return false;
  return true;
}

/**
 * The only accessor a renderer may use.
 *
 * Takes its collection as an argument so the specimen can pass fixtures through
 * the identical gate. A fixture that would not publish in production must not
 * publish in the specimen either, or the QA is measuring a different component
 * from the one that ships.
 */
export function publishableCertifications(
  all: Certification[] = CERTIFICATIONS
): Certification[] {
  return all.filter((c) => c.status === "verified" && isComplete(c));
}

/**
 * Whether the section renders at all.
 *
 * One is enough, deliberately. The case-study section requires three because a
 * section called Selected Work implies a body of work; a section called
 * Certifications with one certification in it is simply true.
 */
export const MINIMUM_PUBLIC_CERTIFICATIONS = 1;

export function certificationsArePublishable(
  all: Certification[] = CERTIFICATIONS
): boolean {
  return publishableCertifications(all).length >= MINIMUM_PUBLIC_CERTIFICATIONS;
}
