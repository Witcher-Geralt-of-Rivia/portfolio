/**
 * Canonical project memory check.
 *
 * Verifies that the repository's documentation is present, parseable and
 * internally consistent, so a context-compressed session cannot be handed a
 * contradictory picture of the project.
 *
 * Node built-ins only. Run with: npm run qa:memory
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const record = (ok, name, detail = "") => results.push({ ok, name, detail });
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

function report() {
  console.log("");
  console.log("=== PROJECT MEMORY CHECK ===");
  console.log("");
  for (const r of results) {
    const line = `  ${r.ok ? "PASS" : "FAIL"}  ${r.name}`;
    console.log(r.detail ? `${line}  (${r.detail})` : line);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log("");
  console.log(`  ${results.length - failed}/${results.length} checks passed`);
  console.log(failed === 0 ? "  RESULT: PASS" : `  RESULT: FAIL (${failed})`);
  console.log("");
  return failed;
}

/* ---- 1. canonical documents exist -------------------------------------- */

const REQUIRED_DOCS = [
  "docs/CLAUDE_HANDOFF.md",
  "docs/PROJECT_STATE.md",
  "docs/DESIGN_SYSTEM.md",
  "docs/ARCHITECTURE.md",
  "docs/DECISIONS.md",
  "docs/QA_BASELINE.md",
  "docs/PRIVACY_AND_SECURITY.md",
  "docs/DEPLOYMENT.md",
  "docs/CHANGELOG.md",
  "docs/NEXT_STAGE.md",
  "docs/DEMO_PLATFORM.md",
  "docs/DEMO_OPERATIONS_SPEC.md",
  "docs/DEMO_OPERATIONS_IMPLEMENTATION.md",
  "docs/CASE_STUDY_SOURCE_AUDIT.md",
  "docs/project-state.json",
  "CLAUDE.md",
];

const missing = REQUIRED_DOCS.filter((d) => !existsSync(join(ROOT, d)));
record(
  missing.length === 0,
  "canonical documents present",
  missing.length ? `missing: ${missing.join(", ")}` : `${REQUIRED_DOCS.length} files`
);
if (missing.length) process.exit(report() === 0 ? 0 : 1);

/* ---- 2. state file parses ---------------------------------------------- */

let state;
try {
  state = JSON.parse(read("docs/project-state.json"));
  record(true, "project-state.json parses");
} catch (err) {
  record(false, "project-state.json parses", err.message);
  process.exit(report() === 0 ? 0 : 1);
}

/* ---- 3. stage validity -------------------------------------------------- */

const stage = state.currentStage;
record(
  Number.isInteger(stage) && stage >= 1 && stage <= 99,
  "currentStage is a valid integer",
  `currentStage = ${stage}`
);
record(
  Array.isArray(state.frozenStages) && [1, 2, 3, 4].every((s) => state.frozenStages.includes(s)),
  "frozenStages includes 1 through 4",
  `frozenStages = [${state.frozenStages}]`
);
record(
  Array.isArray(state.frozenStages) && state.frozenStages.every((s) => s <= stage),
  "no frozen stage exceeds currentStage"
);

/* ---- 4. required constraints exist -------------------------------------- */

const REQUIRED_CONSTRAINTS = ["contactInformation", "paidAiApis", "backendRequiredForAiDemos"];
const absent = REQUIRED_CONSTRAINTS.filter((k) => !(k in (state.constraints ?? {})));
record(
  absent.length === 0,
  "required constraint keys present",
  absent.length ? `missing: ${absent.join(", ")}` : REQUIRED_CONSTRAINTS.join(", ")
);

/* ---- 5. constraints agree with the privacy document --------------------- */

const privacy = read("docs/PRIVACY_AND_SECURITY.md");
const forbidsContact = /Contact Information Prohibition/i.test(privacy);
const forbidsPaidAi = /Paid AI Runtime Prohibition/i.test(privacy);

