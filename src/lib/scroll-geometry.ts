/**
 * Sticky scroll geometry, shared and pure.
 *
 * Three sections now drive motion from scroll position, and they were about to
 * contain three copies of the same arithmetic. This is that arithmetic, once,
 * with no React, no DOM and no measurement in it, so it can be checked at every
 * viewport and every panel count in milliseconds rather than by scrolling.
 *
 * Lifted from `src/components/certifications/deck-geometry.ts`, which stays
 * where it is: the certification deck's reveal windows, rail shift, capacity
 * and stack depth are about a deck of credentials and belong to it. What moved
 * is only what any sticky section needs. The one signature that had to change
 * on the way is `scrollRangeHeight`, which took a card COUNT and now takes
 * travel in pixels, because a count is a certification-shaped input.
 *
 * The whole module is small on purpose. This is a set of primitives, not an
 * animation framework.
 */

export const clamp01 = (n: number): number =>
  n < 0 ? 0 : n > 1 ? 1 : Number.isFinite(n) ? n : 0;

/**
 * The primary industrial easing, as a function.
 *
 * `cubic-bezier(0.16, 1, 0.3, 1)` is the curve the design system already uses
 * for entrances (`--ease-entrance`), and the motion brief names it as the
 * primary. CSS applies it directly wherever a transition can; this is for the
 * places where a value is computed in JavaScript and handed to CSS already
 * eased, which is most of the scroll work.
 *
 * Solved by Newton on the x polynomial rather than approximated, because a
 * lookup table would be one more thing to be subtly wrong. Six iterations is
 * comfortably inside single-float precision for the whole 0..1 domain.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  return (x: number): number => {
    const target = clamp01(x);
    if (target === 0 || target === 1) return target;
    let t = target;
    for (let i = 0; i < 6; i++) {
      const slope = slopeX(t);
      if (slope === 0) break;
      t -= (sampleX(t) - target) / slope;
    }
    return sampleY(t < 0 ? 0 : t > 1 ? 1 : t);
  };
}

/** The motion system's primary curve. No overshoot, no bounce. */
export const easeEntrance = cubicBezier(0.16, 1, 0.3, 1);
/** The sanctioned secondary, for shorter state changes. */
export const easeNav = cubicBezier(0.22, 1, 0.36, 1);

/**
 * The outer range's height: the pinned stage, its sticky offset, and the travel.
 *
 * `stickyTop` is here for the reason the certification deck learned it: a
 * sticky box pinned at an offset releases that many pixels EARLIER than one
 * pinned at zero, and leaving it out of the range and the progress denominator
 * meant the deck never finished, short by exactly the height of the offset.
 * It has to appear in all three places or the bug comes back.
 */
export function stickyRangeHeight(
  stageHeight: number,
  travel: number,
  stickyTop = 0
): number {
  const stage = Math.max(0, Math.floor(stageHeight));
  const offset = Math.max(0, Math.floor(stickyTop));
  return stage + offset + Math.max(0, Math.floor(travel));
}

/**
 * Normalised 0..1 progress through a sticky range, from cached numbers.
 *
 * Takes numbers rather than elements deliberately: the caller measures once, on
 * resize, and this runs per frame against the cached values. Reading layout
 * here would put a forced reflow inside the scroll path.
 */
export function stickyProgress(
  scrollY: number,
  rangeTop: number,
  rangeHeight: number,
  stageHeight: number,
  stickyTop = 0
): number {
  const offset = Math.max(0, stickyTop);
  const travel = rangeHeight - stageHeight - offset;
  if (travel <= 0) return 0;
  return clamp01((scrollY + offset - rangeTop) / travel);
}

/**
 * Travel in pixels for a section with `steps` transitions, bounded at both ends.
 *
 * Bounded because travel that grows without limit turns a section into a
 * tunnel, and the page already carries two sticky sections. The caller supplies
 * the per-step distance in viewport heights; the floor keeps a single-step
 * section readable and the ceiling keeps a many-step one finite.
 */
