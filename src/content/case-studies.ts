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
  /**
   * Shown on the case itself, not in a caption. An internal project must say
   * so on the surface so it can never be mistaken for delivered client work.
   */
  disclosure: string;
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
    c.disclosure.trim().length > 0 &&
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

/* =====================================================================
   CASE 01 — Internal Production Delivery System

   This is the portfolio's own deployment system, not client work, and it
   says so on the surface. Every fact below is reproducible from this
   repository: docs/CHANGELOG.md, docs/DECISIONS.md D-030 to D-032,
   docs/QA_BASELINE.md and deploy/safe-deploy.ps1.

   The measurements are request counts from a continuity monitor, published
   as test evidence. They are deliberately not restated as percentages: a
   "100% reliable" claim would be a marketing conversion of a bounded
   observation.
   ===================================================================== */
const CASE_01: CaseStudy = {
  id: "case-01",
  status: "verified",
  title: "Internal Production Delivery System",
  disclosure: "INTERNAL ENGINEERING CASE STUDY",
  category: "NEXT.JS / WINDOWS / PM2 / RELEASE ENGINEERING",
  accent: "sky",
  summary:
    "The system that deploys this portfolio. Production originally served straight out of the same directory a build writes into, so shipping a change could break the live site while it was being read. It now runs from one of two alternating release slots, and a deployment becomes live only after the new release has been built elsewhere, started, and proven able to serve its own assets.",
  problem: [
    "The production process served directly from the same .next directory that next build writes into, so a build replaced files while the live process was still reading them.",
    "This broke the public site during two Stage 05 deployments: the page loaded but its CSS and JS chunks had been rewritten underneath it.",
    "The application had to coexist with another production application and an existing Caddy reverse proxy on the same Windows Server without disturbing either one.",
  ],
  scope:
    "In scope: separating production artifacts from development output, repeatable deployment, validation before switching, automatic rollback, retaining the previous release, keeping the portfolio bound to loopback, and keeping tooling secrets out of the long-lived PM2 environment. Out of scope: Caddy routing, TLS management, replacing PM2, containerisation, clustering, and the other hosted application.",
  solution:
    "Production alternates between two release directories, .next-release-a and .next-release-b. The live process always serves one while the next build is written into the other. A deployment validates the source, builds the inactive slot, starts it on a temporary loopback smoke port, checks the page and its critical assets, switches PM2 only once that passes, verifies the public HTTPS endpoint, and restores the previous slot automatically if the switch fails. The default .next directory stays development output and is never served by production.",
  challenge: {
    title: "A build could rewrite the files the live process was serving",
    body:
      "The deployment model allowed an ordinary next build to modify the runtime artifacts production was actively reading; nothing distinguished the directory being compiled into from the directory being served from, because they were the same one. The fix had to be structural rather than procedural - the failure came from running an ordinary, correct-looking command, so documentation alone would not have prevented a repeat.",
  },
  decisions: [
    {
      index: "01",
      title: "Separate active and inactive production release directories",
      reason:
        "Building into an inactive directory means compilation and asset generation cannot modify the files currently being served to users.",
      tradeOff:
        "The deployment process becomes more complex and two release directories are retained, in exchange for isolating the build phase from production.",
    },
    {
      index: "02",
      title: "Keep .next as development output and forbid PM2 from serving it",
      reason:
        "A second safety boundary: even an accidental ordinary npm run build writes only .next, and cannot damage the production release.",
      tradeOff:
        "Production requires an explicit release-directory environment variable rather than relying on the Next.js default.",
    },
    {
      index: "03",
      title: "Smoke-test the new release before switching production",
      reason:
        "A successful build does not prove that the generated application can actually start and serve its critical assets.",
      tradeOff:
        "Deployment takes longer, because a temporary production server has to start and be tested before the switch.",
    },
    {
      index: "04",
      title: "Retain the previous release and roll back on a failed health check",
      reason:
        "A failed release must not leave recovery dependent on a manual rebuild.",
      tradeOff:
        "The previous build consumes additional disk space, and the deployment logic has to track which slot is active.",
    },
  ],
  architecture: {
    summary:
      "Deployment pipeline: the source repository passes a validation stage, is built into the inactive release slot, and is started on a temporary loopback smoke server. Only after that check does PM2 switch to the new active release slot, which reaches the public HTTPS endpoint through the existing Caddy reverse proxy. The previous release slot is retained, and PM2 is returned to it automatically if the public health check fails.",
    nodes: [
      { id: "repo", label: "Source repo", code: "SRC", kind: "client", x: 12, y: 15,
        note: "A deployment aborts before anything else if the working tree is dirty." },
      { id: "validate", label: "Validation", code: "QA", kind: "service", x: 37, y: 15,
        note: "Documentation consistency, TypeScript and ESLint. Any failure aborts." },
      { id: "inactive", label: "Inactive slot", code: "BUILD", kind: "data", x: 63, y: 15,
        note: "The build target, and never the directory production is reading." },
      { id: "smoke", label: "Smoke server", code: "LOOPBACK", kind: "service", x: 88, y: 15,
        note: "The new release, started on a loopback port and asked for its own assets." },
      { id: "pm2", label: "PM2", code: "PROC", kind: "worker", x: 88, y: 51,
        note: "Switched to the new slot only after the smoke test passes." },
      { id: "active", label: "Active slot", code: "LIVE", kind: "data", x: 63, y: 51,
        note: "The release production is serving. Untouched by any build." },
      { id: "caddy", label: "Caddy", code: "PROXY", kind: "external", x: 37, y: 51,
        note: "Shared with another application, and never reloaded by a deployment." },
      { id: "public", label: "Public HTTPS", code: "443", kind: "client", x: 12, y: 51,
        note: "Checked after the switch; a failure here triggers rollback." },
      { id: "previous", label: "Previous slot", code: "ROLLBACK", kind: "data", x: 63, y: 87,
        note: "Retained so that recovery never depends on a rebuild." },
    ],
    connections: [
      { from: "repo", to: "validate" },
      { from: "validate", to: "inactive" },
      { from: "inactive", to: "smoke" },
      { from: "smoke", to: "pm2" },
      { from: "pm2", to: "active" },
      { from: "active", to: "caddy" },
      { from: "caddy", to: "public" },
      { from: "previous", to: "pm2", async: true },
    ],
  },
  technologies: ["Next.js", "React", "TypeScript", "Node.js", "PowerShell", "PM2", "Caddy", "Windows Server"],
  result: [
    "Production no longer serves the mutable .next development directory.",
    "Active and inactive releases alternate, so a build cannot touch the live one.",
    "New releases are smoke-tested before they become active.",
    "A failed deployment restores the previous release automatically.",
    "The PM2 production environment was reduced to the two variables actually required.",
    "Caddy and the other hosted application remain isolated from portfolio deployment.",
  ],
  /* Request counts from a continuity monitor, published as test evidence.
     Deliberately not restated as percentages: "100% reliable" would convert a
     bounded observation into a marketing claim. */
  metrics: [
    { label: "Inactive-slot build", value: "327 / 327 requests 200", verified: true,
      sourceNote: "Continuity monitor during a full build into the inactive slot; page, CSS and JS each 327/327." },
    { label: "Ordinary build, site monitored", value: "255 / 255 requests 200", verified: true,
      sourceNote: "Reproduction of the original failure mode: npm run build rewriting .next while production served a release slot." },
    { label: "Rollback drill", value: "previous release restored", verified: true,
      sourceNote: "Forced post-switch failure via -FailAfterSwitchForTest; previous slot restored, public verified, exit 1." },
  ],
  verificationSource:
    "This repository: docs/CHANGELOG.md infrastructure entry, docs/DECISIONS.md D-030 to D-032, docs/QA_BASELINE.md deployment-safety section, and deploy/safe-deploy.ps1.",
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
  CASE_01,
  {
    id: "case-02",
    status: "draft",
    title: "",
    disclosure: "",
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
    disclosure: "",
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
