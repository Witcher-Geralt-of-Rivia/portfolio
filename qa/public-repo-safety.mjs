/**
 * Public-repository safety guard.
 *
 * This repository is public, and its whole history is public with it. A
 * credential committed once is exposed even if the next commit deletes it,
 * because the blob stays reachable from the commit that introduced it.
 *
 * So this runs before a publication push and refuses the obvious mistakes:
 * a tracked `.env`, a private key, a build directory committed by accident,
 * a recognisable credential prefix.
 *
 * **It is a guard, not a security scanner.** It matches known shapes. A secret
 * that does not look like one — a password in prose, a key with no prefix, an
 * internal URL that happens to grant access — passes it without comment.
 * Passing means "none of the usual mistakes", never "no secrets". Read what
 * you are about to publish.
 *
 *   node qa/public-repo-safety.mjs           check the tracked tree at HEAD
 *   node qa/public-repo-safety.mjs --history check every commit as well
 *
 * The history pass is the slower and more important one: it is the only pass
 * that sees a file that was deleted before HEAD.
 */

import { execFileSync } from "node:child_process";

const HISTORY = process.argv.includes("--history");

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(52)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

/* =====================================================================
   PATHS THAT MUST NEVER BE TRACKED
   ===================================================================== */

/** Credential-bearing files, by name. */
const FORBIDDEN_PATHS = [
  { label: "environment files", re: /(^|\/)\.env($|\.)/i },
  { label: "PEM material", re: /\.pem$/i },
  { label: "private keys", re: /\.(key|pfx|p12|jks|keystore)$/i },
  { label: "SSH private keys", re: /(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i },
  { label: "PuTTY keys", re: /\.ppk$/i },
  { label: "git credential stores", re: /(^|\/)\.git-credentials$/i },
  { label: "npm/netrc auth", re: /(^|\/)\.(npmrc|netrc)$/i },
  { label: "cloud credential files", re: /(^|\/)(\.aws|\.azure|gcloud)\//i },
  { label: "PM2 dumps", re: /(^|\/)dump\.pm2$/i },
];

/** Generated output that has no business in source control. */
const GENERATED_PATHS = [
  { label: "node_modules", re: /(^|\/)node_modules\// },
  { label: "Next build output", re: /(^|\/)\.next\// },
  { label: "release slots", re: /(^|\/)\.next-release-[ab]\// },
  { label: "build/out directories", re: /(^|\/)(out|build|coverage)\// },
  { label: "deploy logs", re: /(^|\/)deploy\/logs\// },
  { label: "Playwright output", re: /(^|\/)(test-results|playwright-report)\// },
  { label: "log files", re: /\.log$/i },
];

/* =====================================================================
   CONTENT THAT MUST NEVER BE COMMITTED
   ===================================================================== */

/**
 * Recognisable credential shapes.
 *
 * Deliberately narrow. A pattern loose enough to catch every secret is also
 * loose enough to fire on every ordinary line, and a guard that cries wolf
 * gets skipped — which is worse than not having one.
 *
 * The patterns are assembled from fragments so that this file does not itself
 * contain the literal prefixes it forbids, which would make it fail its own
 * check when run over the history that contains it.
 */
const CREDENTIAL_PATTERNS = [
  { label: "OpenAI-style key", re: new RegExp(`${"sk"}-[A-Za-z0-9_-]{20,}`) },
  { label: "Anthropic-style key", re: new RegExp(`${"sk"}-ant-[A-Za-z0-9_-]{20,}`) },
  { label: "GitHub token", re: new RegExp(`(${"ghp"}_|${"gho"}_|${"ghs"}_|${"github"}_pat_)[A-Za-z0-9_]{20,}`) },
  { label: "AWS access key id", re: new RegExp(`${"AKIA"}[0-9A-Z]{16}`) },
  { label: "Google API key", re: new RegExp(`${"AIza"}[0-9A-Za-z_-]{35}`) },
  { label: "Slack token", re: new RegExp(`${"xox"}[abprs]-[A-Za-z0-9-]{10,}`) },
  { label: "private key block", re: /-----BEGIN (RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { label: "credentialed connection string", re: /(postgres|postgresql|mysql|mongodb|redis|amqp):\/\/[^\s"']*:[^\s@"']+@/ },
  { label: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { label: "secret in NEXT_PUBLIC_", re: /NEXT_PUBLIC_[A-Z0-9_]*(KEY|SECRET|TOKEN|PASSWORD)/ },
];

/**
 * A NUL byte means binary, and a credential is not hiding in a PNG in any form
 * this guard could recognise.
 *
 * Written with `String.fromCharCode(0)` rather than an escape, because a
 * literal NUL in this file would make it binary to git and to grep — which is
 * exactly what happened the first time it was written.
 */
const NUL = String.fromCharCode(0);
const isBinary = (text) => text.includes(NUL);

/** Paths whose content is expected to be dense and hash-like. */
const HASH_HEAVY = /(^|\/)package-lock\.json$/;

function scanContent(where, path, content) {
  if (HASH_HEAVY.test(path)) return [];
  const hits = [];
  for (const { label, re } of CREDENTIAL_PATTERNS) {
    if (re.test(content)) hits.push(`${where}${path}: ${label}`);
  }
  return hits;
}

/* =====================================================================
   RUN
   ===================================================================== */

section("TRACKED PATHS");
{
  const tracked = git("ls-files").split("\n").filter(Boolean);
  console.log(`  ${tracked.length} tracked files at HEAD`);

  for (const { label, re } of FORBIDDEN_PATHS) {
    const hits = tracked.filter((p) => re.test(p));
    check(`no tracked ${label}`, hits.length === 0, hits.slice(0, 3).join(", "));
  }
  for (const { label, re } of GENERATED_PATHS) {
    const hits = tracked.filter((p) => re.test(p));
    check(`no tracked ${label}`, hits.length === 0, hits.slice(0, 3).join(", "));
  }
}

section("TRACKED CONTENT");
{
  const files = git("ls-files").split("\n").filter(Boolean);
  const hits = [];
  for (const path of files) {
    let content;
    try {
      content = git("show", `HEAD:${path}`);
    } catch {
      continue;
    }
    /* A NUL byte means binary; a credential is not hiding in a PNG in any
       form this guard could recognise. */
    if (isBinary(content)) continue;
    hits.push(...scanContent("", path, content));
  }
  check("no credential shape in any tracked file", hits.length === 0, hits.slice(0, 3).join(" | "));
}

if (HISTORY) {
  section("HISTORY");
  const commits = git("rev-list", "--all").split("\n").filter(Boolean);
  console.log(`  ${commits.length} reachable commits`);

  /* Every blob ever reachable, deduplicated by object id, so a file present
     in twenty commits is read once. */
  const objects = git("rev-list", "--objects", "--all").split("\n").filter(Boolean);
  const blobs = new Map();
  for (const line of objects) {
    const space = line.indexOf(" ");
    if (space === -1) continue;
    blobs.set(line.slice(0, space), line.slice(space + 1));
  }
  console.log(`  ${blobs.size} distinct paths across history`);

  const pathHits = [];
  for (const path of new Set(blobs.values())) {
    for (const { label, re } of [...FORBIDDEN_PATHS, ...GENERATED_PATHS]) {
      if (re.test(path)) pathHits.push(`${path}: ${label}`);
    }
  }
  check("no forbidden path anywhere in history", pathHits.length === 0, pathHits.slice(0, 3).join(", "));

  const contentHits = [];
  for (const [oid, path] of blobs) {
    if (HASH_HEAVY.test(path)) continue;
    let content;
    try {
      content = git("cat-file", "-p", oid);
    } catch {
      continue;
    }
    if (isBinary(content)) continue;
    contentHits.push(...scanContent(`${oid.slice(0, 8)} `, path, content));
  }
  check("no credential shape anywhere in history", contentHits.length === 0,
    contentHits.slice(0, 3).join(" | "));
}

console.log(
  `\n=== public repo safety: ${failures === 0 ? `ALL PASS (${checks} checks)` : `${failures} FAILURE(S) of ${checks}`} ===`
);
if (!HISTORY) {
  console.log("    HEAD only. Run with --history before a publication push.");
}
console.log("    A guard against known mistakes, not proof that no secret exists.");
process.exit(failures === 0 ? 0 : 1);
