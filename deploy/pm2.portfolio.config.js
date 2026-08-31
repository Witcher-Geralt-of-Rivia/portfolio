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
// Start:    pm2 start deploy/pm2.portfolio.config.js
// Persist:  pm2 save
// Update:   npm run build  &&  pm2 restart portfolio

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
      },
    },
  ],
};
