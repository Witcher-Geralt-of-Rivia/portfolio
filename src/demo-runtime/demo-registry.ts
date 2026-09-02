/**
 * Demo runtime: the demo registry.
 *
 * One place that knows which demonstrations exist, where they live and how
 * finished they are. The eventual Work launcher reads this rather than
 * carrying its own list, so a demo cannot be advertised on the homepage
 * before it exists.
 *
 * The routes here are internal portfolio identities, not product brand names.
 * Whatever fictional company name a demo eventually carries inside its own
 * interface, its address stays `/demos/operations`.
 */

import type { DemoId } from "./types";

/**
 * How complete a demo is.
 *
 * Only `verified` may be shown in the Work section. `building` exists so a
 * demo under construction can be reachable during development without
 * becoming publishable by accident: the same guard the case-study framework
 * uses, for the same reason.
 */
export type DemoStatus = "planned" | "building" | "verified";

export type DemoDefinition = {
  id: DemoId;
  route: `/demos/${string}`;
  status: DemoStatus;
  /** Which capability family the demo demonstrates. */
  capabilityArea: string;
  /** Shown on the demo itself. Never weakened, never removed. */
  disclosure: string;
};

/**
 * Canonical public disclosure.
 *
 * Every demo carries this, visibly. The demos are synthetic engineering
 * demonstrations running entirely in the browser; presenting one as client
 * work, a live customer system or real operational data would be false. The
 * exact casing may be refined later. The meaning may not.
 */
export const DEMO_DISCLOSURE_PRIMARY = "INTERACTIVE ENGINEERING DEMO";
export const DEMO_DISCLOSURE_SECONDARY = "SYNTHETIC DATA · FRONTEND ONLY";

export const DEMOS: readonly DemoDefinition[] = [
  {
    id: "operations",
    route: "/demos/operations",
    /* Stage 09C1 built the domain, seed and services. The product has no
       route yet, so it is under construction rather than publishable. */
    status: "building",
    capabilityArea: "Operations / CRM / ERP SaaS",
    disclosure: DEMO_DISCLOSURE_PRIMARY,
  },
  {
    id: "field",
    route: "/demos/field",
    status: "planned",
    capabilityArea: "Field Operations Web + Mobile",
    disclosure: DEMO_DISCLOSURE_PRIMARY,
  },
  {
    id: "learning",
    route: "/demos/learning",
    status: "planned",
    capabilityArea: "Adaptive Learning Platform",
    disclosure: DEMO_DISCLOSURE_PRIMARY,
  },
];

export function findDemo(id: string): DemoDefinition | undefined {
  return DEMOS.find((d) => d.id === id);
}

/** The demos the Work section is allowed to link to. */
export function publishableDemos(all: readonly DemoDefinition[] = DEMOS): DemoDefinition[] {
  return all.filter((d) => d.status === "verified");
}

/**
 * Stage 09 completes only when all three demos are verified and `#work` has
 * been integrated. A partially finished launcher would advertise applications
 * that are not there.
 */
export const REQUIRED_VERIFIED_DEMOS = DEMOS.length;

export function workSectionIsPublishable(all: readonly DemoDefinition[] = DEMOS): boolean {
  return publishableDemos(all).length >= REQUIRED_VERIFIED_DEMOS;
}
