/**
 * May this deployment reclaim port 3100, and from which process?
 *
 * `supervision.mjs` detects the failure: the public site is healthy but the
 * process holding the port is not the one PM2 manages. It refuses to call that
 * a success, which was the whole point of 09D0. What it could not do is fix it,
 * and on 2026-09-03 that gap became the blocker: an orphaned Next server held
 * 3100, so every `pm2 start` died with `EADDRINUSE`, PM2 stayed `errored` with
 * no pid, and `deploy:safe` failed at the supervision gate on every attempt.
 * Three consecutive runs produced exactly the same output. The sanctioned path
 * had no way out of a state the sanctioned path could create.
 *
 * This module is the missing decision, and it is deliberately hard to satisfy.
 * Killing whatever happens to hold a port is how a deployment script takes down
 * a neighbouring application, so occupying the port is explicitly NOT evidence
 * of anything here. The listener has to prove it belongs to this deployment
 * before anything is allowed to touch it:
 *
 *   the image is node
 *   its command line names THIS repository root
 *   its command line names the Next server and the production port
 *   its command line names none of the fenced neighbours
 *   it is a descendant of the PM2 daemon that is running now
 *
 * All five, or the answer is no. A process that merely looks plausible is left
 * alone and the deployment fails closed, which is the correct outcome: a failed
 * deployment is recoverable by a person, and a killed neighbour is an outage
 * in somebody else's product.
 *
 * The last of the five is the strictest and the reason it is there: this host
 * runs another application behind the same Caddy, and PM2 daemon ancestry is
 * what separates "a Next server this deployment system started" from "a Next
 * server". If the daemon has been restarted since the orphan was spawned the
 * ancestry is gone, the proof fails, and a person looks at it. That is a worse
 * outcome than an automatic fix and a much better one than a wrong guess.
 *
 * No PM2, no sockets, no processes, no I/O: PowerShell gathers the facts and
 * asks this what they mean, so the rule is testable without a deployment.
 *
 *   node deploy/orphan-recovery.mjs <repoRoot> <port> <listenerPid> \
 *        <supervised> <pm2Status> <managedPid> <daemonPid> \
 *        <ancestryCsv> <imageName> <commandLine>
 *
 * Prints `recover=yes|no`, one `reason=` line per blocker, and `target=<pid>`
 * when and only when recovery is authorised.
 */

/* Tokens that must never appear in the command line of a process this script is
   about to kill. The neighbouring application and its proxy are fenced by name
   in the deployment brief; the port is fenced because it is that application's,
   and a process serving it is not ours whatever else it looks like. */
export const FENCED_TOKENS = [
  "ce-staging",
  "ce-staging-proxy",
  "appclubedaeconomia",
  "3200",
];

const norm = (s) => String(s ?? "").replace(/\\/g, "/").toLowerCase();

/**
 * @param {object} facts
 * @param {string}  facts.repoRoot     absolute path of this repository
 * @param {number}  facts.port         the production port
 * @param {number}  facts.listenerPid  pid holding that port, 0 for none
 * @param {boolean} facts.supervised   supervision.mjs already says this is fine
 * @param {string}  facts.pm2Status    PM2's status word for `portfolio`
 * @param {number}  facts.managedPid   the pid PM2 reports, 0 when it has none
 * @param {number}  facts.daemonPid    the running PM2 daemon, 0 when unknown
 * @param {number[]} facts.ancestry    listener pid then each parent, walking up
 * @param {string}  facts.imageName    the listener's process image
 * @param {string}  facts.commandLine  the listener's full command line
 */
