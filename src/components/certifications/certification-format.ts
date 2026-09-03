/**
 * How credential data is turned into text, in one place.
 *
 * Small enough to inline and deliberately not inlined: the card and the modal
 * both show the same dates and the same host, and two copies of a date
 * formatter is how a section ends up saying "March 2026" in one place and
 * "2026-03" in another.
 *
 * Pure and free of `Date.now()`, so the same record always renders the same
 * string. The demo suite bans `Date.now` in its own source for this reason and
 * the rule is worth keeping here: a credential's issue date is a fact about the
 * credential, never a fact about when the page was built.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * `2026-03-14` becomes `March 2026`.
 *
 * Month and year only. The day a certificate was issued is noise on a card, and
 * the exact string the issuer uses is one click away on the credential page.
 *
 * Parsed by hand rather than with `new Date(...).toLocaleDateString()`: that
 * would render differently depending on the server's locale and the visitor's,
 * so the same credential would read one way in the HTML and another after
 * hydration. An input that is not a well-formed date is returned untouched
 * rather than turned into "Invalid Date".
 */
export function formatCredentialDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim());
  if (!match) return String(iso ?? "");
  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return String(iso);
  return `${MONTHS[monthIndex]} ${year}`;
}

/**
 * The host a credential link leads to, for telling the visitor where they are
 * about to go before they go there.
 *
 * `www.` is dropped because it is never the useful part of the answer. An
 * unparseable URL yields an empty string, and every caller renders nothing
 * rather than a broken hostname: the completeness gate in
 * `src/content/certifications.ts` means a published credential cannot reach
 * here with an unparseable URL in the first place, so this is the second line
 * of defence rather than the first.
 */
export function credentialHost(url: string): string {
  try {
    return new URL(String(url).trim()).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
