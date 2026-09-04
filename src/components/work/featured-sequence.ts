/**
 * The four operational layers the featured section walks through.
 *
 * These are PRESENTATION GROUPS and nothing else. Demo 01's module
 * architecture is `src/demos/operations/ui/modules.ts`, it groups the same
 * eleven modules as Customer operations / Operations / System, and it does not
 * change because a landing page wanted a narrative. Both groupings are true of
 * the same product: one is how the console's sidebar is organised, the other is
 * the order the work happens in.
 *
 * That distinction is the reason this file exists rather than the mapping being
 * inlined. D-099 records what happened the last time this section carried a
 * hand-typed copy of a module list: it disagreed with the picture directly
 * above it, and one page showed a visitor two architectures for one product.
 * So the module names here are checked against the product's own configuration
 * by `qa/stage09g-motion.mjs`, which fails if a module is missing, duplicated,
 * or invented.
 */

export type FeaturedStateId = "acquisition" | "rental" | "operations" | "intelligence";

export type FeaturedState = {
  id: FeaturedStateId;
  /** `01` .. `04`, rendered beside the label. */
  index: string;
  label: string;
  /** One line, present tense, describing what this layer of the system does. */
  note: string;
  /** Module names, exactly as the product spells them. */
  modules: string[];
};

/**
 * Overview is deliberately absent: it is the system-level context rather than a
 * layer of the work, and it stays lit throughout.
 */
export const FEATURED_STATES: readonly FeaturedState[] = [
  {
    id: "acquisition",
    index: "01",
    label: "ACQUISITION",
    note: "An enquiry becomes a customer, with the conversation attached.",
    modules: ["Leads", "Customers", "Inbox"],
  },
  {
    id: "rental",
    index: "02",
    label: "RENTAL",
    note: "A booking becomes a signed agreement and a vehicle out on hire.",
    modules: ["Reservations", "Contracts", "Fleet"],
  },
  {
    id: "operations",
    index: "03",
    label: "OPERATIONS",
    note: "The vehicle comes back, gets serviced, and the balance settles.",
    modules: ["Maintenance", "Payments"],
  },
  {
    id: "intelligence",
    index: "04",
    label: "INTELLIGENCE",
    note: "Rules watch the work and the figures follow from the records.",
    modules: ["Automations", "Reports"],
  },
] as const;

/** The context module, lit in every state. */
export const FEATURED_CONTEXT_MODULE = "Overview";

/**
 * Which state a module belongs to, for tagging the preview's rail.
 *
 * Built once from the states above, so the two cannot drift apart.
 */
export const MODULE_STATE: Readonly<Record<string, FeaturedStateId>> = Object.freeze(
  FEATURED_STATES.reduce<Record<string, FeaturedStateId>>((acc, state) => {
    for (const name of state.modules) acc[name] = state.id;
    return acc;
  }, {})
);

/**
 * Which preview elements each state emphasises.
 *
 * The preview is not rebuilt per state: the same composition stays on screen
 * and different parts of it come forward, because the point being made is that
 * this is ONE system seen at four depths rather than four unrelated pictures.
 *
 * The flow strip is the clearest case. Its four steps are already reservation,
 * contract, fleet, payment, so the states light them in the order the work
 * happens rather than needing anything new drawn.
 */
export type PreviewEmphasis = {
  /** Indices into the preview's FLOW array that this state lights. */
  flow: number[];
  /** Whether the fleet state cards come forward. */
  fleet: boolean;
  /** Whether the automation rule panel comes forward. */
  rule: boolean;
  /** Whether the payment status report comes forward. */
  report: boolean;
};

export const PREVIEW_EMPHASIS: Readonly<Record<FeaturedStateId, PreviewEmphasis>> =
  Object.freeze({
    acquisition: { flow: [0], fleet: false, rule: false, report: false },
    rental: { flow: [0, 1, 2], fleet: true, rule: false, report: false },
    operations: { flow: [2, 3], fleet: true, rule: false, report: true },
    intelligence: { flow: [0, 1, 2, 3], fleet: false, rule: true, report: true },
  });

export const FEATURED_STATE_COUNT = FEATURED_STATES.length;
