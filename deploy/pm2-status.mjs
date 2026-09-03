/**
 * PM2 introspection for the deployment script.
 *
 * PowerShell 5.1's ConvertFrom-Json is case-insensitive about keys and throws
 * on `pm2 jlist` output, because a Windows process environment contains both
 * `username` and `USERNAME`. Node parses it without complaint, so the
 * deployment script asks this helper instead of parsing JSON itself.
 *
 * Prints one `key=value` per line. Never prints an environment value, and the
 * only thing it says about the environment is which key NAMES look like they
 * should not be in a long-lived production process.
 *
 * `pid` was added in 09D0. Without it a deployment cannot tell the process PM2
 * manages from an orphan holding the same port, which is the failure that made
 * a broken deployment report SUCCESS.
 *
 *   node deploy/pm2-status.mjs
 */

import { execSync } from "node:child_process";

const OUT = [];
const emit = (k, v) => OUT.push(`${k}=${v}`);

let app = null;
try {
  const list = JSON.parse(
    execSync("pm2 jlist", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] })
  );
  app = list.find((a) => a.name === "portfolio") ?? null;
} catch {
  emit("exists", "no");
  emit("error", "pm2-jlist-failed");
  console.log(OUT.join("\n"));
  process.exit(0);
}

if (!app) {
  emit("exists", "no");
  console.log(OUT.join("\n"));
  process.exit(0);
}

const env = app.pm2_env?.env ?? {};
const slot = (env.PORTFOLIO_DIST_DIR ?? "").trim();

emit("exists", "yes");
emit("status", app.pm2_env?.status ?? "unknown");
emit("restarts", app.pm2_env?.restart_time ?? 0);
emit("pm_id", app.pm_id);
/* The operating-system pid, not PM2's own index. This is what the deployment
   compares against whoever is actually holding the production port. A stopped
   or errored app has no pid, and 0 is the honest answer rather than blank. */
emit("pid", Number.isFinite(app.pid) && app.pid > 0 ? app.pid : 0);
/* Milliseconds since the current process started, so a caller can tell a
   settled process from one that has just been restarted underneath it. */
emit("uptime_ms", app.pm2_env?.pm_uptime ? Math.max(0, Date.now() - app.pm2_env.pm_uptime) : 0);
// Empty means the process predates the A/B system and is serving `.next`.
emit("slot", slot || "");
emit("node_env", env.NODE_ENV ?? "");

// Names only, never values.
const suspicious = Object.keys(env).filter((k) =>
  /^(CLAUDE|OPENAI|ANTHROPIC|GEMINI|AWS)|SECRET|TOKEN|PASSWORD|DATABASE|CREDENTIAL/i.test(k)
);
emit("suspicious", suspicious.join("|"));
emit("env_count", Object.keys(env).length);

console.log(OUT.join("\n"));
