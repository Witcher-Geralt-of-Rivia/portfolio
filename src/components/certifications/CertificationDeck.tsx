"use client";

/**
 * The sticky deck, and the only moving part in this section.
 *
 * Three decisions worth stating before the code, because each of them is the
 * opposite of what the obvious implementation does.
 *
 * ONE: the readable layout is the default, and the choreography is the upgrade.
 * The server renders a plain grid of cards with no transforms and no opacity
 * tricks. On mount, and only if motion is allowed, `enhanced` turns on and the
 * choreography takes over. So a visitor whose JavaScript failed, or who asked
 * for reduced motion, gets every credential in a readable list rather than a
 * column of invisible cards waiting for a scroll handler that will never run.
 * There is no state in which a card is stuck at `opacity: 0`.
 *
 * TWO: the scroll path does not touch React. A `scroll` listener stores the
 * latest offset and schedules one animation frame; that frame writes CSS custom
 * properties straight onto the card elements. Progress is a continuous value
 * and re-rendering a component tree sixty times a second to express it is the
 * standard way this pattern becomes the slowest thing on the page. React state
 * changes only when the ACTIVE CARD changes, which is an integer, and which
 * happens a handful of times across the whole section.
 *
 * THREE: geometry is measured, never inferred, and measured once. Everything
 * the frame needs is read into a ref on mount and on resize. No
 * `getBoundingClientRect` runs inside the frame, per card or otherwise, so the
 * scroll path contains no forced reflow. The arithmetic itself lives in
 * `deck-geometry.ts`, where it is pure and unit tested.
 *
 * The transforms themselves are CSS. JavaScript writes one number per card
 * (`--cp`, that card's own 0..1 progress) and one for the rail; the stylesheet
 * interpolates position, scale and opacity from it. Compositor-friendly
 * properties only: no width, no left, no layout in the animation at all.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Certification } from "@/content/certifications";

import CertificationCard from "./CertificationCard";
import CertificationModal from "./CertificationModal";
import {
  activeIndex as computeActiveIndex,
  cardProgress,
  deckCapacity,
  cardScreenSlot,
  isCardVisible,
  railShiftContinuous,
  scrollRangeHeight,
  sectionProgress,
  stackDepth,
} from "./deck-geometry";

type Geometry = {
  /** Document offset of the scroll range's top edge. */
  rangeTop: number;
  rangeHeight: number;
  stageHeight: number;
  /** The stage's sticky `top`, read rather than assumed: it is a token. */
  stickyTop: number;
  capacity: number;
};

