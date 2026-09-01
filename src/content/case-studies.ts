/**
 * Stage 09 — Selected Engineering Case Studies.
 *
 * Case studies describe real work. This module is therefore built around one
 * rule: nothing reaches the page unless it has been verified.
 *
 * Every entry carries a `status`. Only `"verified"` entries are publishable,
 * and `publishableCaseStudies()` is the single accessor the renderer may use.
 * A `"draft"` entry is a slot waiting for confirmed facts — it exists so the
 * shape of the missing information is explicit, not so it can be filled in
 * with something plausible.
 *
 * The three entries below are deliberately empty. As of this writing the
 * repository contains no record of any client engagement, so there is nothing
 * truthful to put in them; see `docs/CASE_STUDY_SOURCE_AUDIT.md`. Do not
 * populate them from the Stage 06-08 demonstration data, which is synthetic
 * and says so in its own source, and do not infer facts that were not given.
 */

export type CaseStatus = "verified" | "draft";

/** Node kinds a case architecture may contain. Only real systems belong here. */
export type CaseNodeKind =
  | "client"
  | "service"
  | "data"
  | "external"
  | "worker";

export type CaseNode = {
  id: string;
  label: string;
  /** Mono code shown inside the node. */
  code: string;
  kind: CaseNodeKind;
  /** Percent coordinates within the diagram box. */
  x: number;
  y: number;
  /** One sentence revealed on hover or focus. Optional. */
  note?: string;
};

export type CaseConnection = {
  from: string;
  to: string;
  /** A dashed line for an asynchronous or optional path. */
  async?: boolean;
};

export type CaseDecision = {
  index: string;
  title: string;
  reason: string;
  /** The cost that was accepted. At least one decision per case should have one. */
  tradeOff?: string;
};

export type CaseMetric = {
  label: string;
  value: string;
  /** An unverified metric must never render. See publishableMetrics(). */
  verified: boolean;
  /**
   * Where the figure came from. Repository-only: this is never rendered and
   * must never contain a client name, a private URL or a credential.
   */
  sourceNote?: string;
};

export type CaseStudy = {
  id: string;
  status: CaseStatus;
  /** Anonymous project label unless naming has been explicitly approved. */
  title: string;
  category: string;
  /** Accent family. All remain Milky Intelligence; this is a tint, not a theme. */
  accent: "sky" | "mint" | "peach";
  summary: string;
  problem: string[];
  scope: string;
  solution: string;
  challenge: { title: string; body: string };
  decisions: CaseDecision[];
  architecture: {
    /** One sentence read by assistive technology in place of the diagram. */
    summary: string;
    nodes: CaseNode[];
    connections: CaseConnection[];
  };
  technologies: string[];
  result: string[];
  metrics?: CaseMetric[];
  /** Repository-only provenance for the case as a whole. Never rendered. */
  verificationSource?: string;
};

/**
 * Three empty slots, all draft.
 *
 * They are intentionally not "plausible placeholders": inventing a problem
 * statement here is exactly the failure this file exists to prevent, and a
 * half-written case study is far more likely to be published by accident than
 * an obviously empty one.
 */
export const CASE_STUDIES: CaseStudy[] = [
  {
    id: "case-01",
    status: "draft",
    title: "",
    category: "",
    accent: "sky",
    summary: "",
    problem: [],
    scope: "",
    solution: "",
    challenge: { title: "", body: "" },
    decisions: [],
    architecture: { summary: "", nodes: [], connections: [] },
    technologies: [],
    result: [],
  },
  {
    id: "case-02",
    status: "draft",
    title: "",
    category: "",
    accent: "mint",
    summary: "",
    problem: [],
    scope: "",
    solution: "",
    challenge: { title: "", body: "" },
    decisions: [],
    architecture: { summary: "", nodes: [], connections: [] },
    technologies: [],
    result: [],
  },
  {
    id: "case-03",
    status: "draft",
    title: "",
    category: "",
    accent: "peach",
    summary: "",
    problem: [],
    scope: "",
    solution: "",
    challenge: { title: "", body: "" },
    decisions: [],
    architecture: { summary: "", nodes: [], connections: [] },
    technologies: [],
    result: [],
  },
];

/**
 * The only accessor the renderer may use.
 *
 * A draft is filtered out on status, and then again on completeness: a case
 * marked verified by mistake but missing the facts a case study needs is still
 * not publishable. Both gates have to pass.
 */
export function publishableCaseStudies(all: CaseStudy[] = CASE_STUDIES): CaseStudy[] {
  return all.filter((c) => c.status === "verified" && isComplete(c));
}

/** The minimum a public case study must carry. Metrics are deliberately not required. */
export function isComplete(c: CaseStudy): boolean {
  return (
    c.title.trim().length > 0 &&
    c.category.trim().length > 0 &&
    c.summary.trim().length > 0 &&
    c.scope.trim().length > 0 &&
    c.solution.trim().length > 0 &&
    c.problem.length > 0 &&
    c.challenge.title.trim().length > 0 &&
    c.challenge.body.trim().length > 0 &&
    c.decisions.length > 0 &&
    c.architecture.summary.trim().length > 0 &&
    c.architecture.nodes.length > 0 &&
    c.technologies.length > 0 &&
    c.result.length > 0
  );
}

/** Unverified metrics never render, whatever the case's own status says. */
export function publishableMetrics(c: CaseStudy): CaseMetric[] {
  return (c.metrics ?? []).filter((m) => m.verified).slice(0, 3);
}

/** True when the section has enough verified content to replace the placeholder. */
export const MINIMUM_PUBLIC_CASES = 3;

export function sectionIsPublishable(all: CaseStudy[] = CASE_STUDIES): boolean {
  return publishableCaseStudies(all).length >= MINIMUM_PUBLIC_CASES;
}