export function evaluateOrphanRecovery(facts) {
  const reasons = [];

  const repoRoot = norm(facts.repoRoot);
  const port = Number(facts.port ?? 0);
  const listenerPid = Number(facts.listenerPid ?? 0);
  const managedPid = Number(facts.managedPid ?? 0);
  const daemonPid = Number(facts.daemonPid ?? 0);
  const image = norm(facts.imageName);
  const cmd = norm(facts.commandLine);
  const ancestry = (facts.ancestry ?? [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!repoRoot) reasons.push("no repository root was supplied to the check");
  if (!Number.isFinite(port) || port <= 0) {
    reasons.push("no production port was supplied to the check");
  }

  /* Nothing to reclaim. Said first because every other reason below would be a
     confusing way to report an empty port. */
  if (!Number.isFinite(listenerPid) || listenerPid <= 0) {
    return { recover: false, reasons: ["nothing is listening on the production port"] };
  }

  /* Recovery is for a broken supervisor, not a working one. If supervision
     already passes, the listener is the managed process and killing it would
     turn a healthy deployment into an outage. */
  if (facts.supervised) {
    return {
      recover: false,
      reasons: ["production is already supervised, so there is nothing to recover"],
    };
  }

  /* The orphan condition proper: PM2 cannot be the owner of this socket. Either
     it has no pid at all, or the pid it has is nowhere in the listener's
     ancestry. If PM2 does own it and supervision still failed, the fault is
     something else (the wrong slot, say) and killing the process would not fix
     it. */
  const chain = ancestry.length > 0 ? ancestry : [listenerPid];
  const pm2OwnsListener = managedPid > 0 && chain.includes(managedPid);
  if (pm2OwnsListener) {
    reasons.push(
      `PM2's pid ${managedPid} already owns the listener, so the fault is not an orphan`
    );
  }

  /* --- proof that this process is ours ---------------------------------- */

  if (!/(^|\/)node(\.exe)?$/.test(image)) {
    reasons.push(`the listener's image is ${facts.imageName || "(unknown)"}, not node`);
  }

  if (!cmd) {
    reasons.push("the listener's command line could not be read, so it cannot be identified");
  } else {
    if (!cmd.includes(repoRoot)) {
      reasons.push(
        "the listener's command line does not name this repository, so it belongs to something else"
      );
    }
    if (!cmd.includes("next")) {
      reasons.push("the listener's command line does not name the Next server");
    }
    if (!cmd.includes(String(port))) {
      reasons.push(`the listener's command line does not name port ${port}`);
    }
    for (const token of FENCED_TOKENS) {
      /* The port this deployment owns is a substring of nothing here, but a
         fenced token that IS this port would be a contradiction worth failing
         on rather than silently ignoring. */
      if (token === String(port)) continue;
      if (cmd.includes(token)) {
        reasons.push(`the listener's command line names ${token}, which this deployment must not touch`);
      }
    }
  }

  /* Ancestry: it has to be a child of the PM2 daemon that is running now. This
     is what distinguishes a process this deployment system started from any
     other Next server that could be pointed at the same directory. */
  if (!Number.isFinite(daemonPid) || daemonPid <= 0) {
    reasons.push("the PM2 daemon could not be identified, so ancestry cannot be proved");
  } else if (listenerPid === daemonPid) {
    reasons.push("the listener is the PM2 daemon itself and must never be killed");
  } else if (!chain.includes(daemonPid)) {
    reasons.push(
      `the listener is not a descendant of PM2 daemon ${daemonPid} (chain ${chain.join(" < ")})`
    );
  }

  if (reasons.length > 0) return { recover: false, reasons };

  return { recover: true, reasons: [], targetPid: listenerPid };
}

/* --- CLI ------------------------------------------------------------------ */

const invokedDirectly =
  process.argv[1] &&
  process.argv[1].replace(/\\/g, "/").endsWith("deploy/orphan-recovery.mjs");

if (invokedDirectly) {
  const [
    repoRoot,
    port,
    listenerPid,
    supervised,
    pm2Status,
    managedPid,
    daemonPid,
    ancestryCsv,
    imageName,
    ...commandLineParts
  ] = process.argv.slice(2);

  const verdict = evaluateOrphanRecovery({
    repoRoot,
    port: Number(port),
    listenerPid: Number(listenerPid),
    supervised: String(supervised).toLowerCase() === "yes",
    pm2Status,
    managedPid: Number(managedPid),
    daemonPid: Number(daemonPid),
    ancestry: String(ancestryCsv ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number),
    imageName,
    /* The command line contains spaces and arrives as the remaining argv. */
    commandLine: commandLineParts.join(" "),
  });

  const out = [`recover=${verdict.recover ? "yes" : "no"}`];
  for (const reason of verdict.reasons) out.push(`reason=${reason}`);
  if (verdict.recover) out.push(`target=${verdict.targetPid}`);
  console.log(out.join("\n"));
}
