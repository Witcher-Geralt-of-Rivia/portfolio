"use client";

/**
 * One sticky scroll range, measured once and painted per frame.
 *
 * The mechanics three sections now share: reserve a scroll range, pin a stage
 * inside it, turn scroll position into a 0..1 number, and hand that number to
 * the caller once per animation frame. Everything above that number is the
 * caller's business.
 *
 * This is a primitive, not a framework. It knows nothing about panels, cards,
 * nodes or credentials, and it must stay that way: the certification deck's
 * geometry lives with the certification deck for exactly this reason.
 *
 * FOUR RULES CARRIED FORWARD FROM THE DECK, each of which was a real defect:
 *
 * The enhancement starts OFF. The server renders the readable, untransformed
 * layout and the choreography is a mount-time upgrade, so a visitor whose
 * JavaScript failed or who asked for reduced motion never sees a section
 * waiting at `opacity: 0` for a handler that will not run.
 *
 * The sticky `top` is read, never assumed, and carried into the range height,
 * the progress numerator and the progress denominator alike. Dropping it from
 * any one of the three ends the choreography early by exactly its height.
 *
 * The range height is written BEFORE the range's position is read. Setting the
 * height moves everything below it, so reading first measures the old layout.
 *
 * `paint` clears the frame sentinel as its first statement. Clearing it last
 * turns the coalescing guard into a permanent lock and the section freezes
 * after one frame.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { stickyProgress, stickyRangeHeight, viewportProgress } from "./scroll-geometry";

type Geometry = {
  rangeTop: number;
  rangeHeight: number;
  stageHeight: number;
  stickyTop: number;
  viewportHeight: number;
};

export type StickyProgressOptions = {
  /**
   * Pixels of scroll the stage stays pinned for, from the measured viewport.
   * Called on every measurement, so it can respond to viewport height.
   * Ignored when `sticky` is false.
   */
  travel: (viewportHeight: number) => number;
  /**
   * False for a section that is not pinned: progress then runs as the element
   * travels through the viewport, and no scroll range is reserved.
   *
   * Intelligent Systems uses this. Its trace should advance while the section
   * passes, and pinning it would put three pinned sections in a row.
   */
  sticky?: boolean;
  /**
   * Called once per frame with 0..1 progress and the two elements.
   *
   * The elements are handed in rather than left for the caller to reach through
   * a ref, because a frame callback is defined before the hook that owns the
   * refs is called. Passing them removes that ordering problem and leaves each
   * element with exactly one owner.
   *
   * Write CSS custom properties and set integer React state here; do not read
   * layout, because this runs inside the scroll path.
   */
  onFrame: (progress: number, elements: { range: HTMLElement; stage: HTMLElement }) => void;
  /** Custom property holding the reserved range height. Namespaced per section. */
  rangeHeightProperty: string;
  /** Extra elements whose size changes should force a re-measure. */
  observe?: (HTMLElement | null)[];
  /** Set false to leave the section unenhanced regardless of preference. */
  enabled?: boolean;
  /**
   * Pixels of breathing room below a pinned stage. The stage must fit inside
   * the viewport with this much to spare or the section is left unenhanced.
   */
  fitMargin?: number;
};

export function useStickyProgress<
  R extends HTMLElement = HTMLDivElement,
  S extends HTMLElement = HTMLDivElement,
