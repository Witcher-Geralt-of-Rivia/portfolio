/**
 * Orphan recovery QA.
 *
 * `deploy:safe` may now kill a process. That sentence is the reason this file
 * exists and the reason it is long: the failure mode of getting this wrong is
 * not a failed deployment, it is taking down a different application that
 * happens to share the host.
 *
 * So the tests are mostly about refusal. One scenario authorises recovery; the
 * rest are processes that occupy the port and must be left strictly alone, each
 * one different in exactly one way from the authorised case.
 *
 * Deterministic: pure function, no PM2, no sockets, no deployment.
 *
 *   node qa/stage09d1-orphan-recovery.mjs
 */

import { evaluateOrphanRecovery, FENCED_TOKENS } from "../deploy/orphan-recovery.mjs";
import { evaluateSupervision } from "../deploy/supervision.mjs";

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(62)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

const ROOT = "C:\\E_DRIVE\\portfolio";
const PORT = 3100;

/* The incident, as it actually was on the host. PM2 daemon 2432 spawned the
   Next server; PM2 then lost the process, reported `errored` with pid 0, and
   the child kept the socket. Every field below was read off the live box. */
const ORPHAN = {
  repoRoot: ROOT,
  port: PORT,
  listenerPid: 11216,
  supervised: false,
  pm2Status: "errored",
  managedPid: 0,
  daemonPid: 2432,
  ancestry: [11216, 2432],
  imageName: "node.exe",
  commandLine:
    '"C:/Program Files/nodejs/node.exe" C:\\E_DRIVE\\portfolio\\node_modules\\next\\dist\\bin\\next start -p 3100 -H 127.0.0.1',
};

const withFacts = (over) => ({ ...ORPHAN, ...over });

/* ===================================================================== */
section("THE ONE CASE THAT IS ALLOWED");
{
  const v = evaluateOrphanRecovery(ORPHAN);
  check("the real orphan is recoverable", v.recover === true, v.reasons.join(" | "));
  check("and the target is the listener, not anything else", v.targetPid === 11216, String(v.targetPid));
  check("with no reasons attached", v.reasons.length === 0, v.reasons.join(" | "));

  /* The condition this is a response to has to actually be a failure. If
     supervision passed on these facts, recovery would be answering a question
     nobody asked. */
  const sup = evaluateSupervision({
    expectedSlot: ".next-release-b",
    exists: true,
    status: "errored",
    slot: ".next-release-b",
    managedPid: 0,
    listenerPid: 11216,
    ancestry: [11216, 2432],
  });
  check("supervision does fail on the same facts", sup.ok === false, sup.reasons.length + " reasons");
}

/* ===================================================================== */
section("REFUSALS - THE PORT IS NOT EVIDENCE");
{
  /* Each of these holds the port. None of them may be touched. */
  const refuse = (label, facts, expect) => {
    const v = evaluateOrphanRecovery(withFacts(facts));
    check(label, v.recover === false, v.recover ? "AUTHORISED - WRONG" : "");
    if (expect) {
      check(
        `  and says why: ${expect}`.slice(0, 62),
        v.reasons.some((r) => r.includes(expect)),
        v.reasons.join(" | ").slice(0, 80)
      );
    }
  };

  refuse(
    "a Next server from a different directory",
    { commandLine: '"node.exe" C:\\other-app\\node_modules\\next\\dist\\bin\\next start -p 3100' },
    "does not name this repository"
  );
  refuse(
    "the neighbouring application by name",
    {
      commandLine:
        '"node.exe" C:\\ce-staging\\node_modules\\next\\dist\\bin\\next start -p 3100',
    },
    "does not name this repository"
  );
  refuse(
    "something that is not node at all",
    { imageName: "caddy.exe", commandLine: "caddy.exe run --config C:/caddy/Caddyfile" },
    "not node"
  );
  refuse(
    "a process whose command line cannot be read",
    { commandLine: "" },
    "could not be read"
  );
  refuse(
    "a node process that is not the Next server",
    {
      commandLine: '"node.exe" C:\\E_DRIVE\\portfolio\\scripts\\something-else.js --port 3100',
    },
    "does not name the Next server"
  );
  refuse(
    "the PM2 daemon itself",
    { listenerPid: 2432, ancestry: [2432] },
    "must never be killed"
  );
  refuse(
    "a process that is not a PM2 descendant",
    { ancestry: [11216, 9999] },
    "not a descendant"
  );
  refuse(
    "anything at all when the PM2 daemon cannot be identified",
    { daemonPid: 0 },
    "daemon could not be identified"
  );
  refuse("an empty port", { listenerPid: 0 }, "nothing is listening");
}

