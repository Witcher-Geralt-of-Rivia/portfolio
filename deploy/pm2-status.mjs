/**
 * PM2 introspection for the deployment script.
 *
 * PowerShell 5.1's ConvertFrom-Json is case-insensitive about keys and throws
 * on `pm2 jlist` output, because a Windows process environment contains both
 * `username` and `USERNAME`. Node parses it without complaint, so the
 * deployment script asks this helper instead of parsing JSON itself.
 *
 * Prints one `key=value` per line. Never prints an environment value.
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
