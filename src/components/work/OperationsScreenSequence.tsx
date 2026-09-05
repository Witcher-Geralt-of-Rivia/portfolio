"use client";

/**
 * Eleven real screens, one at a time, advanced by scroll.
 *
 * The frame holds while the page scrolls past it and the screen inside changes
 * from Overview through to Reports: the actual application, at its actual
 * routes, captured by `qa/capture-operations.mjs`. Nothing here draws a product;
 * it shows photographs of one.
 *
 * WHY EVERY SCREEN IS IN THE DOM AT ONCE
 *
 * They are stacked and cross-transitioned rather than swapped. Mounting one at a
 * time would mean each transition begins with a decode, which is a blank frame
 * at exactly the moment the visitor is looking for a change. Stacking costs
 * eleven `<img>` elements, of which ten are `aria-hidden` and none is focusable,
 * and buys a transition that never flashes.
 *
 * Loading is staged rather than eager: the first screen is fetched at high
 * priority because it is what the section opens on, the next two are fetched
 * normally so the first transitions are ready, and the rest are lazy. Twenty-two
 * screenshots at full priority would be the heaviest thing on the page and most
 * of them are never reached.
 *
 * THE SEMANTIC ORDER DOES NOT MOVE
 *
 * The active screen changes what is visible, never what is in the document. The
 * list is rendered once in canonical order and stays that way, so scrolling
 * cannot reorder anything for a screen reader or for the keyboard.
 */

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { useStickyProgress } from "@/lib/use-sticky-progress";

import {
  DESKTOP_SOURCE,
  MOBILE_SOURCE,
  OPERATIONS_SCREENS,
  SCREEN_COUNT,
  desktopSrc,
  mobileSrc,
  screenAlt,
  screenFrame,
  screenLayer,
  visibleScreen,
} from "./operations-screens";

/**
 * Viewport heights of scroll per module transition.
 *
 * Ten transitions, so this multiplies fast. Long enough that each screen is on
 * screen long enough to be recognised as a different page, short enough that
 * eleven of them is not a tunnel. Tuned by scrolling it.
 */
const PER_SCREEN = 0.42;
const MIN_TRAVEL = 2.2;
const MAX_TRAVEL = 5.4;

/** Below this the sticky sequence stands down and the screens stack normally. */
const SEQUENCE_MIN_WIDTH = 760;

export default function OperationsScreenSequence() {
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const [wideEnough, setWideEnough] = useState(false);
  const screensRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${SEQUENCE_MIN_WIDTH}px)`);
    const apply = () => setWideEnough(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const travel = useCallback((viewportHeight: number) => {
    const raw = (SCREEN_COUNT - 1) * PER_SCREEN;
    const bounded = Math.min(MAX_TRAVEL, Math.max(MIN_TRAVEL, raw));
    return Math.round(bounded * Math.max(1, viewportHeight));
  }, []);

  const onFrame = useCallback((progress: number) => {
    /* The progression itself is in `operations-screens.ts`, with no React and
       no DOM in it, because the place the last screen has been lost twice
       before is arithmetic and arithmetic should be provable without a
       browser. This only writes the result out. */
    const frame = screenFrame(progress);

    for (let i = 0; i < SCREEN_COUNT; i++) {
      const el = screensRef.current[i];
      if (!el) continue;
      const layer = screenLayer(frame, i);
      el.style.setProperty("--screen-show", String(layer.show));
      el.style.setProperty("--screen-clip", layer.clip.toFixed(4));
      el.style.setProperty("--screen-layer", String(layer.layer));
    }

    const next = Math.min(SCREEN_COUNT - 1, visibleScreen(frame));
    if (next !== activeRef.current) {
      activeRef.current = next;
      setActive(next);
    }
  }, []);

  const { rangeRef, stageRef, enhanced } = useStickyProgress<HTMLDivElement, HTMLDivElement>({
    travel,
    onFrame,
    rangeHeightProperty: "--screens-range-h",
    enabled: wideEnough,
  });

  const current = OPERATIONS_SCREENS[active];

  return (
    <div
      ref={rangeRef}
      className={`screens${enhanced ? " screens--enhanced" : ""}`}
      data-screens-active={enhanced ? String(active) : undefined}
    >
      <div ref={stageRef} className="screens__stage">
        {/* The frame. A spectral edge because this is the page's focal
            surface, and a thin bar carrying the module label rather than
            imitation browser controls, which would be clutter around the one
            thing worth looking at. */}
        <div className="spectral screens__frame">
          <div className="spectral__inner screens__inner">
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

            <ul className="screens__list">
              {OPERATIONS_SCREENS.map((screen, i) => (
                <li
                  key={screen.id}
                  className="screens__item"
                  ref={(el) => {
                    screensRef.current[i] = el as HTMLDivElement | null;
                  }}
                  /* Only the screen actually on view is described. The other
                     ten are the same product's other pages and announcing all
                     eleven would be a wall of near-identical alt text. */
                  aria-hidden={enhanced && i !== active ? "true" : undefined}
                >
                  <Image
                    className="screens__shot screens__shot--desktop"
                    src={desktopSrc(screen.id)}
                    alt={screenAlt(screen)}
                    width={DESKTOP_SOURCE.width}
                    height={DESKTOP_SOURCE.height}
                    sizes="(max-width: 760px) 92vw, 1100px"
                    priority={i === 0}
                    loading={i === 0 ? undefined : i <= 2 ? "eager" : "lazy"}
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
