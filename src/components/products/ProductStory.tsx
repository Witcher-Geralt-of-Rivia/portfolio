"use client";

/**
 * Product Engineering, as a pinned cinematic sequence.
 *
 * THE STAGE IS REDESIGNED, NOT FORCED
 *
 * The interactive studio below this is 988px tall, and the previous attempt at
 * a pinned Product section refused to pin because of it: pinning a stage taller
 * than the viewport holds its top on screen and hangs its controls off the
 * bottom, where nobody can see or reach them. Overriding that check would have
 * reproduced exactly that problem inside a pin.
 *
 * So this is a different presentation of the same three surfaces. It is built
 * to a height of `100svh` minus the navigation clearance and its own padding,
 * every state fits inside that box, and nothing here scrolls internally. The
 * interactive studio is still on the page, below, unchanged: this is the story,
 * that is the instrument.
 *
 * FOUR STATES, SCRUBBED
 *
 *   01  the web application alone, dominant
 *   02  it moves aside and scales back; the phone arrives from the right
 *   03  the assist panel rises from below; the three begin to line up
 *   04  all three resolve into one connected composition
 *
 * Progress is scroll position and nothing else. `scrub: true` with
 * `ease: "none"` on the primary transforms means stopping the scroll stops the
 * story exactly where it is, and scrolling back runs it backwards. Nothing here
 * is on a timer.
 *
 * THE SURFACES ARE THE REAL ONES. No new product architecture is invented: the
 * same `WebProductSurface`, `MobileProductSurface` and `AiAssistSurface` the
 * section has always used, at a size that fits the stage.
 */

import { useEffect, useRef, useState } from "react";

import AiAssistSurface from "./AiAssistSurface";
import MobileProductSurface from "./MobileProductSurface";
import WebProductSurface from "./WebProductSurface";
import { PRODUCT_SCENARIOS } from "./product-scenarios";
import {
  getScrollStory,
  scheduleRefresh,
  storyAllowed,
  watchStoryAllowed,
} from "@/lib/scroll-story";

/** Below this the story does not run and the section keeps its plain layout. */
const STORY_MIN_WIDTH = 1060;

/**
 * Viewport heights of scroll the pinned stage consumes.
 *
 * Four states and three transitions. Long enough that each state is on screen
 * long enough to be read as a state, short enough that it is not a tunnel.
 */
const TRACK_VH = 3.6;

const STATES = [
  { index: "01", title: "Web application", note: "One product, seen first where most of the work happens." },
  { index: "02", title: "Mobile surface", note: "The same system in the hand, in the field, on the forecourt." },
  { index: "03", title: "AI assist", note: "A local, deterministic assistant reading the same state." },
  { index: "04", title: "One system", note: "Three surfaces, one product, one source of truth." },
];

