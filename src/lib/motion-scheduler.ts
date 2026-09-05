"use client";

/**
 * One animation frame for the whole page.
 *
 * Six sections now respond to scroll and to the pointer. Six independent
 * `requestAnimationFrame` loops would read `window.scrollY` six times a frame,
 * schedule six frames per scroll event, and keep running for sections that are
 * nowhere near the viewport. This is the one loop they share.
 *
 * The shape is deliberately small:
 *
 *   subscribe(fn)      adds a reader, starts the loop if it was stopped
 *   the loop           reads scroll and pointer ONCE, then calls every reader
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
  /**
   * Smoothed pointer position in viewport coordinates, 0..1.
   *
   * Smoothed rather than raw: the field it drives should feel like a mass of
   * light being pulled along rather than a cursor with a glow stuck to it, and
   * the difference between those two is entirely in the lag.
   */
  pointerX: number;
  pointerY: number;
  /** True while a pointer is actually over the document. */
  pointerActive: boolean;
};

type Reader = (frame: Frame) => void;

const readers = new Set<Reader>();

let raf = 0;
let listening = false;

/* Raw target, written by pointer events. */
let targetX = 0.5;
let targetY = 0.5;
/* Smoothed position, moved toward the target a fraction per frame. */
let currentX = 0.5;
let currentY = 0.5;
let pointerActive = false;
let scrollY = 0;

/**
 * How much of the remaining distance the field closes each frame.
 *
 * At 0.085 the light lags the cursor by roughly a tenth of a second, which is
 * the difference between a fluid mass that gets dragged along and a spotlight
 * welded to the pointer. Lower feels syrupy, higher stops reading as liquid.
 */
const FOLLOW = 0.085;

/** Below this the field is close enough to its target to stop moving. */
const SETTLED = 0.0004;

function onScroll() {
  scrollY = window.scrollY;
  start();
}

function onPointerMove(event: PointerEvent) {
  /* Coarse pointers are ignored entirely: a touch is a tap, not a hover, and a
     colour field that jumps to wherever a finger last landed reads as a bug.
     Phones get the autonomous drift instead. */
  if (event.pointerType === "touch") return;
  targetX = event.clientX / Math.max(1, window.innerWidth);
  targetY = event.clientY / Math.max(1, window.innerHeight);
  pointerActive = true;
  start();
}

function onPointerLeave() {
  /* Not snapped back. The field eases to the middle over the next second or so,
     which is what "settles" means and what stops the page twitching when a
     visitor's cursor crosses out of the window. */
  pointerActive = false;
  targetX = 0.5;
  targetY = 0.5;
  start();
}

function tick() {
  raf = 0;

  const dx = targetX - currentX;
  const dy = targetY - currentY;
  currentX += dx * FOLLOW;
  currentY += dy * FOLLOW;

  const frame: Frame = {
    scrollY,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pointerX: currentX,
    pointerY: currentY,
    pointerActive,
  };

  for (const reader of readers) reader(frame);

  /* Keep going only while the field is still travelling. A page nobody is
     touching stops scheduling frames, which is the whole point of settling
     rather than easing forever. */
  if (readers.size > 0 && (Math.abs(dx) > SETTLED || Math.abs(dy) > SETTLED)) {
    raf = requestAnimationFrame(tick);
  }
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
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("pointerleave", onPointerLeave);
}

function detach() {
  if (!listening) return;
  listening = false;
  window.removeEventListener("scroll", onScroll);
  window.removeEventListener("resize", start);
  window.removeEventListener("pointermove", onPointerMove);
  document.removeEventListener("pointerleave", onPointerLeave);
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

/** For QA and for tests that need a deterministic starting point. */
export function resetPointerForTest(x = 0.5, y = 0.5): void {
  targetX = x;
  targetY = y;
  currentX = x;
  currentY = y;
}