export function stepTravel(
  steps: number,
  viewportHeight: number,
  perStep: number,
  minTravel: number,
  maxTravel: number
): number {
  const vh = Math.max(1, Math.floor(viewportHeight));
  const n = Math.max(0, Math.floor(steps));
  if (n === 0) return 0;
  const bounded = Math.min(maxTravel, Math.max(minTravel, n * perStep));
  return Math.round(bounded * vh);
}

/**
 * 0..1 as an element travels through the viewport, for sections that are not
 * pinned.
 *
 * 0 when its top edge reaches the bottom of the viewport, 1 when its bottom
 * edge reaches the top. The tracer in Intelligent Systems uses this: the brief
 * asks for the trace to advance as the page scrolls, and pinning that section
 * would make three pinned sections in a row and turn the page into a tunnel.
 *
 * `lead` and `tail` trim the ends, because the first and last slivers of an
 * element's travel are off the edge of the screen where nothing can be seen
 * happening. Trimming them means the whole trace runs while the section is
 * actually in view.
 */
export function viewportProgress(
  scrollY: number,
  elementTop: number,
  elementHeight: number,
  viewportHeight: number,
  lead = 0.15,
  tail = 0.2
): number {
  const span = elementHeight + viewportHeight;
  if (span <= 0) return 0;
  const raw = (scrollY + viewportHeight - elementTop) / span;
  const from = lead;
  const to = 1 - tail;
  if (to <= from) return clamp01(raw);
  return clamp01((raw - from) / (to - from));
}

/* --- Segmented progress --------------------------------------------------- */

export type Segment = {
  /** Which transition is in flight: 0 .. count - 2. */
  index: number;
  /** 0..1 within that transition, already eased. */
  local: number;
  /** 0..1 raw, before easing. Useful for thresholds. */
  raw: number;
};

/**
 * Split one section progress into `count - 1` consecutive transitions.
 *
 * The panel-stacking shape: with four panels there are three transitions, and
 * at any progress exactly one of them is in flight. The last segment is the one
 * that needs care, and the certification work is why: at p = 1 the naive
 * `floor(p * segments)` lands on segment `count - 1`, which does not exist, and
 * the final panel never reaches its final state. Clamping the index and
 * carrying `local` to 1 is what makes the last panel resolve exactly as the
 * section releases.
 */
export function segmentAt(
  progress: number,
  count: number,
  ease: (n: number) => number = easeEntrance
): Segment {
  const panels = Math.max(1, Math.floor(count));
  const segments = Math.max(1, panels - 1);
  const p = clamp01(progress);
  const scaled = p * segments;
  const index = Math.min(segments - 1, Math.floor(scaled));
  const raw = clamp01(scaled - index);
  return { index, local: ease(raw), raw };
}

/**
 * How far panel `i` has come forward, 0 (fully back) to 1 (dominant), given the
 * section's progress.
 *
 * Continuous, so a panel is never in two states at once and nothing snaps. A
 * panel behind the active one reads 1 and stays composed rather than
 * disappearing: this is a stack, and the cards underneath are still there.
 */
export function panelProgress(progress: number, index: number, count: number): number {
  const panels = Math.max(1, Math.floor(count));
  const segments = Math.max(1, panels - 1);
  const scaled = clamp01(progress) * segments;
  return clamp01(scaled - (index - 1));
}

/**
 * The active panel as an integer, with hysteresis.
 *
 * Threshold noise is a real problem when a value is driven by scroll: a
 * viewport that rests within a pixel of a boundary toggles a class every frame,
 * and the section flickers while nothing is moving. Switching forward at 0.55
 * and back at 0.45 costs nothing and makes the boundary stable.
 */
export function activePanel(
  progress: number,
  count: number,
  previous = 0,
  hysteresis = 0.05
): number {
  const panels = Math.max(1, Math.floor(count));
  if (panels === 1) return 0;
  const segments = panels - 1;
  const scaled = clamp01(progress) * segments;
  const index = Math.floor(scaled);
  const local = scaled - index;

  const forward = 0.5 + hysteresis;
  const backward = 0.5 - hysteresis;

  let next = local >= forward ? index + 1 : index;
  /* Coming back up the page, only fall to the previous panel once the local
     progress is clearly below the boundary rather than at it. */
  if (previous > next && local > backward) next = previous;

  return Math.min(panels - 1, Math.max(0, next));
}
