"use client";

/**
 * The featured build, walked through as one connected workflow.
 *
 * The product frame stays anchored while the page scrolls past it, and the
 * emphasis inside it moves through four operational layers: acquisition,
 * rental, operations, intelligence. At the end everything is lit at once and
 * the section releases into the close.
 *
 * WHAT THIS DOES NOT DO, which is most of the design:
 *
 * It does not rebuild the preview per state. The same composition stays on
 * screen throughout and parts of it come forward, because the claim being made
 * is that this is one system seen at four depths. Four pictures swapping would
 * say the opposite.
 *
 * It does not invent app state. Every number in the preview is a canonical seed
 * figure and none of them change: what changes is which of them the visitor is
 * being asked to look at. Nothing here implies a backend, a live message or a
 * real payment.
 *
 * It does not touch Demo 01. The four layers are presentation groups declared
 * in `featured-sequence.ts`; the product's own module grouping is different,
 * is in the demo, and is left alone. Both are true of the same eleven modules.
 *
 * It renders nothing of its own that matters. The section's markup is the
 * server-rendered children passed straight through; this adds a scroll range
 * around them, a state attribute, and a small label. With JavaScript off or
 * reduced motion on, the children are exactly what they were before.
 */

import { useCallback, useRef, useState } from "react";

import { useStickyProgress } from "@/lib/use-sticky-progress";
import { activePanel, stepTravel } from "@/lib/scroll-geometry";

import { FEATURED_STATES, FEATURED_STATE_COUNT } from "./featured-sequence";

/**
 * Viewport heights per transition. Three transitions across four states, so the
 * section holds the viewport for roughly two of them plus the stage itself.
 *
 * Tuned by looking rather than derived: shorter and the layers blur together,
 * longer and the page reads as a tunnel. The bounds exist so a future fifth
 * state cannot quietly turn this into one.
 */
const PER_STATE = 0.72;
const MIN_TRAVEL = 1.2;
const MAX_TRAVEL = 2.6;

export default function FeaturedSequence({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(0);
  /* The integer the frame compares against, kept in a ref so the frame does not
     close over stale React state and does not need to re-create itself when the
     state changes. */
  const stateRef = useRef(0);

  const travel = useCallback(
    (viewportHeight: number) =>
      stepTravel(FEATURED_STATE_COUNT - 1, viewportHeight, PER_STATE, MIN_TRAVEL, MAX_TRAVEL),
    []
  );

  const onFrame = useCallback((progress: number) => {
    /* Hysteresis, because a viewport resting within a pixel of a boundary would
       otherwise toggle the state attribute every frame and the whole section
       would flicker while nothing moved. */
    const next = activePanel(progress, FEATURED_STATE_COUNT, stateRef.current);
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
  }, []);

  const { rangeRef, stageRef, enhanced } = useStickyProgress<HTMLDivElement, HTMLDivElement>({
    travel,
    onFrame,
    rangeHeightProperty: "--fseq-range-h",
  });

  const current = FEATURED_STATES[Math.min(state, FEATURED_STATES.length - 1)];
  /* The last state is the whole system lit at once, which is where the section
     resolves before it releases. */
  const resolved = state === FEATURED_STATE_COUNT - 1;

  return (
    <div
      ref={rangeRef}
      className={`fseq${enhanced ? " fseq--enhanced" : ""}`}
      data-fseq-state={enhanced ? current.id : undefined}
      data-fseq-resolved={enhanced && resolved ? "true" : undefined}
    >
      <div ref={stageRef} className="fseq__stage">
        {/*
          The narrative label. Present only while the choreography runs, because
          without it the section has no states to name and a lone "01 /
          ACQUISITION" over a static frame would be a caption for something that
          is not happening.

          Hidden from assistive technology: the modules it names are already in
          the preview's label and in the breadth list below, and announcing a
          changing caption on scroll is noise rather than information. Nothing
          here is the only place any fact appears.
        */}
        {enhanced ? (
          <p className="fseq__label" aria-hidden="true">
            <span className="fseq__label-index">{current.index}</span>
            <span className="fseq__label-rule" />
            <span className="fseq__label-name">{current.label}</span>
            <span className="fseq__label-note">{current.note}</span>
          </p>
        ) : null}

        {children}
      </div>
    </div>
  );
}
