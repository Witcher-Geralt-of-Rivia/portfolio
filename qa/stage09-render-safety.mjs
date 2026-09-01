/**
 * Stage 09 render safety.
 *
 * A case-study section makes claims about real work, so the one thing that
 * must never happen is an unverified entry reaching the page. This harness
 * proves the guard holds, and then proves the live site is still showing the
 * placeholder rather than an empty or half-built section.
 *
 * Node 24 strips the types, so the real module is exercised here rather than a
 * copy of it.
 */

import {
  CASE_STUDIES,
  MINIMUM_PUBLIC_CASES,
  isComplete,
  publishableCaseStudies,
  publishableMetrics,
  sectionIsPublishable,
} from "../src/content/case-studies.ts";

const pass = (b) => (b ? "PASS" : "FAIL");
let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${label.padEnd(56)} ${pass(ok)}${detail ? "  " + detail : ""}`);
};

console.log("=== STAGE 09 RENDER SAFETY ===\n");
console.log("--- shipped content ---");

const byId = Object.fromEntries(CASE_STUDIES.map((c) => [c.id, c]));
const CASE_01 = byId["case-01"];
const drafts = CASE_STUDIES.filter((c) => c.id !== "case-01");

check("case-01 is verified", CASE_01?.status === "verified");
check("case-01 is complete", isComplete(CASE_01) === true);
check("case-01 is the only publishable case", publishableCaseStudies().length === 1);
check("remaining slots are still empty drafts",
  drafts.length === 2 && drafts.every((c) => c.status === "draft"),
  `${drafts.length} drafts`);

/* The empty slots must stay genuinely empty. A plausible-looking placeholder is
   the thing most likely to be published by accident. */
const anyProse = drafts.some((c) =>
  [c.title, c.disclosure, c.category, c.summary, c.scope, c.solution, c.challenge.title, c.challenge.body]
    .some((s) => s.trim().length > 0) ||
  c.problem.length + c.decisions.length + c.technologies.length + c.result.length +
  c.architecture.nodes.length > 0
);
check("drafts carry no invented prose or data", anyProse === false);

/* The gate the whole stage turns on: one verified case is not a section. */
check("section is still not publishable", sectionIsPublishable() === false);
check(`minimum public cases is ${MINIMUM_PUBLIC_CASES}`, MINIMUM_PUBLIC_CASES === 3);
check("publishable count is below the minimum",
  publishableCaseStudies().length < MINIMUM_PUBLIC_CASES,
  `${publishableCaseStudies().length} of ${MINIMUM_PUBLIC_CASES}`);

console.log("\n--- case-01 is disclosed as internal work ---");

/* An internal project must say so on the case itself. If this string ever goes
   missing the case reads as delivered client work. */
check("case-01 declares itself an internal case study",
  /INTERNAL ENGINEERING CASE STUDY/i.test(CASE_01?.disclosure ?? ""),
  JSON.stringify(CASE_01?.disclosure));
check("case-01 names no client or employer",
  !/\b(client|customer|employer|agency|on behalf of)\b/i.test(
    [CASE_01?.summary, CASE_01?.scope, CASE_01?.solution, ...(CASE_01?.result ?? [])].join(" ")));

console.log("\n--- measurements stay evidence, not marketing ---");

/* The approved wording is a count of observed requests. Restating it as a
   percentage would turn a test result into a reliability claim. */
const m01 = publishableMetrics(CASE_01 ?? {});
check("every rendered metric is verified", m01.every((x) => x.verified), `${m01.length} rendered`);
check("no metric is expressed as a percentage",
  m01.every((x) => !x.value.includes("%")), m01.map((x) => x.value).join(" | "));
check("no metric claims perfection or reliability",
  !/\b(100%|always|never fails|guaranteed|reliable|bulletproof|zero downtime)\b/i
    .test(m01.map((x) => `${x.label} ${x.value}`).join(" ")));

console.log("\n--- the guard itself ---");

const complete = {
  id: "t", status: "verified", title: "T", disclosure: "D", category: "C", accent: "sky",
  summary: "S", problem: ["p"], scope: "sc", solution: "sol",
  challenge: { title: "ct", body: "cb" },
  decisions: [{ index: "01", title: "d", reason: "r" }],
  architecture: { summary: "a", nodes: [{ id: "n", label: "N", code: "N", kind: "service", x: 50, y: 50 }], connections: [] },
  technologies: ["T"], result: ["r"],
};

check("a complete verified case IS publishable", publishableCaseStudies([complete]).length === 1);
check("a draft is filtered even when complete",
  publishableCaseStudies([{ ...complete, status: "draft" }]).length === 0);

/* Marked verified but missing facts: still not publishable. */
const holes = [
  ["title", { ...complete, title: "" }],
  ["disclosure", { ...complete, disclosure: "" }],
  ["summary", { ...complete, summary: "" }],
  ["problem", { ...complete, problem: [] }],
  ["scope", { ...complete, scope: "" }],
  ["solution", { ...complete, solution: "" }],
  ["challenge", { ...complete, challenge: { title: "", body: "" } }],
  ["decisions", { ...complete, decisions: [] }],
  ["architecture summary", { ...complete, architecture: { ...complete.architecture, summary: "" } }],
  ["architecture nodes", { ...complete, architecture: { ...complete.architecture, nodes: [] } }],
  ["technologies", { ...complete, technologies: [] }],
  ["result", { ...complete, result: [] }],
];
for (const [field, study] of holes) {
  check(`verified but missing ${field} is refused`, publishableCaseStudies([study]).length === 0);
}
check("whitespace-only text does not count as present",
  isComplete({ ...complete, title: "   " }) === false);

console.log("\n--- metrics ---");
const withMetrics = {
  ...complete,
  metrics: [
    { label: "ok", value: "1", verified: true },
    { label: "unverified", value: "999%", verified: false },
    { label: "ok2", value: "2", verified: true },
    { label: "ok3", value: "3", verified: true },
    { label: "ok4", value: "4", verified: true },
  ],
};
const m = publishableMetrics(withMetrics);
check("an unverified metric never renders", m.every((x) => x.verified));
check("at most three metrics render", m.length === 3, `${m.length} of 5`);
check("a case with no metrics is fine", publishableMetrics(complete).length === 0);
check("sourceNote is never part of the rendered metric",
  m.every((x) => !("sourceNote" in x) || x.sourceNote === undefined));

console.log("\n--- the section is not wired in ---");
const { readFileSync } = await import("node:fs");
const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
check("page.tsx does not import the work section", !page.includes("SelectedWorkSection"));
check("page.tsx keeps #work in the placeholder list", !/BUILT[^)]*"work"/.test(page));
check("globals.css does not import work.css", !globals.includes("work.css"));

console.log(`\n=== stage09 render safety: ${failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"} ===`);
process.exit(failures === 0 ? 0 : 1);
