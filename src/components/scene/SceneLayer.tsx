"use client";

/**
 * One scene: its atmosphere, its entry, and the pointer light it carries.
 *
 * Wraps a section without changing it. Everything it does is expressed as CSS
 * custom properties written onto its own element, so the section inside is the
 * same markup, the same headings, the same focus order and the same DOM it was
 * before any of this existed.
 *
 * FOUR THINGS IT WRITES, once per frame, and nothing else:
 *
 *   --scene-p        0..1 as the section crosses the viewport
 *   --scene-enter    0..1 for the entry choreography, finishing early
 *   --pointer-x/y    the smoothed pointer, only for scenes that use it
 *   --scene-live     1 while the section is near enough to be worth animating
 *
 * IT DOES NOT OWN A FRAME LOOP. Every scene reads from one shared scheduler,
 * and subscribes only while an IntersectionObserver says it is near the
 * viewport. Six sections each running their own loop would read the scroll
 * position six times a frame and keep working for sections nobody can see.
 *
 * IT IS AN ENHANCEMENT. The server renders the section with no scene class, so
 * every entry rule is inert: nothing starts hidden, nothing starts moved, and a
 * visitor whose JavaScript failed or who asked for reduced motion gets the
 * page composed and still.
 */

import { useEffect, useRef, useState } from "react";

import { subscribe } from "@/lib/motion-scheduler";
import { clamp01 } from "@/lib/scroll-geometry";
import { ENTER_COMPLETE_AT, SCENE_BY_ID, type SceneId } from "@/lib/scenes";

/**
 * How far outside the viewport a scene starts working.
 *
 * Generous enough that its entry has already begun by the time any of it is on
 * screen, tight enough that a section three screens away is doing nothing.
 */
const NEAR_MARGIN = "60% 0px 60% 0px";

export default function SceneLayer({
  scene: sceneId,
  children,
}: {
  scene: SceneId;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);
  const nearRef = useRef(false);

  const scene = SCENE_BY_ID[sceneId];

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setEnhanced(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!enhanced) return;
    const root = rootRef.current;
    if (!root) return;

    /* Geometry is measured here and on resize, never in a frame. */
    let top = 0;
    let height = 1;
    const measure = () => {
      const rect = root.getBoundingClientRect();
      top = rect.top + window.scrollY;
      height = root.offsetHeight;
    };
    measure();

    let release: (() => void) | null = null;

    const read = (frame: {
      scrollY: number;
      viewportHeight: number;
      pointerX: number;
      pointerY: number;
    }) => {
      /* How far the section has crossed the viewport: 0 as its top edge reaches
         the bottom of the screen, 1 as its bottom edge leaves the top. This
         drives the atmosphere, which should track the whole passage. */
      const span = height + frame.viewportHeight;
      const lead = frame.scrollY + frame.viewportHeight - top;
      const p = clamp01(lead / Math.max(1, span));
      root.style.setProperty("--scene-p", p.toFixed(4));

      /*
        The entry is measured against the VIEWPORT, not against the section.

        Measuring it against the section looks correct and is wrong for any
        section taller than the screen. The work section reserves several
        viewports of scroll for its screen sequence, so a fraction of its own
        height put the end of the entry thousands of pixels down: the frame
        would still be arriving, still scaled, still translating, while the
        visitor was already scrolling through the screens inside it.

        Against the viewport an entry always completes shortly after the
        section's leading edge is on screen, whatever the section's height,
        which is what "the scene has arrived" is supposed to mean.
      */
      root.style.setProperty(
        "--scene-enter",
        clamp01(lead / Math.max(1, frame.viewportHeight * ENTER_COMPLETE_AT)).toFixed(4)
      );
      if (scene.field === "liquid") {
        root.style.setProperty("--pointer-x", frame.pointerX.toFixed(4));
        root.style.setProperty("--pointer-y", frame.pointerY.toFixed(4));
      }
    };

    /* Only near sections subscribe. This is what keeps a page with six scenes
       from doing six sections' worth of work at every scroll position. */
    const observer = new IntersectionObserver(
      ([entry]) => {
        const near = entry.isIntersecting;
        if (near === nearRef.current) return;
        nearRef.current = near;
        root.style.setProperty("--scene-live", near ? "1" : "0");
        /* The compositing hint goes on and off with the subscription rather
           than living on six full-width sections for the life of the page.
           Toggled here rather than through state because a scroll must not
           re-render six components. */
        root.classList.toggle("scene--near", near);
        if (near) {
          measure();
          release = subscribe(read);
        } else {
          release?.();
          release = null;
        }
      },
      { rootMargin: NEAR_MARGIN }
    );
    observer.observe(root);

    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(root);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      release?.();
      release = null;
      nearRef.current = false;
      root.classList.remove("scene--near");
    };
  }, [enhanced, scene.field]);

  return (
    <div
      ref={rootRef}
      className={`scene scene--${sceneId} scene--enter-${scene.enter}${
        enhanced ? " scene--live" : ""
      }`}
      data-scene={sceneId}
      style={
        {
          "--scene-accent": scene.accent,
          "--scene-accent-alt": scene.accentAlt,
          "--scene-travel": scene.travel,
          "--scene-scale-from": scene.scaleFrom,
          "--scene-opacity-from": scene.opacityFrom,
        } as React.CSSProperties
      }
    >
      {/* The atmosphere. Behind the content, never over it, and inert to the
          pointer so it cannot eat a click or a hover anywhere on the page. */}
      {scene.field !== "none" ? (
        <div className={`scene__field scene__field--${scene.field}`} aria-hidden="true" />
      ) : null}

      <div className="scene__content">{children}</div>
    </div>
  );
}