/* ===================================================================== */
section("REFUSALS - WHEN THERE IS NOTHING TO RECOVER");
{
  /* A healthy deployment. The listener IS the managed process, so this is the
     single most dangerous input in the file: authorising here would mean
     deploy:safe kills production every run. */
  const healthy = withFacts({
    supervised: true,
    pm2Status: "online",
    managedPid: 11216,
    ancestry: [11216, 2432],
  });
  const v = evaluateOrphanRecovery(healthy);
  check("a supervised production is never recovered", v.recover === false, v.reasons.join(" | "));
  check(
    "  and it says so plainly",
    v.reasons.some((r) => r.includes("already supervised")),
    v.reasons.join(" | ")
  );

  /* PM2 owns the socket but supervision failed for a different reason: the
     wrong slot. Killing the process would not fix the slot. */
  const wrongSlot = withFacts({
    supervised: false,
    pm2Status: "online",
    managedPid: 11216,
    ancestry: [11216, 2432],
  });
  const w = evaluateOrphanRecovery(wrongSlot);
  check("a supervision failure that is not an orphan is refused", w.recover === false);
  check(
    "  because PM2 already owns the listener",
    w.reasons.some((r) => r.includes("already owns the listener")),
    w.reasons.join(" | ")
  );

  /* A forked worker. PM2's pid is in the chain but is not the listener, which
     supervision.mjs accepts and this must too. */
  const forked = withFacts({
    supervised: false,
    pm2Status: "online",
    managedPid: 5000,
    listenerPid: 11216,
    ancestry: [11216, 5000, 2432],
  });
  const f = evaluateOrphanRecovery(forked);
  check("a worker forked by the managed process is refused", f.recover === false);
}

/* ===================================================================== */
section("THE NEIGHBOUR - MEASURED ON THE REAL HOST");
{
  /* This is the case that decides whether the whole feature is safe, and it is
     here because running the real check against the real neighbouring process
     produced a result worth keeping.

     That application is also `node.exe`, and it is also a child of the SAME PM2
     daemon: the ancestry chains are 11216 < 2432 < 6728 for ours and
     15004 < 2432 < 6728 for theirs, sharing daemon 2432. One PM2 daemon manages
     both products on this box.

     So daemon ancestry, which reads like the strongest proof available, does
     not separate the two at all. What separates them is the command line:
     whose repository it names, which port it names, and whether it names
     anything fenced. Ancestry is necessary and nowhere near sufficient, and
     anyone tempted to simplify this check to "is it a PM2 child" should read
     this block first. */
  const neighbour = withFacts({
    listenerPid: 15004,
    ancestry: [15004, 2432, 6728],
    imageName: "node.exe",
    commandLine:
      '"C:/Program Files/nodejs/node.exe" C:\\ce-staging\\node_modules\\next\\dist\\bin\\next start -p 3200 -H 127.0.0.1',
  });

  check(
    "the neighbour shares our PM2 daemon",
    neighbour.ancestry.includes(2432) && ORPHAN.ancestry.includes(2432)
  );

  const v = evaluateOrphanRecovery(neighbour);
  check("and is still refused", v.recover === false, v.reasons.join(" | ").slice(0, 60));
  check(
    "  for reasons that do not depend on ancestry",
    v.reasons.length >= 2 && v.reasons.every((r) => !r.includes("descendant")),
    v.reasons.join(" | ").slice(0, 70)
  );

  /* The same process, if it ever bound our port. Still refused, because the
     repository in its command line is not this one. */
  const neighbourOnOurPort = withFacts({
    listenerPid: 15004,
    ancestry: [15004, 2432, 6728],
    commandLine:
      '"C:/Program Files/nodejs/node.exe" C:\\ce-staging\\node_modules\\next\\dist\\bin\\next start -p 3100 -H 127.0.0.1',
  });
  const n2 = evaluateOrphanRecovery(neighbourOnOurPort);
  check("the neighbour holding OUR port is still refused", n2.recover === false, n2.reasons.join(" | ").slice(0, 60));
}