export default function CertificationDeck({
  certifications,
  heading,
}: {
  certifications: Certification[];
  /* Rendered inside the sticky stage rather than above it. The heading has to
     stay on screen while the deck unfolds beneath it: pinned cards under a
     heading that scrolled away half a viewport ago is a section that has lost
     its own title, and the first capture of this showed exactly that. */
  heading: React.ReactNode;
}) {
  const rangeRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLLIElement | null)[]>([]);

  const geometryRef = useRef<Geometry>({
    rangeTop: 0,
    rangeHeight: 0,
    stageHeight: 0,
    stickyTop: 0,
    capacity: 1,
  });
  const frameRef = useRef(0);
  const scrollRef = useRef(0);

  const [enhanced, setEnhanced] = useState(false);
  const [active, setActive] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const count = certifications.length;

  /* Reduced motion, watched rather than sampled: a visitor who changes the
     setting while the page is open gets the change without a reload. The same
     matchMedia shape the Stage 06-08 labs use. */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setEnhanced(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* One measurement pass. Every DOM read in the component happens here, so the
     per-frame work below is pure writes. */
  const measure = useCallback(() => {
    const range = rangeRef.current;
    const stage = stageRef.current;
    if (!range || !stage) return;

    const stageHeight = stage.offsetHeight;

    /* Capacity comes from the space the deck actually has and the width a card
       actually got.

       The card width is measured off a card rather than read from
       `--cert-card-w`, and that is not fussiness. `getPropertyValue` on a
       custom property returns the SPECIFIED value, not the computed one: on a
       phone the token is `min(300px, calc(100vw - 2 * var(--gutter)))` and
       parsing it yields NaN. That fell through to a fallback, capacity came out
       as 24, and every off-screen card on the phone stayed focusable. The
       element knows its own width; ask it. */
    const deck = deckRef.current;
    const firstCard = cardsRef.current[0];
    const gap = Number.parseFloat(window.getComputedStyle(stage).getPropertyValue("--cert-gap")) || 0;
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 0;
    const capacity = deckCapacity(deck ? deck.clientWidth : 0, cardWidth, gap);
    /* Read, not assumed: the offset is a design token and changes with the
       viewport. `top` resolves to a pixel length here because the rule sets
       one; anything unparseable falls back to no offset. */
    const stickyTop = Number.parseFloat(window.getComputedStyle(stage).top) || 0;
    const rangeHeight = scrollRangeHeight(count, window.innerHeight, stageHeight, stickyTop);

    range.style.setProperty("--cert-range-h", `${rangeHeight}px`);

    /* Read the top AFTER the height is applied: setting it moves everything
       below, and on a resize that includes this element's own offset if the
       section above it reflowed. */
    const rect = range.getBoundingClientRect();
    geometryRef.current = {
      rangeTop: rect.top + window.scrollY,
      rangeHeight,
      stageHeight,
      stickyTop,
      capacity,
    };
  }, [count]);

  /* The frame. Reads nothing from the DOM, writes only custom properties. */
  const paint = useCallback(() => {
    frameRef.current = 0;
    const { rangeTop, rangeHeight, stageHeight, stickyTop, capacity } = geometryRef.current;
    const p = sectionProgress(scrollRef.current, rangeTop, rangeHeight, stageHeight, stickyTop);
    const nextActive = computeActiveIndex(p, count);

    const stage = stageRef.current;
    if (stage) stage.style.setProperty("--cert-p", p.toFixed(4));

    /* The rail's shift is continuous and belongs on the frame, not in a
       render: it has to track the cards it is carrying, which move smoothly. */
    const shift = railShiftContinuous(p, count, capacity);
    const rail = railRef.current;
    if (rail) rail.style.setProperty("--cert-shift", shift.toFixed(4));

    for (let i = 0; i < count; i++) {
      const el = cardsRef.current[i];
      if (!el) continue;
      el.style.setProperty("--cert-cp", cardProgress(p, i, count).toFixed(4));
      el.style.setProperty("--cert-depth", String(stackDepth(i, nextActive)));
      /* `inert` is owned here rather than by a React prop, for the same reason
         the transforms are: it depends on the continuous rail position, and
         re-rendering to express a continuous value is what this whole component
         is arranged to avoid. */
      el.inert = !isCardVisible(cardScreenSlot(p, i, count, shift), capacity);
    }

    /* An integer, and it changes a handful of times per section. This is the
       only React update the scroll path can cause. */
    setActive((current) => (current === nextActive ? current : nextActive));
  }, [count]);

  const schedule = useCallback(() => {
    if (frameRef.current !== 0) return;
    frameRef.current = requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => {
    if (!enhanced || count === 0) return;

    const onScroll = () => {
      scrollRef.current = window.scrollY;
      schedule();
    };

    const remeasure = () => {
      measure();
      scrollRef.current = window.scrollY;
      schedule();
    };

    remeasure();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", remeasure);
    /* Orientation change and mobile browser chrome collapsing both land as
       resize, but a font swap or a reflow above this section does not, which is
       what the observer is for. */
    const observer = new ResizeObserver(remeasure);
    if (stageRef.current) observer.observe(stageRef.current);
    if (rangeRef.current) observer.observe(rangeRef.current);
    /* The deck's width is what capacity is measured from, so a change to it has
       to re-measure even when the viewport did not change. */
    if (deckRef.current) observer.observe(deckRef.current);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      observer.disconnect();
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
  }, [enhanced, count, measure, schedule]);

  /* Leaving enhanced mode has to put the range back to its natural height, or a
     visitor who turns on reduced motion is left with the tall empty scroll
     range the choreography needed. */
  useEffect(() => {
    if (enhanced) return;
    rangeRef.current?.style.removeProperty("--cert-range-h");
  }, [enhanced]);

  const openCertification = certifications.find((c) => c.id === openId) ?? null;
  const openIndex = openCertification
    ? certifications.findIndex((c) => c.id === openCertification.id)
    : -1;

  return (
    <>
      <div
        ref={rangeRef}
        className={`certs__range${enhanced ? " certs__range--enhanced" : ""}`}
      >
        <div ref={stageRef} className="certs__stage">
          {heading}

          <div ref={deckRef} className="certs__deck">
            <div ref={railRef} className="certs__rail">
              <ul className="certs__list">
                {certifications.map((certification, i) => (
                  <li
                    key={certification.id}
                    className="cert-card"
                    ref={(el) => {
                      cardsRef.current[i] = el;
                    }}
                    style={{ "--cert-i": i } as React.CSSProperties}
                    aria-current={enhanced && i === active ? "true" : undefined}
                  >
                    <CertificationCard
                      certification={certification}
                      index={i + 1}
                      total={count}
                      onOpen={() => setOpenId(certification.id)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* The counter is progress metadata, not a control. Hidden from
              assistive technology because the cards carry their own index and
              hearing it change on scroll would be noise. */}
          <p className="certs__progress" aria-hidden="true">
            <span className="certs__progress-current">
              {String(Math.min(active + 1, count)).padStart(2, "0")}
            </span>
            <span className="certs__progress-rule" />
            <span className="certs__progress-total">{String(count).padStart(2, "0")}</span>
          </p>
        </div>
      </div>

      {openCertification ? (
        <CertificationModal
          certification={openCertification}
          index={openIndex + 1}
          total={count}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </>
  );
}
