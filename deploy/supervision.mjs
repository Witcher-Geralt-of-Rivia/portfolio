/**
 * Is production actually supervised?
 *
 * A deployment used to be called successful when the public site answered 200.
 * On 2026-09-03 that was not enough. The slot switch took longer than usual,
 * PM2 spawned the replacement before the previous process had released port
 * 3100, the replacement died with `EADDRINUSE`, and PM2 retried until it marked
 * the app `errored`. One earlier child had bound successfully and kept serving,
 * so every HTTP check passed and the run printed SUCCESS.
 *
 * What was left was a live site owned by a process PM2 had lost: no pid file,
 * status `errored`, and every `pm2 restart` spawning a child that could not
 * bind. A supervisor that cannot restart the thing it supervises is a site with
 * no recovery path, and the deployment script said it was fine.
 *
 * So availability is not the test. The test is whether the intended, online,
 * PM2-managed process is the one holding the port.
 *
 * This module is the decision and nothing else: no PM2, no sockets, no
 * processes, no I/O. PowerShell gathers the facts and asks this what they mean,
 * which is what makes the rule testable without a deployment.
 *
 *   node deploy/supervision.mjs <expectedSlot> <exists> <status> <slot> \
 *                               <managedPid> <listenerPid> <ancestryCsv>
 *
 * Prints `ok=yes|no` and one `reason=` line per failure.
 */

/**
 * @param {object} facts
 * @param {string}  facts.expectedSlot  the release slot this deployment intends
 * @param {boolean} facts.exists        PM2 knows an app called `portfolio`
 * @param {string}  facts.status        PM2's status word for it
 * @param {string}  facts.slot          PORTFOLIO_DIST_DIR PM2 holds for it
 * @param {number}  facts.managedPid    the pid PM2 reports
 * @param {number}  facts.listenerPid   the pid holding the production port, 0 for none
 * @param {number[]} facts.ancestry     listener pid then each parent, walking up
 */
export function evaluateSupervision(facts) {
  const reasons = [];

  const expectedSlot = String(facts.expectedSlot ?? "").trim();
  const status = String(facts.status ?? "").trim().toLowerCase();
  const slot = String(facts.slot ?? "").trim();
  const managedPid = Number(facts.managedPid ?? 0);
  const listenerPid = Number(facts.listenerPid ?? 0);
  const ancestry = (facts.ancestry ?? []).map(Number).filter((n) => Number.isFinite(n) && n > 0);

  if (!expectedSlot) {
    reasons.push("no expected slot was supplied to the check");
  }

  if (!facts.exists) {
    reasons.push("PM2 has no process named portfolio");
    /* Nothing below can be judged without a managed process, and saying so five
       times would bury the one fact that matters. */
    return { ok: false, reasons };
  }

  if (status !== "online") {
    reasons.push(`PM2 status is ${status || "unknown"}, not online`);
  }

  if (slot !== expectedSlot) {
    reasons.push(`PM2 is serving ${slot || "(unset)"}, not the intended ${expectedSlot}`);
  }

  if (!Number.isFinite(managedPid) || managedPid <= 0) {
    reasons.push("PM2 reports no pid for the process, so nothing can own the port");
  }

  if (!Number.isFinite(listenerPid) || listenerPid <= 0) {
    reasons.push("nothing is listening on the production port");
  }

  /* The assertion the incident turned on. An orphan can hold the port and serve
     every request correctly; what it cannot do is be the process PM2 manages.
     Equality is the case on this host, where PM2 spawns the Next server
     directly and it binds in-process. The ancestry walk is there so a future
     Next or PM2 that forks a worker does not turn a correct deployment into a
     failure: a descendant of the managed pid is still the managed process's
     socket. Anything else is an orphan, whatever it is serving. */
  if (managedPid > 0 && listenerPid > 0) {
    const chain = ancestry.length > 0 ? ancestry : [listenerPid];
    const owned = chain.includes(managedPid);
    if (!owned) {
      reasons.push(
        `the listener on the production port is pid ${listenerPid}, which is not ` +
          `PM2's pid ${managedPid} nor a descendant of it (chain ${chain.join(" < ")})`
      );
    }
  }

  return { ok: reasons.length === 0, reasons };
}

/* --- CLI ------------------------------------------------------------------ */

/* Only when run directly. Imported by the QA suite, which wants the function
   and not a process that exits. */
const invokedDirectly =
  process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("deploy/supervision.mjs");

if (invokedDirectly) {
  const [expectedSlot, exists, status, slot, managedPid, listenerPid, ancestryCsv] =
    process.argv.slice(2);

  const verdict = evaluateSupervision({
    expectedSlot,
    exists: String(exists).toLowerCase() === "yes" || String(exists).toLowerCase() === "true",
    status,
    slot,
    managedPid: Number(managedPid),
    listenerPid: Number(listenerPid),
    ancestry: String(ancestryCsv ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number),
  });

  const out = [`ok=${verdict.ok ? "yes" : "no"}`];
  for (const reason of verdict.reasons) out.push(`reason=${reason}`);
  console.log(out.join("\n"));
}