/* ===================================================================== */
section("THE FENCE");
{
  check("the fence names the neighbour", FENCED_TOKENS.includes("ce-staging"));
  check("and its proxy", FENCED_TOKENS.includes("ce-staging-proxy"));
  check("and its domain", FENCED_TOKENS.includes("appclubedaeconomia"));
  check("and its port", FENCED_TOKENS.includes("3200"));

  /* A command line naming this repository AND a fenced token is a
     contradiction. It is refused rather than resolved. */
  for (const token of ["ce-staging", "ce-staging-proxy", "appclubedaeconomia"]) {
    const v = evaluateOrphanRecovery(
      withFacts({
        commandLine: `"node.exe" C:\\E_DRIVE\\portfolio\\node_modules\\next\\dist\\bin\\next start -p 3100 --tag ${token}`,
      })
    );
    check(`a command line mentioning ${token} is refused`.slice(0, 62), v.recover === false);
  }

  /* 3200 is fenced, and it cannot appear alongside a 3100 command line without
     something being wrong. */
  const both = evaluateOrphanRecovery(
    withFacts({
      commandLine:
        '"node.exe" C:\\E_DRIVE\\portfolio\\node_modules\\next\\dist\\bin\\next start -p 3100 -H 127.0.0.1 --proxy 3200',
    })
  );
  check("a command line mentioning port 3200 is refused", both.recover === false, both.reasons.join(" | "));
}

/* ===================================================================== */
section("PATH HANDLING");
{
  /* Windows gives forward slashes in the interpreter path and backslashes in
     the script path, in the same string. Both have to match the same root. */
  const forward = evaluateOrphanRecovery(
    withFacts({
      commandLine:
        '"C:/Program Files/nodejs/node.exe" C:/E_DRIVE/portfolio/node_modules/next/dist/bin/next start -p 3100',
    })
  );
  check("a forward-slash command line still matches", forward.recover === true, forward.reasons.join(" | "));

  const upper = evaluateOrphanRecovery(
    withFacts({
      commandLine:
        '"node.exe" C:\\E_DRIVE\\PORTFOLIO\\node_modules\\next\\dist\\bin\\next START -p 3100',
    })
  );
  check("case does not decide it", upper.recover === true, upper.reasons.join(" | "));

  const rootWithSlashes = evaluateOrphanRecovery(
    withFacts({ repoRoot: "C:/E_DRIVE/portfolio" })
  );
  check("the supplied root may use either separator", rootWithSlashes.recover === true);
}

/* ===================================================================== */
section("BAD INPUT FAILS CLOSED");
{
  for (const [label, over] of [
    ["no repository root", { repoRoot: "" }],
    ["no port", { port: 0 }],
    ["a negative listener pid", { listenerPid: -1 }],
    ["a non-numeric listener pid", { listenerPid: NaN }],
  ]) {
    const v = evaluateOrphanRecovery(withFacts(over));
    check(`${label} is refused`.slice(0, 62), v.recover === false, v.reasons.join(" | ").slice(0, 60));
  }

  /* Nothing may authorise without naming a target. */
  const all = [ORPHAN, withFacts({ listenerPid: 0 }), withFacts({ daemonPid: 0 })];
  check(
    "no verdict ever authorises without a target pid",
    all.every((f) => {
      const v = evaluateOrphanRecovery(f);
      return v.recover === false || (v.targetPid > 0 && v.targetPid === f.listenerPid);
    })
  );
}

console.log(
  `\n=== stage 09D1 orphan recovery: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
