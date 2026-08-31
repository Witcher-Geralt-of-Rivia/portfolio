import type { ArchConnection, ArchNode, ArchitectureMode } from "./architecture-data";

/**
 * Connection routing for the architecture canvas.
 *
 * The canvas holds a fixed 1000 x 560 viewBox and a matching CSS aspect ratio,
 * so the SVG never distorts and a 1px stroke stays a 1px stroke.
 *
 * Routing is soft-orthogonal: straight runs with small rounded turns, which
 * reads as architecture rather than as the organic curves of the hero
 * constellation. Where several links converge on one node they are given
 * separate horizontal corridors, so a fan-in reads as a routing bundle instead
 * of a single overdrawn line.
 */

export const VB_W = 1000;
export const VB_H = 520;

/** Canvas pixel-to-unit scale at the desktop canvas width. */
const UNIT = 1.18;
const NODE_H = 56;
const HALF_H = (NODE_H / 2) * UNIT;
const GAP = 7;
const R = 13;

const px = (xPercent: number) => (xPercent / 100) * VB_W;
const py = (yPercent: number) => (yPercent / 100) * VB_H;
const halfW = (n: ArchNode) => (n.w / 2) * UNIT;

const r1 = (v: number) => Math.round(v * 10) / 10;

export type RoutedConnection = {
  id: string;
  d: string;
  from: string;
  to: string;
};

/**
 * Spread converging or diverging links across distinct corridors. A single
 * link runs down the middle; a group of n fans out between 0.34 and 0.66 of
 * the vertical span.
 */
function corridorFor(
  connection: ArchConnection,
  connections: ArchConnection[]
): number {
  const [from, to] = connection;
  const sameSource = connections.filter((c) => c[0] === from);
  const group = sameSource.length > 1
    ? sameSource
    : connections.filter((c) => c[1] === to);

  if (group.length < 2) return 0.5;
  const index = group.findIndex((c) => c[0] === from && c[1] === to);
  return 0.34 + (index / (group.length - 1)) * 0.32;
}

export function routeConnections(mode: ArchitectureMode): RoutedConnection[] {
  const byId = new Map(mode.nodes.map((n) => [n.id, n]));

  return mode.connections.map(([from, to]) => {
    const a = byId.get(from)!;
    const b = byId.get(to)!;
    const id = `${from}--${to}`;

    // Same band: a straight horizontal run between facing edges.
    if (a.band === b.band) {
      const y = py(a.y);
      const x1 = px(a.x) + halfW(a) + GAP;
      const x2 = px(b.x) - halfW(b) - GAP;
      return { id, from, to, d: `M ${r1(x1)} ${r1(y)} H ${r1(x2)}` };
    }

    // Across bands: drop, turn, run across, turn, drop in.
    const ax = px(a.x);
    const bx = px(b.x);
    const ay = py(a.y) + HALF_H + GAP;
    const by = py(b.y) - HALF_H - GAP;

    if (Math.abs(ax - bx) < 3) {
      return { id, from, to, d: `M ${r1(ax)} ${r1(ay)} V ${r1(by)}` };
    }

    const midY = ay + (by - ay) * corridorFor([from, to], mode.connections);
    const dir = bx > ax ? 1 : -1;

    const d = [
      `M ${r1(ax)} ${r1(ay)}`,
      `V ${r1(midY - R)}`,
      `Q ${r1(ax)} ${r1(midY)} ${r1(ax + dir * R)} ${r1(midY)}`,
      `H ${r1(bx - dir * R)}`,
      `Q ${r1(bx)} ${r1(midY)} ${r1(bx)} ${r1(midY + R)}`,
      `V ${r1(by)}`,
    ].join(" ");

    return { id, from, to, d };
  });
}