>({
  travel,
  onFrame,
  rangeHeightProperty,
  observe,
  enabled = true,
  sticky = true,
  fitMargin = 24,
}: StickyProgressOptions) {
  const rangeRef = useRef<R>(null);
  const stageRef = useRef<S>(null);

  const geometryRef = useRef<Geometry>({
    rangeTop: 0,
    rangeHeight: 0,
    stageHeight: 0,
    stickyTop: 0,
    viewportHeight: 0,
  });
  const frameRef = useRef(0);
  const scrollRef = useRef(0);

  /* The callbacks are held in refs so a caller that rebuilds them every render
     does not tear down and re-attach the listeners on every render. Synced in
     an effect rather than during render: writing a ref while rendering is
     unsafe under concurrent rendering, and React's own rules refuse it. */
  const travelRef = useRef(travel);
  const frameCbRef = useRef(onFrame);
  useEffect(() => {
    travelRef.current = travel;
    frameCbRef.current = onFrame;
  });

  const [allowed, setAllowed] = useState(false);
  /**
   * Whether a pinned stage would actually fit on screen.
   *
   * A sticky stage taller than the viewport pins its top and hangs its bottom
   * off the end, where the visitor cannot reach it and cannot scroll to it
   * either: the page is scrolling the range, not the stage. Measured on this
   * page, the product studio came to 1.8 viewport heights at 1024 and the
   * featured frame to 1.2 on a phone, so in both cases pinning would have
   * hidden the bottom of the thing it was holding up to be looked at.
   *
   * So the section only pins when it fits, and otherwise scrolls normally.
   * That is the honest answer to an effect that is correct and unhelpful.
   */
  const [fits, setFits] = useState(true);
  const fitsRef = useRef(true);
  const enhanced = allowed && (!sticky || fits);

  /* Watched rather than sampled: a visitor who changes the preference while the
     page is open gets the change without a reload. */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAllowed(enabled && !mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [enabled]);

  /**
   * Does the stage fit on screen?
   *
   * Measured on its own schedule rather than inside `measure`, and that is not
   * tidiness. `measure` runs only while the section is enhanced, so a fit
   * result computed there could turn the enhancement off and then never run
   * again: the section would stay unpinned for the rest of the visit even if
   * the window were resized back to a size that fits. This watches regardless.
   */
  useEffect(() => {
    if (!allowed || !sticky) return;

    /**
     * Does the stage fit on screen?
     *
     * Defined inside its own effect rather than memoised outside it. It runs on
     * a different schedule from `measure`, which only runs while the section is
     * enhanced: a fit result computed there could switch the enhancement off
     * and then never run again, leaving the section unpinned for the rest of
     * the visit even if the window were resized back to a size that fits.
     */
    const measureFit = () => {
      const stage = stageRef.current;
      if (!stage) return;
      /* The offset is read from the token rather than from the stage's computed
         `top`, and that distinction is the whole correctness of this function.

         While the section is unenhanced the stage is `position: static`, so its
         computed `top` is `auto`, which parses to nothing and leaves the offset
         out of the sum. Measured at 1920, that made a stage of 988px look like
         it fitted a 1080px viewport when pinning it would actually need 1122,
         and the section enhanced itself into exactly the state this check
         exists to prevent.

         The token is a plain length, so parsing it is safe: the trap about
         `getPropertyValue` returning an unresolved `min()` applies to custom
         properties that carry one, and this one does not. */
      const stickyTop =
        Number.parseFloat(
          window.getComputedStyle(document.documentElement).getPropertyValue("--nav-scroll-margin")
        ) || 0;
      const roomFor = stage.offsetHeight + stickyTop + fitMargin <= window.innerHeight;
      if (roomFor !== fitsRef.current) {
        fitsRef.current = roomFor;
        setFits(roomFor);
      }
    };

    measureFit();
    window.addEventListener("resize", measureFit);
    const observer = new ResizeObserver(measureFit);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => {
      window.removeEventListener("resize", measureFit);
      observer.disconnect();
    };
  }, [allowed, sticky, fitMargin]);

  const measure = useCallback(() => {
    const range = rangeRef.current;
    const stage = stageRef.current;
    if (!range || !stage) return;

    const viewportHeight = window.innerHeight;

    if (!sticky) {
      const rect = range.getBoundingClientRect();
      geometryRef.current = {
        rangeTop: rect.top + window.scrollY,
        rangeHeight: range.offsetHeight,
        stageHeight: 0,
        stickyTop: 0,
        viewportHeight,
      };
      return;
    }

    const stageHeight = stage.offsetHeight;
    /* Read, not assumed. The offset is a design token and changes with the
       viewport; anything unparseable falls back to no offset. */
    const stickyTop = Number.parseFloat(window.getComputedStyle(stage).top) || 0;

    const rangeHeight = stickyRangeHeight(
      stageHeight,
      travelRef.current(viewportHeight),
      stickyTop
    );

    range.style.setProperty(rangeHeightProperty, `${rangeHeight}px`);

    /* After the height, never before. */
    const rect = range.getBoundingClientRect();
    geometryRef.current = {
      rangeTop: rect.top + window.scrollY,
      rangeHeight,
      stageHeight,
      stickyTop,
      viewportHeight,
    };
  }, [rangeHeightProperty, sticky]);

  const paint = useCallback(() => {
    frameRef.current = 0;
    const range = rangeRef.current;
    const stage = stageRef.current;
    if (!range || !stage) return;
    const { rangeTop, rangeHeight, stageHeight, stickyTop, viewportHeight } =
      geometryRef.current;
    frameCbRef.current(
      sticky
        ? stickyProgress(scrollRef.current, rangeTop, rangeHeight, stageHeight, stickyTop)
        : viewportProgress(scrollRef.current, rangeTop, rangeHeight, viewportHeight),
      { range, stage }
    );
  }, [sticky]);

  const schedule = useCallback(() => {
    if (frameRef.current !== 0) return;
    frameRef.current = requestAnimationFrame(paint);
  }, [paint]);

  useEffect(() => {
    if (!enhanced) return;

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
    /* Orientation change and mobile browser chrome both land as resize, but a
       font swap or a reflow above the section does not, which is what the
       observer is for. */
    const observer = new ResizeObserver(remeasure);
    if (rangeRef.current) observer.observe(rangeRef.current);
    if (stageRef.current) observer.observe(stageRef.current);
    for (const el of observe ?? []) if (el) observer.observe(el);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", remeasure);
      observer.disconnect();
      if (frameRef.current !== 0) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
    };
    /* `observe` is intentionally spread into the dependency list by identity of
       its members rather than the array, so a caller passing a fresh array
       literal does not re-attach every render. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enhanced, measure, schedule, ...(observe ?? [])]);

  /* Leaving enhanced mode has to give the range its natural height back, or a
     visitor who turns on reduced motion is left with the tall empty scroll
     range the choreography needed. */
  useEffect(() => {
    if (enhanced) return;
    rangeRef.current?.style.removeProperty(rangeHeightProperty);
  }, [enhanced, rangeHeightProperty]);

  /* A stage that stopped fitting has to give its range back immediately, not
     on the next preference change. */
  useEffect(() => {
    if (fits) return;
    rangeRef.current?.style.removeProperty(rangeHeightProperty);
  }, [fits, rangeHeightProperty]);

  return { rangeRef, stageRef, enhanced };
}
