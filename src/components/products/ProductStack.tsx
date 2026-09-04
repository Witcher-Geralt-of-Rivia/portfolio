"use client";

/**
 * The product studio, with its three surfaces taking it in turn as the section
 * passes.
 *
 * The section's claim is "one product, every surface". The three surfaces are
 * already on screen together, which is what makes that claim, so this does not
 * turn them into slides: the emphasis moves web -> mobile -> assist and the
 * surfaces that are not leading recede a little instead of leaving.
 *
 * NOT PINNED, and that was measured rather than chosen. The brief asks for a
 * sticky stage, and the studio will not fit one: it is 988px tall at 1440 and
 * 1428px at 768, against a usable viewport of 790px once the floating
 * navigation's clearance is taken off. Pinning it would hold the top of the
 * studio on screen and hang its event-flow rail and its Run button off the
 * bottom, where a visitor can neither see them nor scroll to them, because the
 * page would be scrolling the range rather than the stage.
 *
 * So progress runs as the section travels through the viewport instead. The
 * behaviour the brief describes is unchanged: each surface becomes dominant in
 * turn as the visitor scrolls. What is dropped is the pinning, and with it a
 * viewport and a half of reserved scrolling that would have bought a section
 * nobody could read the bottom of. The featured build below IS pinned, because
 * its frame does fit.
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH:
 *
 * The scenario tablist. Those three tabs select which SCENARIO the studio is
 * simulating, which is a different axis from which surface is being looked at,
 * and driving them from scroll would take a control away from the visitor.
 *
 * The `is-active` ring. That is the running flow's own signal for which surface
 * a step is happening on, and it belongs to the Run button. Scroll emphasis is
 * a second, quieter channel: `data-pstack` on the wrapper, read only by rules
 * that set opacity and scale. Press Run mid-scroll and both still read
 * correctly, because they are saying different things.
 *
 * Nothing conceptual changes. No surface is added, removed, reordered or
 * relabelled, and with the enhancement off the section is exactly what it was.
 *
 * Off below 900px, where the three surfaces are already stacked in one column
 * and each is full width. Pinning them there would mean scrolling a viewport to
 * dim a card, which is the kind of effect that is technically correct and makes
 * a page tiring.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useStickyProgress } from "@/lib/use-sticky-progress";
import { activePanel } from "@/lib/scroll-geometry";

/** Web, mobile, assist. Three surfaces, two transitions. */
const SURFACE_COUNT = 3;

/** Below this the section keeps its plain presentation entirely. */
const STACK_MIN_WIDTH = 900;

export default function ProductStack({ children }: { children: React.ReactNode }) {
  const [surface, setSurface] = useState(0);
  const surfaceRef = useRef(0);
  const [wideEnough, setWideEnough] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${STACK_MIN_WIDTH}px)`);
    const apply = () => setWideEnough(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onFrame = useCallback((progress: number) => {
    const next = activePanel(progress, SURFACE_COUNT, surfaceRef.current);
    if (next !== surfaceRef.current) {
      surfaceRef.current = next;
      setSurface(next);
    }
  }, []);

  const { rangeRef, stageRef, enhanced } = useStickyProgress<HTMLDivElement, HTMLDivElement>({
    sticky: false,
    travel: () => 0,
    onFrame,
    rangeHeightProperty: "--pstack-range-h",
    enabled: wideEnough,
  });

  return (
    <div
      ref={rangeRef}
      className={`pstack${enhanced ? " pstack--enhanced" : ""}`}
      data-pstack={enhanced ? String(surface) : undefined}
    >
      <div ref={stageRef} className="pstack__stage">
        {children}
      </div>
    </div>
  );
}
