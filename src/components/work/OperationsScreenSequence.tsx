"use client";

/**
 * Eleven real screens of the Operations application, pinned and scrubbed.
 *
 * The stage is held in the viewport by ScrollTrigger while the page keeps
 * taking vertical scroll, and the application page inside the frame changes
 * from Overview through to Reports as scroll progress advances. The document
 * does not walk past eleven ordinary blocks: it stays anchored and the screen
 * changes.
 *
 * D-109 IS PRESERVED, AND IT IS THE POINT
 *
 * Screens are never crossfaded. Eleven screenshots of one application share a
 * layout, a chrome and a colour, so two of them at half opacity read as a
 * printing fault rather than as one changing into another. A screen is painted
 * or it is not; the arriving one is uncovered over the one it replaces by a
 * moving clip edge, and the outgoing one is only dropped once it is covered.
 *
 * The wipe direction follows a DESIGNED four-step cycle rather than alternating
 * or being picked at random: up, left, down, right, repeating. Ten consecutive
 * wipes in one direction become a single repeated gesture that stops being
 * noticed; a rotating compass keeps each change legible and keeps the sequence
 * spatially coherent.
 *
 * NOTHING HIGH FREQUENCY REACHES REACT. The clip edge and the layer order are
 * written as CSS custom properties by the scrubbed timeline, and the module
 * label is the one thing that changes React state, once per screen rather than
 * once per frame.
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import {
  getScrollStory,
  scheduleRefresh,
  storyAllowed,
  watchStoryAllowed,
} from "@/lib/scroll-story";

import {
  DESKTOP_SOURCE,
  MOBILE_SOURCE,
  OPERATIONS_SCREENS,
  SCREEN_COUNT,
  desktopSrc,
  mobileSrc,
  screenAlt,
} from "./operations-screens";

/** Below this the sequence stands down and the screens stack normally. */
const SEQUENCE_MIN_WIDTH = 760;

/**
 * Viewport heights of scroll per transition.
 *
 * Ten transitions, so this multiplies fast. Long enough that each module is on
 * screen long enough to be recognised as a different page of the application,
 * short enough that eleven of them is not a tunnel. Every one of those
 * viewports visibly advances the screen: none of it is padding.
 */
const PER_TRANSITION_VH = 0.85;
/** A settle at the end so Reports resolves before the pin releases. */
const TAIL_VH = 0.45;

/**
 * The wipe compass. Four directions, cycling, so no two consecutive changes
 * arrive the same way and the pattern is a designed rotation rather than noise.
 */
const DIRECTIONS = ["up", "left", "down", "right"] as const;

/**
 * How much of a segment the reveal itself occupies.
 *
 * The rest is dwell: the screen sits fully uncovered and still, which is what
 * gives a visitor time to recognise it as a different page of the application.
 */
const REVEAL = 0.82;

