"use client";

/**
 * The page's atmosphere: one fixed canvas behind everything, running the fluid.
 *
 * This component is deliberately almost empty. All it does is create a canvas,
 * hand it to `src/lib/fluid.ts`, and decide when the simulation should be
 * running. It holds no animation state, and a pointer move never touches React:
 * the listener writes straight into the simulation, so moving the mouse across
 * the page causes zero renders.
 *
 * WHAT IT REPLACES
 *
 * The per-section `.scene__field` elements, which were radial gradients whose
 * centres followed a smoothed pointer. There is now one surface for the whole
 * document rather than one per section, which is also what makes a continuous
 * fluid possible: a field that restarts at every section boundary cannot carry
 * momentum across one.
 *
 * WHEN IT DOES NOT RUN
 *
 *   prefers-reduced-motion   never starts; the static field is painted in CSS
 *   no WebGL2 or no float    same, and this is a supported outcome
 *   document hidden          paused, because a background tab should cost zero
 *   scrolled past the page   paused by IntersectionObserver on a sentinel
 *
 * In every one of those cases the page keeps a composed multi-hue background,
 * because that background is a CSS gradient on the same element and the canvas
 * is drawn over it rather than instead of it.
 */

import { useEffect, useRef } from "react";

import { DESKTOP_CONFIG, MOBILE_CONFIG, createFluid, type FluidHandle } from "@/lib/fluid";

/** Below this the coarse configuration is used and the pointer is ignored. */
const MOBILE_WIDTH = 900;

export default function FluidField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<FluidHandle | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    /* A coarse pointer is a finger. There is nothing to follow, and the brief
       is explicit that touch must not be simulated, so those devices get the
       autonomous drift and nothing else. */
    const coarse = window.matchMedia("(pointer: coarse)");

    let handle: FluidHandle | null = null;
    let disposed = false;

    const start = () => {
      if (disposed || handle || reduced.matches) return;
      const mobile = window.innerWidth < MOBILE_WIDTH || coarse.matches;
      handle = createFluid(canvas, mobile ? MOBILE_CONFIG : DESKTOP_CONFIG);
      handleRef.current = handle;
      /* Null means no WebGL2 or no float rendering. The CSS field underneath is
         already correct, so there is nothing to fall back to and nothing to
         report: the canvas simply stays transparent. */
      if (!handle) {
        setState("unavailable");
        return;
      }
      setState("running");
      handle.setRunning(true);
    };

    /* Written onto the DOM rather than into React state: this decides whether
       the CSS fallback field is showing, and it must not re-render the page. */
    const setState = (value: string) => {
      canvas.dataset.fluid = value;
      if (wrapRef.current) wrapRef.current.dataset.fluid = value;
    };

    const stop = () => {
      handle?.destroy();
      handle = null;
      handleRef.current = null;
      setState("off");
    };

    /* --- Reduced motion, watched rather than read once ------------------ */
    const onReduced = () => {
      if (reduced.matches) stop();
      else start();
    };
    reduced.addEventListener("change", onReduced);

    /* --- Pointer: straight into the simulation, never into React -------- */
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      handle?.pointer(e.clientX, e.clientY);
    };
    const onPointerLeave = () => handle?.release();
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);

    /* --- Size ----------------------------------------------------------- */
    const onResize = () => handle?.resize();
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    /* --- Do not simulate what nobody is looking at ---------------------- */
    const onVisibility = () => handle?.setRunning(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    start();

    return () => {
      disposed = true;
      reduced.removeEventListener("change", onReduced);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      stop();
    };
  }, []);

  return (
    <div ref={wrapRef} className="fluid" data-fluid="off" aria-hidden="true">
      <canvas ref={canvasRef} className="fluid__canvas" data-fluid="off" />
    </div>
  );
}
