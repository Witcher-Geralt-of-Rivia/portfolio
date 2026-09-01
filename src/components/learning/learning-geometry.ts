import type { LearningScenario, MapLink, MapNode } from "./learning-scenarios";

/**
 * Link geometry for the knowledge map, resolved once at module scope so it is
 * evaluated during the build and the browser only ever receives finished path
 * strings — the same rule as `constellation-geometry.ts` (Stage 04) and
 * `architecture-geometry.ts` (Stage 05).
 */

export const MAP_VIEWBOX = { w: 520, h: 340 } as const;

const CX = MAP_VIEWBOX.w / 2;
const CY = MAP_VIEWBOX.h / 2;

export type ResolvedLink = {
  key: string;
  from: string;
  to: string;
  kind: MapLink["kind"];
  /** Quadratic bezier from edge to edge, bowed away from the canvas centre. */
  d: string;
};

/**
 * Edge-to-edge quadratic curve.
 *
 * Straight lines between fifteen nodes read as a circuit diagram; Stage 07 is
 * meant to read as knowledge, so every connection carries a slight bow. The
 * bow is pushed AWAY from the canvas centre: bowing uniformly, or toward the
 * centre, drags arcs across the middle of the map where the labels live.
 */
function curve(a: MapNode, b: MapNode): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Stop short of each circle so the stroke meets the node cleanly.
  const x1 = a.x + ux * (a.r + 3);
  const y1 = a.y + uy * (a.r + 3);
  const x2 = b.x - ux * (b.r + 3);
  const y2 = b.y - uy * (b.r + 3);

  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  // Perpendicular, signed so the bow moves outward from the canvas centre.
  const px = -uy;
  const py = ux;
  const outward = Math.sign((mx - CX) * px + (my - CY) * py) || 1;
  const bow = Math.min(len * 0.11, 26) * outward;

  const qx = mx + px * bow;
  const qy = my + py * bow;

  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${qx.toFixed(1)} ${qy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function resolveLinks(scenario: LearningScenario): ResolvedLink[] {
  const byId = new Map(scenario.nodes.map((n) => [n.id, n]));
  return scenario.links.map((link) => {
    const a = byId.get(link.from);
    const b = byId.get(link.to);
    if (!a || !b) {
      throw new Error(
        `learning-geometry: scenario "${scenario.id}" links unknown node "${!a ? link.from : link.to}".`
      );
    }
    return { key: `${link.from}-${link.to}`, from: link.from, to: link.to, kind: link.kind, d: curve(a, b) };
  });
}

/** Scenario id -> resolved links. Built once, at build time. */
export const LINK_GEOMETRY: Record<string, ResolvedLink[]> = {};

export function registerGeometry(scenarios: LearningScenario[]) {
  for (const scenario of scenarios) {
    LINK_GEOMETRY[scenario.id] = resolveLinks(scenario);
  }
  return LINK_GEOMETRY;
}

/**
 * True when a link joins two nodes that are consecutive in the highlighted
 * route, so the adaptive path can be emphasised without a second data source.
 */
export function isOnRoute(link: ResolvedLink, route: string[]): boolean {
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    if ((link.from === a && link.to === b) || (link.from === b && link.to === a)) return true;
  }
  return false;
}
