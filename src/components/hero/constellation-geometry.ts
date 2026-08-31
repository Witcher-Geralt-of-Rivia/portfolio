/**
 * Geometry for the Intelligence Constellation.
 *
 * Everything here is computed once, at module scope, in a server component —
 * so the browser receives finished path strings and runs no layout maths.
 *
 * Two rules drive the routing:
 *   1. Connections terminate at node *edges*, never at node centres, so a
 *      line can never run underneath a label (spec 96).
 *   2. Links between outer nodes bow away from the centre, so the middle of
 *      the artboard stays legible instead of filling with crossings.
 */

export const ARTBOARD = 640;
export const CENTRE = { x: 322, y: 313 };
export const CENTRE_RADIUS = 56;

export type ConstellationNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  /** Chip width in artboard units; height is uniform. */
  w: number;
  dot: string;
};

export const NODE_HEIGHT = 46;

/** The eight principal capabilities. Positions are fixed by the spec. */
export const NODES: ConstellationNode[] = [
  { id: "agents", label: "Agents", x: 178, y: 118, w: 92, dot: "#e9e0ff" },
  { id: "automation", label: "Automation", x: 431, y: 102, w: 112, dot: "#dceeff" },
  { id: "crm", label: "CRM / ERP", x: 523, y: 228, w: 106, dot: "#f9dfeb" },
  { id: "api", label: "API", x: 531, y: 406, w: 88, dot: "#d9f4f3" },
  { id: "data", label: "Data", x: 400, y: 519, w: 88, dot: "#ddf5e8" },
  { id: "learning", label: "Learning", x: 207, y: 523, w: 100, dot: "#f8efc9" },
  { id: "mobile", label: "Mobile", x: 97, y: 397, w: 92, dot: "#fbe4d7" },
  { id: "web", label: "Web", x: 103, y: 232, w: 88, dot: "#dceeff" },
];

const byId = new Map(NODES.map((n) => [n.id, n]));

type Point = { x: number; y: number };

/** Where a ray leaving `node` toward `towards` crosses the chip's edge. */
function edgeOfNode(node: ConstellationNode, towards: Point, gap = 5): Point {
  const dx = towards.x - node.x;
  const dy = towards.y - node.y;
  const len = Math.hypot(dx, dy) || 1;
  const tx = Math.abs(dx) > 0.001 ? node.w / 2 / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 0.001 ? NODE_HEIGHT / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty) + gap / len;
  return { x: node.x + dx * t, y: node.y + dy * t };
}

/** Where a ray leaving the central node toward `towards` crosses its rim. */
function edgeOfCentre(towards: Point, gap = 7): Point {
  const dx = towards.x - CENTRE.x;
  const dy = towards.y - CENTRE.y;
  const len = Math.hypot(dx, dy) || 1;
  const t = (CENTRE_RADIUS + gap) / len;
  return { x: CENTRE.x + dx * t, y: CENTRE.y + dy * t };
}

/** Sample a cubic and return how close it passes to the centre. */
function minDistanceToCentre(a: Point, c1: Point, c2: Point, b: Point): number {
  let min = Infinity;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const u = 1 - t;
    const x =
      u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x;
    const y =
      u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y;
    min = Math.min(min, Math.hypot(x - CENTRE.x, y - CENTRE.y));
  }
  return min;
}

function controls(a: Point, b: Point, bend: number, side: 1 | -1) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * side;
  const py = (dx / len) * side;
  const off = len * bend;
  return {
    c1: { x: a.x + dx * 0.3 + px * off, y: a.y + dy * 0.3 + py * off },
    c2: { x: a.x + dx * 0.7 + px * off, y: a.y + dy * 0.7 + py * off },
  };
}

const r1 = (v: number) => Math.round(v * 10) / 10;

function toPath(a: Point, c1: Point, c2: Point, b: Point): string {
  return `M ${r1(a.x)} ${r1(a.y)} C ${r1(c1.x)} ${r1(c1.y)}, ${r1(c2.x)} ${r1(c2.y)}, ${r1(b.x)} ${r1(b.y)}`;
}

/** A cubic bow on an explicit side. */
function curve(a: Point, b: Point, bend: number, side: 1 | -1 = 1): string {
  const { c1, c2 } = controls(a, b, bend, side);
  return toPath(a, c1, c2, b);
}

/**
 * Cross-system routing.
 *
 * These are the paths that decide whether the artwork reads as a network or
 * as a wireframe sphere. Bowing them all outward produced meridian lines and
 * an orb, so each one instead takes the side that keeps it *inside* the
 * composition while still clearing the orchestrator, and each gets its own
 * bend so no two arcs are parallel.
 */
const CORE_CLEARANCE = 82;

