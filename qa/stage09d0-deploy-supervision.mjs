/**
 * Stage 09D0 - deployment supervision QA.
 *
 * Not a product suite. This tests one rule, the one a deployment now has to
 * satisfy before it may call itself successful:
 *
 *   A production deployment is successful only when the public service is
 *   healthy AND the service is owned by the intended online PM2-managed
 *   portfolio process.
 *
 * The rule lives in `deploy/supervision.mjs` as a pure function precisely so it
 * can be tested here without a deployment, a PM2 daemon or a socket. The
 * scenario that mattered is the last one: a perfectly healthy site served by a
 * process PM2 had lost, which the old script called SUCCESS.
 *
 *   node qa/stage09d0-deploy-supervision.mjs
 */

import { evaluateSupervision } from "../deploy/supervision.mjs";

let failures = 0;
let checks = 0;
const check = (label, ok, detail = "") => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(58)}${detail ? "  " + detail : ""}`);
};
const section = (t) => console.log(`\n########## ${t} ##########`);

/** The shape of a deployment that went right on this host. */
const HEALTHY = {
  expectedSlot: ".next-release-b",
  exists: true,
  status: "online",
  slot: ".next-release-b",
  managedPid: 18240,
  listenerPid: 18240,
  ancestry: [18240, 2432],
};

const verdict = (over = {}) => evaluateSupervision({ ...HEALTHY, ...over });
const saysAbout = (v, word) => v.reasons.some((r) => r.toLowerCase().includes(word));

/* ===================================================================== */
section("ACCEPTS A SUPERVISED PRODUCTION");
{
  const v = verdict();
  check("the healthy case passes", v.ok, v.reasons.join(" | "));
  check("and gives no reason to worry", v.reasons.length === 0, String(v.reasons.length));

  /* PM2 spawns the Next server directly on this host and it binds in process,
     so the listener is the managed pid. The rule tolerates a descendant so a
     future Next or PM2 that forks a worker does not fail a good deployment. */
  const forked = verdict({ listenerPid: 20001, ancestry: [20001, 18240, 2432] });
  check("a forked child of the managed process still counts", forked.ok, forked.reasons.join(" | "));

  const grandchild = verdict({ listenerPid: 30002, ancestry: [30002, 20001, 18240, 2432] });
  check("and so does a grandchild", grandchild.ok, grandchild.reasons.join(" | "));
}

/* ===================================================================== */
section("REJECTS THE FAILURE THAT WAS CALLED SUCCESS");
{
  /* 2026-09-03, exactly. PM2 gave up and marked the app errored; an earlier
     child kept the port and served every request correctly. Both halves of the
     situation must be refused on their own. */
  const orphanServing = verdict({
    status: "errored",
    managedPid: 0,
    listenerPid: 7216,
    ancestry: [7216, 2432],
  });
  check("the incident is refused", !orphanServing.ok);
  check("naming the status", saysAbout(orphanServing, "errored"), orphanServing.reasons.join(" | "));

  /* The subtler half, and the one HTTP can never see: PM2 is online, the slot
     is right, the site answers, and the process answering is not the managed
     one. Without the ownership rule this passes everything. */
  const orphanBesideOnline = verdict({ listenerPid: 7216, ancestry: [7216, 2432] });
  check("an orphan holding the port is refused even when PM2 says online", !orphanBesideOnline.ok);
  check(
    "and the reason names the pid that actually holds it",
    saysAbout(orphanBesideOnline, "7216") && saysAbout(orphanBesideOnline, "descendant"),
    orphanBesideOnline.reasons.join(" | ")
  );
  check(
    "the ancestry is shown, so the operator can see what it is",
    saysAbout(orphanBesideOnline, "chain"),
    orphanBesideOnline.reasons.join(" | ")
  );
}

/* ===================================================================== */
section("REJECTS EACH FAILURE MODE ON ITS OWN");
{
  const missing = verdict({ exists: false });
  check("a missing PM2 process is refused", !missing.ok);
  check("saying so once rather than five times", missing.reasons.length === 1, missing.reasons.join(" | "));
  check("and naming what is missing", saysAbout(missing, "no process named portfolio"), missing.reasons[0] ?? "");

  for (const status of ["errored", "stopped", "stopping", "launching", "unknown", ""]) {
    const v = verdict({ status });
    check(`status ${status || "(blank)"} is refused`, !v.ok, v.reasons.join(" | "));
  }

  const wrongSlot = verdict({ slot: ".next-release-a" });
  check("the wrong slot is refused", !wrongSlot.ok);
  check(
    "and the reason names both slots",
    saysAbout(wrongSlot, ".next-release-a") && saysAbout(wrongSlot, ".next-release-b"),
    wrongSlot.reasons.join(" | ")
  );

  const legacySlot = verdict({ slot: "" });
  check("an unset slot is refused", !legacySlot.ok, legacySlot.reasons.join(" | "));

  const noListener = verdict({ listenerPid: 0, ancestry: [] });
  check("nothing listening is refused", !noListener.ok);
  check("and says the port is empty", saysAbout(noListener, "listening"), noListener.reasons.join(" | "));

  const noPid = verdict({ managedPid: 0 });
  check("a managed process with no pid is refused", !noPid.ok);
  check("and says nothing can own the port", saysAbout(noPid, "no pid"), noPid.reasons.join(" | "));

  const noExpectation = verdict({ expectedSlot: "" });
  check("a check with no expected slot is refused", !noExpectation.ok, noExpectation.reasons.join(" | "));
}

/* ===================================================================== */
section("REPORTS EVERYTHING WRONG, NOT ONLY THE FIRST THING");
{
  /* An operator reading a failed deployment should get the whole picture in one
     go rather than fixing one line and rerunning to find the next. */
  const several = verdict({
    status: "errored",
    slot: ".next-release-a",
    listenerPid: 7216,
    ancestry: [7216, 2432],
  });
  check("three independent faults give three reasons", several.reasons.length === 3, several.reasons.join(" | "));
  check("the status is one", saysAbout(several, "errored"));
  check("the slot is another", saysAbout(several, "intended"));
  check("the ownership is the third", saysAbout(several, "descendant"));
}

/* ===================================================================== */
section("TOLERATES THE UNTIDY INPUT POWERSHELL CAN HAND IT");
{
  /* PowerShell passes everything as strings, sometimes padded, and passes
     "(unset)" rather than an empty argument because an empty argv is dropped. */
  const stringy = evaluateSupervision({
    expectedSlot: " .next-release-b ",
    exists: true,
    status: " ONLINE ",
    slot: " .next-release-b ",
    managedPid: "18240",
    listenerPid: "18240",
    ancestry: ["18240", "2432"],
  });
  check("padded strings and a shouted status still pass", stringy.ok, stringy.reasons.join(" | "));

  const unsetSentinel = verdict({ slot: "(unset)" });
  check("the (unset) sentinel is refused as a wrong slot", !unsetSentinel.ok, unsetSentinel.reasons.join(" | "));

  const noAncestry = verdict({ ancestry: [] });
  check(
    "an empty ancestry falls back to the listener itself",
    noAncestry.ok,
    noAncestry.reasons.join(" | ")
  );

  const zeroAncestry = verdict({ listenerPid: 7216, ancestry: [0] });
  check("a zero-only ancestry is refused, not silently trusted", !zeroAncestry.ok, zeroAncestry.reasons.join(" | "));
}

console.log(
  `\n=== stage 09D0 deploy supervision: ${failures === 0 ? "ALL PASS" : failures + " FAILED"} (${checks} checks) ===`
);
process.exit(failures === 0 ? 0 : 1);
