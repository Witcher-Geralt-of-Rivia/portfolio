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

check("every shipped entry is a draft", CASE_STUDIES.every((c) => c.status === "draft"),
  `${CASE_STUDIES.length} entries`);
check("no draft is publishable", publishableCaseStudies().length === 0);
check("section is not publishable", sectionIsPublishable() === false);
check(`minimum public cases is ${MINIMUM_PUBLIC_CASES}`, MINIMUM_PUBLIC_CASES === 3);

/* The shipped drafts must be genuinely empty. A plausible-looking placeholder
   is the thing most likely to be published by accident. */
const anyProse = CASE_STUDIES.some((c) =>
  [c.title, c.category, c.summary, c.scope, c.solution, c.challenge.title, c.challenge.body]
    .some((s) => s.trim().length > 0) ||
  c.problem.length + c.decisions.length + c.technologies.length + c.result.length +
  c.architecture.nodes.length > 0
);
check("drafts carry no invented prose or data", anyProse === false);

console.log("\n--- the guard itself ---");

const complete = {
  id: "t", status: "verified", title: "T", category: "C", accent: "sky",
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
