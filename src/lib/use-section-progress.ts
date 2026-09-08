"use client";

/**
 * How far a section has travelled through the viewport, per frame.
 *
 * WHAT THIS REPLACES
 *
 * `use-sticky-progress.ts`, which also owned a CSS-sticky pinning mode and a
 * fit test that refused to pin a stage taller than the viewport. Both are gone:
 * pinning is ScrollTrigger's job now, and the fit test had exactly one purpose,
 * which was to decide whether the Product studio could be pinned. That decision
 * is no longer made at runtime. The studio is not the pinned thing any more;
 * `ProductStory` is, and it is built to the viewport by construction.
 *
 * Removing it rather than leaving it unused matters because the test was not
 * neutral: it silently disabled a section's motion when a measurement failed,
 * which is the kind of thing that looks like a rendering bug months later.
 *
 * WHAT IS LEFT
 *
 * One reader on the shared scheduler, reporting 0 to 1 as a section crosses the
 * viewport. The architecture tracer is the only caller, and it wants exactly
 * this: no pin, no reserved range, no stage.
 */

import { useEffect, useRef, useState } from "react";

import { subscribe } from "./motion-scheduler";
import { viewportProgress } from "./scroll-geometry";

export type SectionProgressOptions<R extends HTMLElement> = {
  /**
   * Called once per frame with 0 to 1 while the section is on screen, and with
   * the section element itself so a caller never has to reach for a ref of its
   * own during the scroll path.
   */
  onFrame: (progress: number, elements: { range: R }) => void;
  /** False keeps the section entirely plain, for width or preference gates. */
  enabled?: boolean;
};

export function useSectionProgress<R extends HTMLElement>({
  onFrame,
  enabled = true,
}: SectionProgressOptions<R>) {
  const rangeRef = useRef<R>(null);
  const [enhanced, setEnhanced] = useState(false);

  /* Held in a ref so a caller may pass an inline function without the
     subscription tearing down and rebuilding on every render. */
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  /* One piece of state, not two. Deriving `enhanced` from `allowed` in a second
     effect was a state write during an effect for a value that is simply the
     same thing under another name. */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setEnhanced(enabled && !mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [enabled]);

  useEffect(() => {
    if (!enhanced) return;
    const range = rangeRef.current;
    if (!range) return;

    /* Geometry is measured here and on resize, never inside a frame: reading
       layout during the scroll path is what turns a smooth page into a janky
       one. */
    let top = 0;
    let height = 1;
    const measure = () => {
      const rect = range.getBoundingClientRect();
      top = rect.top + window.scrollY;
      height = range.offsetHeight;
    };
    measure();

    const release = subscribe((frame) => {
      onFrameRef.current(
        viewportProgress(frame.scrollY, top, height, frame.viewportHeight),
        { range }
      );
    });

    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    const observer = new ResizeObserver(onResize);
    observer.observe(range);

    return () => {
      release();
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, [enhanced]);

  return { rangeRef, enhanced };
}
