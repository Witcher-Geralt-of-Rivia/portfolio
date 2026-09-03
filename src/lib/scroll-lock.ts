/**
 * The site's page-scroll lock, counted.
 *
 * A native `<dialog>` opened with `showModal()` makes the page behind inert,
 * but it does not reliably stop it scrolling. That matters more here than it
 * usually would: the certifications section is a sticky scroll choreography, so
 * a wheel gesture over an open modal would advance the deck behind it and the
 * visitor would close the dialog onto a different composition than the one they
 * left.
 *
 * Counted rather than a boolean, for the reason the demo's lock is: two
 * surfaces open at once, the second sets `hidden`, the first to close sets
 * `""`, and the page scrolls underneath something that is still on screen.
 * Counting means the page unlocks when the last holder lets go and the closing
 * order stops mattering. The previous inline value is kept and put back, so
 * this cannot invent a scroll state the page did not have.
 *
 * DELIBERATELY SEPARATE from `src/demos/operations/ui/scroll-lock.ts`, which is
 * the same algorithm. Demo 01 is frozen, and promoting that module to a shared
 * one would have meant editing a file inside it for a landing-page feature.
 *
 * The duplication is safe because the two never share a document: this one
 * serves the landing page, that one serves `/demos/operations/*`. It would stop
 * being safe if a site-level surface and a demo surface were ever open at the
 * same time, because each counter would capture the other's `hidden` as the
 * value to restore and the page would stay locked. If the two trees ever meet,
 * consolidate them rather than adding a third.
 */

let holders = 0;
let previousOverflow: string | null = null;

export function lockPageScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (holders === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  holders += 1;

  let released = false;
  return () => {
    /* Effect cleanup can run more than once for the same lock; releasing twice
       would unlock the page while another surface still holds it. */
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0) {
      document.body.style.overflow = previousOverflow ?? "";
      previousOverflow = null;
    }
  };
}

/** For QA: how many site surfaces currently hold the page. */
export function pageScrollHolders(): number {
  return holders;
}
