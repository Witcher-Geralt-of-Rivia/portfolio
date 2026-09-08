"use client";

/**
 * GSAP and ScrollTrigger, registered once and only in a browser.
 *
 * WHY THIS FILE EXISTS RATHER THAN AN IMPORT IN EACH COMPONENT
 *
 * `ScrollTrigger` touches `window` and `document` at module scope. Importing it
 * from a component that Next renders on the server throws during prerender, and
 * calling `gsap.registerPlugin` more than once is wasteful at best. So every
 * pinned section asks for the pair through `getScrollStory()`, which registers
 * on first use, in the browser, and hands back the same objects afterwards.
 *
 * WHAT A CALLER IS RESPONSIBLE FOR
 *
 * Cleanup. Every timeline and every trigger created inside a component must die
 * with it, or a route change leaves pins attached to elements that no longer
 * exist and the page ends up scrolled into a range that nothing owns. The
 * pattern used throughout is `gsap.context(...)` scoped to the component's root
 * plus `ctx.revert()` in the effect's teardown, which kills the timelines, the
 * triggers they created, and any inline styles GSAP wrote.
 *
 * STRICT MODE
 *
 * React runs effects twice in development. `gsap.context` makes that safe: the
 * first context is reverted before the second is created, so the second run
 * starts from the original markup rather than from a half-animated copy.
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

export type ScrollStory = {
  gsap: typeof gsap;
  ScrollTrigger: typeof ScrollTrigger;
};

/**
 * The pair, registered. Returns null on the server, which is the signal for a
 * component to render its plain layout and do nothing else.
 */
export function getScrollStory(): ScrollStory | null {
  if (typeof window === "undefined") return null;
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
  return { gsap, ScrollTrigger };
}

/**
 * Watch the conditions under which a pinned story may run, and report changes.
 *
 * The width test cannot be answered once at mount. A desktop page dragged below
 * the threshold, or a tablet rotated into portrait, keeps whatever pins it
 * already had: the stage stops fitting and the section keeps consuming several
 * viewports of scroll for a composition nobody can see. The caller re-runs its
 * effect on change, which tears the context down and rebuilds or refuses.
 */
export function watchStoryAllowed(minWidth: number, onChange: () => void): () => void {
  const width = window.matchMedia(`(min-width: ${minWidth}px)`);
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  width.addEventListener("change", onChange);
  motion.addEventListener("change", onChange);
  return () => {
    width.removeEventListener("change", onChange);
    motion.removeEventListener("change", onChange);
  };
}

/**
 * Whether the pinned choreography should run at all.
 *
 * Reduced motion is the obvious refusal. The width test is the other one: a
 * pinned story needs a viewport it can compose inside, and below this the
 * sections use their plain stacked layout instead of a shrunken copy of the
 * desktop cinema.
 */
export function storyAllowed(minWidth: number): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  return window.innerWidth >= minWidth;
}

/**
 * Refresh ScrollTrigger's geometry, debounced.
 *
 * Pin distances are computed from element heights, so they are wrong after a
 * resize, after a font swap and after an image decode changes a layout. They
 * are also expensive to recompute: a resize drag fires dozens of events and
 * refreshing on each one locks the main thread. One trailing call is enough.
 */
export function scheduleRefresh(ScrollTriggerRef: typeof ScrollTrigger, delay = 180): () => void {
  let timer = 0;
  const run = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => ScrollTriggerRef.refresh(), delay);
  };
  window.addEventListener("resize", run);
  window.addEventListener("orientationchange", run);
  /* Fonts change metrics after first paint, and a pin distance measured before
     Geist arrives is measured against the fallback's line heights. */
  if (document.fonts?.ready) void document.fonts.ready.then(() => ScrollTriggerRef.refresh());
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("resize", run);
    window.removeEventListener("orientationchange", run);
  };
}