function crossCurve(a: Point, b: Point, bend: number): string {
  const options: (1 | -1)[] = [1, -1];
  let best: { side: 1 | -1; dist: number } | null = null;

  for (const side of options) {
    const { c1, c2 } = controls(a, b, bend, side);
    const dist = minDistanceToCentre(a, c1, c2, b);
    // Prefer the tighter interior route among those that clear the core.
    if (dist >= CORE_CLEARANCE && (!best || dist < best.dist)) {
      best = { side, dist };
    }
  }

  if (!best) {
    // Neither side clears it: take whichever gets furthest away.
    for (const side of options) {
      const { c1, c2 } = controls(a, b, bend, side);
      const dist = minDistanceToCentre(a, c1, c2, b);
      if (!best || dist > best.dist) best = { side, dist };
    }
  }

  return curve(a, b, bend, best!.side);
}

export type Link = {
  id: string;
  d: string;
  kind: "primary" | "secondary" | "cross";
  /** Set on primary links so hover can raise the matching spoke. */
  node?: string;
};

/* --- Central spokes ------------------------------------------------------ */
const PRIMARY: Link[] = NODES.map((node, i) => {
  const from = edgeOfCentre(node);
  const to = edgeOfNode(node, CENTRE);
  return {
    id: `primary-${node.id}`,
    node: node.id,
    kind: "primary" as const,
    // Alternating gentle bow keeps the eight spokes from reading as a star.
    d: curve(from, to, 0.06, i % 2 === 0 ? 1 : -1),
  };
});

/* --- Ring between neighbours --------------------------------------------- */
const RING: [string, string][] = [
  ["agents", "automation"],
  ["automation", "crm"],
  ["crm", "api"],
  ["api", "data"],
  ["data", "learning"],
  ["learning", "mobile"],
  ["mobile", "web"],
  ["web", "agents"],
];

/* Flat chords on alternating sides. A uniform outward bow on all eight
   drew a circle around the composition; alternating breaks that outline. */
const RING_BENDS = [0.05, 0.03, 0.06, 0.035, 0.055, 0.03, 0.05, 0.04];

const SECONDARY: Link[] = RING.map(([a, b], i) => {
  const na = byId.get(a)!;
  const nb = byId.get(b)!;
  return {
    id: `ring-${a}-${b}`,
    kind: "secondary" as const,
    d: curve(
      edgeOfNode(na, nb),
      edgeOfNode(nb, na),
      RING_BENDS[i],
      i % 2 === 0 ? 1 : -1
    ),
  };
});

/* --- Cross-system paths --------------------------------------------------- */
const CROSS_PAIRS: [string, string][] = [
  ["agents", "api"],
  ["automation", "data"],
  ["learning", "agents"],
  ["mobile", "api"],
  ["web", "data"],
];

/* Distinct bends so the five interior arcs never run parallel. */
const CROSS_BENDS = [0.13, 0.09, 0.16, 0.11, 0.14];

const CROSS: Link[] = CROSS_PAIRS.map(([a, b], i) => {
  const na = byId.get(a)!;
  const nb = byId.get(b)!;
  return {
    id: `cross-${a}-${b}`,
    kind: "cross" as const,
    d: crossCurve(edgeOfNode(na, nb), edgeOfNode(nb, na), CROSS_BENDS[i]),
  };
});

export const LINKS: Link[] = [...PRIMARY, ...SECONDARY, ...CROSS];

/** Signal routes, by link id. Kept to five so the network reads as calm. */
export const SIGNALS = [
  { id: "sig-agents", link: "primary-agents", dur: "5.5s", delay: "0s", fill: "#e9e0ff", reverse: true },
  { id: "sig-api", link: "primary-api", dur: "6.5s", delay: "-2.1s", fill: "#d9f4f3", reverse: false },
  { id: "sig-data", link: "cross-automation-data", dur: "8s", delay: "-4.3s", fill: "#ddf5e8", reverse: false },
  { id: "sig-learning", link: "primary-learning", dur: "7s", delay: "-1.2s", fill: "#dceeff", reverse: false },
  { id: "sig-web", link: "primary-web", dur: "6s", delay: "-3.4s", fill: "#e9e0ff", reverse: true },
];

/** The three links that carry a travelling dash. */
export const FLOW_LINKS = ["primary-automation", "ring-crm-api", "cross-web-data"];

/** Small unlabelled relays. The last three are dropped on narrow screens. */
export const AUX_NODES = [
  { x: 268, y: 176, r: 3.2 },
  { x: 470, y: 316, r: 2.8 },
  { x: 300, y: 448, r: 3 },
  { x: 156, y: 318, r: 2.6 },
  { x: 396, y: 214, r: 2.4 },
  { x: 240, y: 400, r: 2.6 },
];