export default function OperationsScreenSequence() {
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);

  /* Bumped whenever the width or motion gate changes, so the effect below
     rebuilds or refuses instead of leaving a pin attached at a size it no
     longer fits. */
  const [gate, setGate] = useState(0);
  useEffect(() => watchStoryAllowed(SEQUENCE_MIN_WIDTH, () => setGate((n) => n + 1)), []);

  useEffect(() => {
    const story = getScrollStory();
    const root = rootRef.current;
    if (!story || !root) return;
    if (!storyAllowed(SEQUENCE_MIN_WIDTH)) return;

    const { gsap, ScrollTrigger } = story;

    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>(".screens__item", root);
      if (items.length !== SCREEN_COUNT) return;

      /* Opening state: the first screen painted and uncovered, the rest not
         painted at all. Written directly rather than animated from, so the
         first frame is already correct. */
      items.forEach((el, i) => {
        el.style.setProperty("--screen-show", i === 0 ? "1" : "0");
        el.style.setProperty("--screen-clip", i === 0 ? "0" : "1");
        el.dataset.dir = DIRECTIONS[(i - 1 + DIRECTIONS.length) % DIRECTIONS.length];
      });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: () =>
            `+=${window.innerHeight * (PER_TRANSITION_VH * (SCREEN_COUNT - 1) + TAIL_VH)}`,
          pin: stageRef.current,
          pinSpacing: true,
          scrub: true,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            /*
              The label, and the only React state in the sequence.

              It names the screen a visitor is actually looking at, which is the
              one that has finished covering the frame, not the one currently
              arriving. Advancing it early would caption a screen that is still
              half revealed.
            */
            /*
              Measured against the TIMELINE's own duration, not against a span
              recomputed from the vh constants.

              The first version recomputed it, and the two drifted: the timeline
              runs 0 to about 10.35 while the arithmetic said 10.53, and the
              accumulated error was enough to skip a whole screen. Leads was
              never captioned at any scroll position, on a sequence that
              revealed it correctly.
            */
            const duration = self.animation?.duration() ?? 0;
            if (!duration) return;
            const scaled = self.progress * duration;
            /*
              A reveal for screen i occupies timeline position [i-1, i-1+REVEAL),
              so screen i is dominant only once `scaled` has passed
              i-1+REVEAL. Counting completed reveals is therefore
              `floor(scaled + (1 - REVEAL))`.

              Rounding at the midpoint was the first version and it captioned
              the arriving screen while the outgoing one still filled most of
              the frame: the bar read Reports over a screen that was visibly
              Inbox.
            */
            const next = Math.min(
              SCREEN_COUNT - 1,
              Math.max(0, Math.floor(scaled + (1 - REVEAL)))
            );
            if (next !== activeRef.current) {
              activeRef.current = next;
              setActive(next);
            }
          },
        },
      });

      /*
        One transition per segment. The arriving screen is painted at full
        opacity for the whole of its reveal and its clip runs 1 to 0; the screen
        underneath stays fully painted until it is covered, then stops being
        painted at all. At no point are two screens semi-transparent.
      */
      /*
        Seed every item's state AT POSITION 0 before any of the segment work.

        A zero-duration `set` at t = 0.82 with nothing recorded earlier has no
        state to reverse into, so GSAP applied it at t = 0 as well: the first
        screen was unpainted from the moment the pin engaged and the frame
        opened empty. Giving the timeline an explicit starting value for each
        item means every later `set` has something to go back to.
      */
      items.forEach((el, i) => {
        tl.set(el, { "--screen-show": i === 0 ? 1 : 0, "--screen-clip": i === 0 ? 0 : 1 }, 0);
      });

      for (let i = 1; i < SCREEN_COUNT; i++) {
        const at = i - 1;
        tl.set(items[i], { "--screen-show": 1 }, at)
          .fromTo(
            items[i],
            { "--screen-clip": 1 },
            { "--screen-clip": 0, duration: REVEAL },
            at
          )
          /* The covered screen stops painting only once the cover is complete,
             so nothing shows through a partly drawn reveal. */
          .set(items[i - 1], { "--screen-show": 0 }, at + REVEAL);
      }

      /* The settle. Reports is fully resolved here and the stage is still
         before the pin releases. */
      tl.to({}, { duration: TAIL_VH / PER_TRANSITION_VH });

      /*
        THE HANDOFF, on its own trigger.

        Runs over the approach and finishes exactly where the pin begins, so the
        two never fight for the same scroll range. Three things happen together
        and they are the ones the direction names: the warm field the Lab leaves
        behind is overtaken by this scene's cyan and violet, and the application
        frame rises and scales into the resting position the pin then holds.

        It animates the frame and the plane, never the stage: the stage is what
        ScrollTrigger pins, and a transform on it would put a containing block
        between the pin and the viewport.
      */
      const plane = root.querySelector<HTMLElement>(".screens__handoff");
      const frame = root.querySelector<HTMLElement>(".screens__frame");
      if (plane && frame) {
        gsap.set(plane, { autoAlpha: 0 });
        gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root,
            start: "top bottom",
            end: "top top",
            scrub: true,
            invalidateOnRefresh: true,
          },
        })
          .fromTo(frame, { yPercent: 16, scale: 0.9 }, { yPercent: 0, scale: 1, duration: 1 }, 0)
          /* Over the viewport, then back off: the plane is a handover, not a
             layer the section keeps. */
          .fromTo(plane, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.55 }, 0)
          .to(plane, { autoAlpha: 0, duration: 0.45 }, 0.55);
      }

      root.dataset.story = "pinned";
    }, root);

    const stopRefresh = scheduleRefresh(ScrollTrigger);

    return () => {
      stopRefresh();
      ctx.revert();
      delete root.dataset.story;
    };
  }, [gate]);

  const current = OPERATIONS_SCREENS[active];

  return (
    <div ref={rootRef} className="screens" data-screens-active={String(active)}>
      {/* The colour plane the Lab's warm field hands over to. Decorative, and
          outside the pinned stage so it cannot affect what the pin measures. */}
      <div className="screens__handoff" aria-hidden="true" />

      <div ref={stageRef} className="screens__stage">
        <div className="screens__bar">
          <p className="screens__product">
            Operations Console
            <span aria-hidden="true"> / </span>
            <span className="screens__module">{current.label}</span>
          </p>
          <p className="screens__index" aria-hidden="true">
            {String(active + 1).padStart(2, "0")}
            <span className="screens__index-sep"> / </span>
            {String(SCREEN_COUNT).padStart(2, "0")}
          </p>
        </div>

        <div className="spectral screens__frame">
          <div className="spectral__inner screens__inner">
            <ul className="screens__list">
              {OPERATIONS_SCREENS.map((screen, i) => (
                <li
                  key={screen.id}
                  className="screens__item"
                  /* Only the screen on view is described. The other ten are the
                     same product's other pages, and announcing all eleven would
                     be a wall of near-identical alt text. */
                  aria-hidden={i !== active ? "true" : undefined}
                >
                  <Image
                    className="screens__shot screens__shot--desktop"
                    src={desktopSrc(screen.id)}
                    alt={screenAlt(screen)}
                    width={DESKTOP_SOURCE.width}
                    height={DESKTOP_SOURCE.height}
                    sizes="(max-width: 760px) 92vw, 1240px"
                    priority={i === 0}
                    /* The next screen is fetched before its reveal begins, or
                       the wipe uncovers an image that has not decoded. */
                    loading={i === 0 ? undefined : i <= 3 ? "eager" : "lazy"}
                  />
                  <Image
                    className="screens__shot screens__shot--mobile"
                    src={mobileSrc(screen.id)}
                    alt={screenAlt(screen)}
                    width={MOBILE_SOURCE.width}
                    height={MOBILE_SOURCE.height}
                    sizes="(max-width: 760px) 92vw, 1px"
                    loading={i === 0 ? "eager" : "lazy"}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
