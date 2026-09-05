/**
 * How each section enters, as data rather than as constants scattered through
 * six components.
 *
 * The direction is that crossing a section boundary should feel like entering a
 * different environment: a different colour field, a different way in, a
 * different behaviour. That only works if the sections are actually different
 * from each other, which is easy to lose track of when each one is tuned in its
 * own file. Here they can be read side by side and the repetition is obvious.
 *
 * Each scene owns:
 *
 *   enter      the spatial behaviour it arrives with, and its magnitude
 *   accent     the hue its atmosphere is built around
 *   field      whether it carries a live colour field, and of what kind
 *   border     whether its focal surface gets a spectral edge
 *
 * No two neighbours share an entry direction. That constraint is the whole
 * point and is asserted in `qa/stage09h-scenes.mjs`, because the failure mode
 * here is not a bug: it is six sections quietly converging on the same fade.
 */

export type SceneId = "hero" | "systems" | "products" | "learning" | "lab" | "work";

/**
 * The spatial behaviour a scene arrives with.
 *
 * `rise` and `descend` are vertical, `sweep` is lateral, `bloom` expands from a
 * clipped field, `settle` descends with a small controlled overshoot. None of
 * them is a plain fade, and opacity is only ever a supporting part of the
 * movement rather than the movement itself.
 */
export type SceneEnter = "rise" | "sweep" | "bloom" | "settle" | "expand" | "none";

export type Scene = {
  id: SceneId;
  enter: SceneEnter;
  /**
   * How far the scene travels on entry, in viewport units. Read into CSS as
   * `--scene-travel`; the axis depends on `enter`.
   */
  travel: string;
  /** Scale at the start of the entry. 1 means the scene does not scale. */
  scaleFrom: number;
  /** Opacity at the start. Never 0: a scene that starts invisible is a fade. */
  opacityFrom: number;
  /** The hue the scene's atmosphere is built around. */
  accent: string;
  /** A second hue, for the far side of the field. */
  accentAlt: string;
  /** A live colour field, and whether it answers the pointer. */
  field: "none" | "drift" | "liquid";
  /** A spectral edge on this scene's focal surface. */
  border: boolean;
};

/**
 * Colours come from the scene palette in `tokens.css`, which is a stronger
 * relative of the aurora family: the same hues at a saturation that actually
 * registers. The aurora palette itself is left alone, because it paints the
 * page's permanent background and its own comment says not to intensify it.
 */
export const SCENES: readonly Scene[] = [
  {
    /* The hero already owns the most artwork on the page, so its scene is
       atmosphere rather than entry: it is the first thing painted and has
       nothing to arrive from. */
    id: "hero",
    enter: "none",
    travel: "0",
    scaleFrom: 1,
    opacityFrom: 1,
    accent: "var(--scene-violet)",
    accentAlt: "var(--scene-blue)",
    field: "liquid",
    border: false,
  },
  {
    /* Rises. The architecture comes up from below as the colour plane does,
       which is the one moment on the page where the background and the
       foreground travel together. */
    id: "systems",
    enter: "rise",
    travel: "16vh",
    scaleFrom: 0.97,
    opacityFrom: 0.2,
    accent: "var(--scene-blue)",
    accentAlt: "var(--scene-cyan)",
    field: "liquid",
    border: false,
  },
  {
    /* Sweeps in laterally, which is the clearest possible break from the
       section above it. The studio is the page's widest surface and arriving
       sideways is what makes the width register. */
    id: "products",
    enter: "sweep",
    travel: "14vw",
    scaleFrom: 0.94,
    opacityFrom: 0.18,
    accent: "var(--scene-mint)",
    accentAlt: "var(--scene-lemon)",
    field: "drift",
    border: true,
  },
  {
    /* Blooms open from a clipped field. Radial rather than linear, so the
       section reads as opening rather than as sliding, and deliberately not
       the direction the products section used. */
    id: "learning",
    enter: "bloom",
    travel: "0",
    scaleFrom: 0.96,
    opacityFrom: 0.22,
    accent: "var(--scene-rose)",
    accentAlt: "var(--scene-violet)",
    field: "drift",
    border: false,
  },
  {
    /* Descends from above with a small overshoot, then locks. Mechanical
       rather than springy: the lab is the page's instrument panel and it should
       arrive like one being seated.

       It carries a WARM field, and that is the point. The lab is the last thing
       before the page's climax, and the handover into Work is meant to be the
       strongest change on the page. With no field here that boundary was white
       meeting white: the weakest crossing of the six, in the one place it had
       to be the strongest. Warm peach and lemon giving way to Work's violet and
       cyan is a full-viewport change of temperature, which is what the
       transition into the finished product is supposed to feel like. */
    id: "lab",
    enter: "settle",
    travel: "12vh",
    scaleFrom: 1,
    opacityFrom: 0.25,
    accent: "var(--scene-peach)",
    accentAlt: "var(--scene-lemon)",
    field: "drift",
    border: false,
  },
  {
    /* Expands into place. The climax, and the only scene that both expands and
       carries a spectral edge, because it is the one the whole page is built
       toward. */
    id: "work",
    enter: "expand",
    travel: "8vh",
    scaleFrom: 0.93,
    opacityFrom: 0.15,
    accent: "var(--scene-violet)",
    accentAlt: "var(--scene-cyan)",
    field: "liquid",
    border: true,
  },
] as const;

export const SCENE_BY_ID: Readonly<Record<SceneId, Scene>> = Object.freeze(
  SCENES.reduce<Record<SceneId, Scene>>((acc, scene) => {
    acc[scene.id] = scene;
    return acc;
  }, {} as Record<SceneId, Scene>)
);

/**
 * The overshoot the `settle` entry uses, as a fraction of its travel.
 *
 * Small and fast on purpose. A scene that visibly bounces reads as a toy; one
 * that goes a little past and comes back reads as something being seated. The
 * brief allows a deliberate overshoot and forbids elastic, and this is where
 * that line sits.
 */
export const SETTLE_OVERSHOOT = 0.08;

/**
 * Where in a scene's approach the entry finishes.
 *
 * Below 1 so the scene is fully arrived and still while the visitor is looking
 * at it, rather than completing exactly as it leaves. The certification deck
 * and the systems tracer both had to learn this the same way.
 */
export const ENTER_COMPLETE_AT = 0.62;