record(
  !(state.constraints.contactInformation === true && forbidsContact),
  "contactInformation agrees with PRIVACY_AND_SECURITY.md",
  `json=${state.constraints.contactInformation}, doc forbids=${forbidsContact}`
);
record(
  !(state.constraints.paidAiApis === true && forbidsPaidAi),
  "paidAiApis agrees with PRIVACY_AND_SECURITY.md",
  `json=${state.constraints.paidAiApis}, doc forbids=${forbidsPaidAi}`
);

/* ---- 5b. the two canonical lists agree --------------------------------- */

/* `canonicalDocs` in the state file and REQUIRED_DOCS here must name the same
   set. A document cited as canonical by other documents but absent from both
   lists is one nothing verifies, which is how `CASE_STUDY_SOURCE_AUDIT.md`
   drifted out of date unnoticed. */
const declared = new Set(state.canonicalDocs ?? []);
const enforced = new Set(REQUIRED_DOCS.filter((d) => d.endsWith(".md") && d.startsWith("docs/")));
const onlyDeclared = [...declared].filter((d) => !enforced.has(d));
const onlyEnforced = [...enforced].filter((d) => !declared.has(d));
record(
  onlyDeclared.length === 0 && onlyEnforced.length === 0,
  "project-state.json canonicalDocs matches the enforced list",
  onlyDeclared.length || onlyEnforced.length
    ? `json-only: ${onlyDeclared.join(", ") || "none"}; harness-only: ${onlyEnforced.join(", ") || "none"}`
    : `${declared.size} documents`
);

/* ---- 6. NEXT_STAGE agrees with the state file --------------------------- */

const nextStageDoc = read("docs/NEXT_STAGE.md");
record(
  typeof state.nextStageTitle === "string" && nextStageDoc.includes(state.nextStageTitle),
  "NEXT_STAGE.md names the same next task as project-state.json",
  `expected "${state.nextStageTitle}"`
);
record(
  state.stage05Started === false ? /NOT STARTED/i.test(nextStageDoc) : true,
  "stage05Started agrees with NEXT_STAGE.md",
  `stage05Started = ${state.stage05Started}`
);

/* ---- 7. stage markers agree across documents ---------------------------- */

const MARKED = REQUIRED_DOCS.filter((d) => d.endsWith(".md") && d.startsWith("docs/"));
const mismatched = [];
for (const doc of MARKED) {
  const m = read(doc).match(/<!--\s*PROJECT_STAGE:\s*(\d+)\s*-->/);
  if (!m) mismatched.push(`${doc} has no marker`);
  else if (Number(m[1]) !== stage) mismatched.push(`${doc} = ${m[1]}`);
}
record(
  mismatched.length === 0,
  `every canonical document is marked PROJECT_STAGE ${stage}`,
  mismatched.length ? mismatched.join("; ") : `${MARKED.length} documents`
);

/* ---- 8. handoff content ------------------------------------------------- */

const handoff = read("docs/CLAUDE_HANDOFF.md");
record(
  handoff.includes(`Stages 01-0${stage}`) || handoff.includes(`Stage 0${stage}`),
  "CLAUDE_HANDOFF.md references the current stage"
);
record(
  handoff.includes(state.design.identity),
  "CLAUDE_HANDOFF.md states the design identity",
  state.design.identity
);
record(
  handoff.includes("IMPORTANT FOR CLAUDE"),
  "CLAUDE_HANDOFF.md carries the Claude instruction block"
);

/* ---- 9. size control ---------------------------------------------------- */

const lineCount = (rel) => read(rel).split("\n").length;
const handoffLines = lineCount("docs/CLAUDE_HANDOFF.md");
const stateLines = lineCount("docs/PROJECT_STATE.md");
record(handoffLines <= 300, "CLAUDE_HANDOFF.md within 300 lines", `${handoffLines} lines`);
record(stateLines <= 400, "PROJECT_STATE.md within 400 lines", `${stateLines} lines`);

/* ---- 10. root bootstrap ------------------------------------------------- */

record(
  read("CLAUDE.md").includes("docs/CLAUDE_HANDOFF.md"),
  "root CLAUDE.md points at the handoff document"
);

process.exit(report() === 0 ? 0 : 1);
