// Portfolio production process definition for PM2.
//
// PM2 is the existing process-management standard on this host: the other
// application and Caddy itself both run under it, resurrected at logon by
// pm2-windows-startup. This file follows that same pattern.
//
// It contains NO secrets. The portfolio has no database, no API key and no
// AI provider, so unlike the other project's process file this one is safe
// to keep in the repository.
//
// PRODUCTION NEVER SERVES `.next`.
//
// It serves one of two alternating release slots, so that an ordinary
// `next build` — which writes `.next` — cannot touch the files the running
// production process is reading. That failure took the live site down twice
// during Stage 05. The slot is supplied through PORTFOLIO_DIST_DIR and is
// validated here as well as in next.config.ts; `.next` is deliberately NOT
// an accepted value for production.
//
// Deploy with:  npm run deploy:safe
// Never with:   npm run build && pm2 restart portfolio

const ALLOWED_RELEASE_SLOTS = [".next-release-a", ".next-release-b"];

const slot = (process.env.PORTFOLIO_DIST_DIR || "").trim();

if (!ALLOWED_RELEASE_SLOTS.includes(slot)) {
  throw new Error(
    `PORTFOLIO_DIST_DIR must be one of ${ALLOWED_RELEASE_SLOTS.join(", ")} — received ` +
      `"${slot || "(unset)"}". Production must not run from .next; use deploy/safe-deploy.ps1.`
  );
}

module.exports = {
  apps: [
    {
      name: "portfolio",
      cwd: "C:/E_DRIVE/portfolio",
      script: "node_modules/next/dist/bin/next",
      interpreter: "C:/Program Files/nodejs/node.exe",
      // Bound to loopback only. Public access is via Caddy, which
      // terminates TLS and reverse-proxies to this port.
      args: "start -p 3100 -H 127.0.0.1",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      env: {
        NODE_ENV: "production",
        PORTFOLIO_DIST_DIR: slot,
      },
    },
  ],
};