export default function ProductStory() {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  /* Bumped whenever the width or motion gate changes, so the effect below
     rebuilds or refuses instead of leaving a pin attached at a size it no
     longer fits. */
  const [gate, setGate] = useState(0);
  useEffect(() => watchStoryAllowed(STORY_MIN_WIDTH, () => setGate((n) => n + 1)), []);

  useEffect(() => {
    const story = getScrollStory();
    const root = rootRef.current;
    if (!story || !root) return;
    if (!storyAllowed(STORY_MIN_WIDTH)) return;

    const { gsap, ScrollTrigger } = story;

    /* Everything created inside this context is reverted together, which is
       what makes React's double-invoked effects safe in development and what
       guarantees no trigger outlives the component. */
    const ctx = gsap.context(() => {
      const web = root.querySelector<HTMLElement>("[data-story='web']");
      const mob = root.querySelector<HTMLElement>("[data-story='mobile']");
      const ai = root.querySelector<HTMLElement>("[data-story='assist']");
      const link = root.querySelector<HTMLElement>("[data-story='link']");
      const captions = gsap.utils.toArray<HTMLElement>("[data-story-caption]", root);
      if (!web || !mob || !ai) return;

      /*
        The opening state is a DEVIATION from the resting row, not a position of
        its own. CSS already places the three surfaces side by side in the
        proportions the product has; state 01 slides the web surface to the
        middle of the stage and holds the other two offstage, and the whole
        story is the journey back to the layout CSS already describes.

        SCALE ONLY EVER GOES DOWN. Scaling the opening surface UP to make it
        dominant was the first attempt and it put an 893px element in a 900px
        stage: the frame meant to show the application at its most legible had
        its top and bottom cut off. It is dominant here because it is alone and
        centred, at its own full size, and the others give up room by scaling
        back as they arrive.

        The centring offset is MEASURED rather than guessed: the web surface
        sits left of centre in the row by half the width of everything to its
        right, and that depends on the viewport. A hand-written vw value was
        right at one width and wrong at every other.
      */
      const field = root.querySelector<HTMLElement>(".pstory__field");
      const centreOf = (el: HTMLElement) =>
        field ? field.clientWidth / 2 - (el.offsetLeft + el.offsetWidth / 2) : 0;

      gsap.set(web, { x: centreOf(web), scale: 1, transformOrigin: "50% 50%" });
      gsap.set(mob, { x: "26vw", y: "10vh", scale: 0.78, autoAlpha: 0 });
      gsap.set(ai, { x: "18vw", y: "26vh", scale: 0.78, autoAlpha: 0 });
      gsap.set(link, { autoAlpha: 0, scaleX: 0, transformOrigin: "50% 50%" });
      captions.forEach((c, i) => gsap.set(c, { autoAlpha: i === 0 ? 1 : 0 }));

      const showCaption = (tl: gsap.core.Timeline, index: number, at: number) => {
        captions.forEach((c, i) => {
          tl.to(c, { autoAlpha: i === index ? 1 : 0, duration: 0.12, ease: "none" }, at);
        });
      };

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: () => `+=${window.innerHeight * TRACK_VH}`,
          /* THE PIN. The stage stays anchored in the viewport while the page
             keeps taking scroll, which is the whole requirement. */
          pin: stageRef.current,
          pinSpacing: true,
          scrub: true,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });

      /* --- 01 -> 02 : the web app gives up the middle, the phone arrives -- */
      tl.to(web, { x: centreOf(web) * 0.45, scale: 0.94, duration: 1 }, 0)
        .to(mob, { x: "7vw", y: "0vh", scale: 0.94, autoAlpha: 1, duration: 1 }, 0.1);
      showCaption(tl, 1, 0.55);

      /* --- 02 -> 03 : the assist panel rises into the row ---------------- */
      tl.to(web, { x: 0, scale: 0.86, duration: 1 }, 1.1)
        .to(mob, { x: 0, scale: 1, duration: 1 }, 1.1)
        .to(ai, { x: 0, y: 0, scale: 1, autoAlpha: 1, duration: 1 }, 1.15);
      showCaption(tl, 2, 1.6);

      /* --- 03 -> 04 : the row settles and the connection is drawn -------- */
      tl.to([web, mob, ai], { y: "-1vh", duration: 0.7 }, 2.2)
        .to(link, { autoAlpha: 1, scaleX: 1, duration: 0.8 }, 2.35);
      showCaption(tl, 3, 2.7);

      /* Hold at the resolved composition so the section settles before the pin
         releases rather than releasing mid-move. */
      tl.to({}, { duration: 0.5 });

      root.dataset.story = "pinned";
    }, root);

    const stopRefresh = scheduleRefresh(ScrollTrigger);

    return () => {
      stopRefresh();
      ctx.revert();
      delete root.dataset.story;
    };
  }, [gate]);

  /* The first scenario, used purely as the surfaces' content. The interactive
     scenario switching belongs to the studio below, not to a scrubbed story. */
  const scenario = PRODUCT_SCENARIOS[0];

  return (
    <div ref={rootRef} className="pstory">
      <div ref={stageRef} className="pstory__stage">
        <div className="pstory__captions" aria-hidden="true">
          {STATES.map((s, i) => (
            <p key={s.index} className="pstory__caption" data-story-caption={i}>
              <span className="pstory__caption-index">{s.index}</span>
              <span className="pstory__caption-title">{s.title}</span>
              <span className="pstory__caption-note">{s.note}</span>
            </p>
          ))}
        </div>

        {/*
          The surfaces are decorative here: this is a scrubbed retelling of the
          product, and the same components appear again below inside the studio
          where they are real and reachable. Marking the story inert keeps a
          keyboard from landing on a control that is mid-flight, and stops a
          screen reader meeting every panel twice.
        */}
        <div className="pstory__field" aria-hidden="true" inert>
          <div className="pstory__surface pstory__surface--web" data-story="web">
            <WebProductSurface scenario={scenario} active={false} />
          </div>
          <div className="pstory__surface pstory__surface--mobile" data-story="mobile">
            <MobileProductSurface scenario={scenario} active={false} syncStep={0} />
          </div>
          <div className="pstory__surface pstory__surface--assist" data-story="assist">
            <AiAssistSurface scenario={scenario} active={false} resolved />
          </div>
          <span className="pstory__link" data-story="link" />
        </div>
      </div>
    </div>
  );
}
