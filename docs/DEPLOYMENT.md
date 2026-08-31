<!-- PROJECT_STAGE: 4 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Deployment

Only the **current, verified** environment is recorded here.

```
DOMAIN/HTTPS PRODUCTION CONFIGURATION:
NOT YET COMPLETED
```

## Current Environment

| Item | Value |
|---|---|
| Host OS | Windows Server 2022 |
| Public IPv4 | 108.186.112.75 (bound directly to the NIC, no NAT) |
| Runtime | Node v24.19.0 / npm 11.17.0 |
| Server | Next.js development server |
| Preview command | `npm run dev:remote` |
| Bind address | `0.0.0.0:3000` |
| Preview URL | `http://108.186.112.75:3000` |

The public IP was confirmed by three independent lookups agreeing with the NIC
address, so there is no NAT layer in front of the host.

## Commands

```
npm run dev          local development (localhost only)
npm run dev:remote   remote preview  - next dev --hostname 0.0.0.0 --port 3000
npm run build        production build
npm start            production server (next start)
npm run lint         eslint
npm run qa:memory    canonical documentation consistency check
```

Do not remove or repurpose `dev`, `dev:remote` or `build`.

## allowedDevOrigins

`next.config.ts`:

```ts
allowedDevOrigins: ["108.186.112.75", "localhost", "127.0.0.1"]
```

Next 16 returns 403 for `/_next/*` dev resources requested from an origin it does
not recognise. Without the VPS IP a real browser gets a blocked chunk and a dead
HMR socket while `curl` still returns 200 - so a naive smoke test passes while
the preview is actually broken. `127.0.0.1` is listed explicitly because Next's
default allowance covers the hostname `localhost` but not the literal loopback
address, which the QA harness uses.

This setting is development-only and has no effect on `next build` or
`next start`. If the public address ever changes, update this list.

## Firewall

Windows Defender Firewall is enabled on all three profiles. The active interface
is on the Public profile.

Inbound TCP 3000 is already permitted by a **pre-existing** rule named
`MY50POINTS-frontend-3000` (Allow, profile Any, remote Any, program Any). No
firewall rule was created for this project, and no rule was modified.

```
Provider firewall / security group:  UNVERIFIED
```

That cannot be tested from inside the VPS. If an external browser cannot reach
the preview while the host checks pass, the provider firewall is the remaining
variable: inbound TCP for the chosen port must be allowed.

## Other Services on This Host - Do Not Disturb

The VPS is shared. Observed at the time of writing:

| Port | Owner | Note |
|---|---|---|
| 80, 443 | Caddy | another project's reverse proxy - NOT ours |
| 3000 | node (this project's dev server) | ours |
| 5432 | PostgreSQL | listening on 0.0.0.0, no inbound firewall rule admits it |
| 3389 | Remote Desktop | system |

Nothing above except port 3000 belongs to this project, and nothing else was
modified.

## Server Safety Rules

Before any future deployment work:

1. **Inspect before changing.** Enumerate listening ports, existing sites,
   existing certificates and existing firewall rules first.
2. **Preserve existing domains.** Other sites are served from this host.
3. **Preserve existing ports and services.** Do not stop, rebind or reconfigure
   a service that is not ours.
4. **Back up affected web-server configuration** before editing it, and record
   where the backup went.
5. **Use host-based routing.** Add a virtual host / site block for the new
   domain rather than changing global configuration or default handlers.
6. **Avoid destructive firewall changes.** Add the minimum specific rule needed.
   Never disable a firewall, never open a range, never delete existing rules.
7. **Do not force-renew or replace certificates** belonging to other domains.

A reverse proxy already occupies 80 and 443. Any production setup for this
project must integrate with it as an additional site, not replace it.

## Not Configured

```
Domain name              NOT CONFIGURED
DNS records              NOT CONFIGURED
HTTPS / TLS certificate  NOT CONFIGURED
Reverse proxy site       NOT CONFIGURED for this project
Process manager          NOT CONFIGURED (no PM2, no Windows service)
Production hosting       NOT COMPLETED
```

The preview runs as a foreground development process and will not survive a
reboot. Restart it with `npm run dev:remote`.

## External Reachability

```
LOCAL SERVER TEST:              PASS (127.0.0.1 and localhost return 200)
LISTENING ON PUBLIC INTERFACE:  PASS (0.0.0.0:3000)
HOST FIREWALL:                  PASS (pre-existing allow rule)
PROVIDER FIREWALL:              UNVERIFIED
EXTERNAL CLIENT TEST:           REQUIRES THE USER'S BROWSER
```
