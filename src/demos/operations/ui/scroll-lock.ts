/**
 * Operations demo — one page-scroll lock, counted.
 *
 * Several surfaces cover the page on a phone: the notification sheet, the
 * filter sheet, the lead detail, a form, a confirmation. Each of them wants
 * the page behind to stop scrolling, and each used to say so by writing
 * `document.body.style.overflow` directly.
 *
 * That works until two of them overlap. The second to open sets `hidden`, and
 * the first to close sets `""` — restoring scrolling underneath a sheet that
 * is still on screen. Counting the holders instead means the page is unlocked
 * exactly when the last one lets go, and the order they close in stops
 * mattering.
 *
 * The previous inline value is kept and put back, so this cannot invent a
 * scroll state the page did not have before.
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

/** For QA: how many surfaces currently hold the page. */
export function pageScrollHolders(): number {
  return holders;
}
