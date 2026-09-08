"use client";

/**
 * One animation frame for the whole page.
 *
 * Several sections respond to scroll. Independent
 * `requestAnimationFrame` loops would read `window.scrollY` once each a frame,
 * schedule six frames per scroll event, and keep running for sections that are
 * nowhere near the viewport. This is the one loop they share.
 *
 * The shape is deliberately small:
 *
 *   subscribe(fn)      adds a reader, starts the loop if it was stopped
 *   the loop           reads scroll ONCE, then calls every reader
 *   the last unsubscribe stops the loop
 *
 * A reader receives the frame's already-read values and must not read layout.
 * That rule is what keeps the scroll path free of forced reflow, and it is the
 * reason the loop reads first and dispatches second rather than letting each
 * subscriber help itself.
 *
 * The loop does not run when nothing is subscribed, and subscribers are
 * expected to unsubscribe when their section is far from the viewport. So an
 * idle page at the top of the document is running no animation frames at all,
 * which is the invariant `docs/DESIGN_SYSTEM.md` has always cared about.
 */

export type Frame = {
  /** Document scroll offset, read once per frame. */
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
};

type Reader = (frame: Frame) => void;

const readers = new Set<Reader>();

let raf = 0;
let listening = false;

let scrollY = 0;

function onScroll() {
  scrollY = window.scrollY;
  start();
}

function tick() {
  raf = 0;

  const frame: Frame = {
    scrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  };

  for (const reader of readers) reader(frame);
}

function start() {
  if (raf !== 0 || readers.size === 0) return;
  raf = requestAnimationFrame(tick);
}

function attach() {
  if (listening) return;
  listening = true;
  scrollY = window.scrollY;
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", start);
}

function detach() {
  if (!listening) return;
  listening = false;
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", start);
  if (raf !== 0) {
    cancelAnimationFrame(raf);
    raf = 0;
  }
}

/**
 * Add a reader. Returns its own unsubscribe.
 *
 * The first subscription attaches the listeners; the last unsubscription
 * removes them and cancels any pending frame, so a page with every section
 * scrolled away is doing nothing at all.
 */
export function subscribe(reader: Reader): () => void {
  readers.add(reader);
  attach();
  start();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    readers.delete(reader);
    if (readers.size === 0) detach();
  };
}

/** For QA: how many sections are currently asking for frames. */
export function readerCount(): number {
  return readers.size;
}

