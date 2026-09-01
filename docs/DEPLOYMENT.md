<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Deployment

```
PRODUCTION STATUS: LIVE
https://intelligent-systems-lab.duckdns.org
```

Only verified state is recorded here. No secret, token, password or private key
belongs in this file.

## Production

| Item | Value |
|---|---|
| Public URL | `https://intelligent-systems-lab.duckdns.org` |
| Hostname | intelligent-systems-lab.duckdns.org (DuckDNS A record to 108.186.112.75) |
| Reverse proxy | Caddy v2.11.4 |
| Internal bind | `127.0.0.1:3100` (loopback only) |
| Deployment command | `npm run deploy:safe` |
| Active release slot | read from PM2 `PORTFOLIO_DIST_DIR` |
| Process manager | PM2, app name `portfolio` |
| PM2 config | `deploy/pm2.portfolio.config.js` (in this repo, contains no secrets) |
| Certificate | Caddy automatic HTTPS via Let's Encrypt ACME |
| HTTP behaviour | 308 redirect to HTTPS (Caddy automatic) |

The Next.js production server binds loopback only and has **no** inbound
firewall rule. All public traffic arrives through Caddy on 80/443.

## Host Environment

| Item | Value |
|---|---|
| Host OS | Windows Server 2022 |
| Public IPv4 | 108.186.112.75 (bound directly to the NIC, no NAT) |
| Runtime | Node v24.19.0 / npm 11.17.0 |

## Development Preview

Unchanged and still available alongside production:

```
npm run dev:remote      next dev --hostname 0.0.0.0 --port 3000
http://108.186.112.75:3000
```

```
3000  development preview   public inbound allowed (pre-existing rule)
3100  production            loopback only, no public inbound rule
```

Verified: the development server and the production server run concurrently
without interfering, and Caddy routes the domain only to production. The public
domain never points at `next dev`.

`allowedDevOrigins` in `next.config.ts` remains development-only. The production
domain is deliberately **not** added to it - production does not depend on it.

## Commands

```
npm run dev             local development (localhost only)
npm run dev:remote      remote preview on 0.0.0.0:3000
npm run build           production build
npm run start:portfolio production server on 127.0.0.1:3100 (manual; not a deploy)
npm run deploy:safe     THE production deployment command
npm start               plain next start (default port)
npm run lint            eslint
npm run qa:memory       canonical documentation consistency check
```

## Production Update Procedure

```
npm run deploy:safe
```

That is the whole procedure, and it is the ONLY supported way to update
production.

### Never do this

```
npm run build && pm2 restart portfolio      <-- NO
```

`npm run build` writes `.next`. Production does not serve `.next`, so a plain
build is now harmless — but it also does not deploy anything. Restarting PM2 by
hand skips validation, the smoke test and the rollback path.

### Why production never serves `.next`

During Stage 05 the live site broke twice because `next build` rewrote the same
`.next` directory the running production process was reading. The process then
served a page referencing chunks that had just been replaced, and returned 500s
until PM2 was restarted.

Production now alternates between two release directories:

```
.next            development and local builds  (never served in production)
.next-release-a  production release slot
.next-release-b  production release slot
```

A deployment always builds into the **inactive** slot. The running process reads
a directory the build never touches, so the failure mode is structurally
impossible rather than merely documented.

Measured proof: with production serving `.next-release-a`, a plain
`npm run build` ran to completion while the public site was polled continuously
— 255 of 255 requests returned 200 (page, CSS chunk and JS chunk).

### What deploy:safe does

```
 1 preflight            node/npm/pm2, PM2 process, port 3100, public health,
                        git tree (dirty aborts unless -AllowDirtyTree)
 2 determine slots      active read from PM2; target is the other one
                        hard assert: target must never equal active
 3 clean target only    active slot and .next are never touched
 4 validate             qa:memory, tsc --noEmit, eslint  (any failure aborts)
 5 build target
 6 verify output        BUILD_ID, server/, static/ present and non-empty
 7 smoke test           new release on the first free loopback port of
                        3199/3198/3197/3196: page, CSS, JS, both fonts, both
                        SVGs, and the markup of every built section - the ids
                        #systems, #products, #ai-learning and #lab, plus the
                        Stage 06, 07 and 08 headings. The heading is the
                        load-bearing half: a placeholder emits the id too
 8 switch               PM2 re-pointed at the target slot
 9 public health        up to 10 attempts, page + CSS + JS must all be 200
10 rollback on failure  previous slot restored automatically, then re-verified
11 pm2 save             only after the new release is proven healthy
```

Exit code is 0 only on full success. A successful rollback still exits non-zero,
because the intended deployment did not happen.

Useful flags:

```
-AllowDirtyTree            deploy with uncommitted changes (states them first)
-FailAfterSwitchForTest    rollback drill: forces the health check to fail
```

Deployment is serialised by a named mutex, so two runs cannot pick the same
"inactive" slot. Logs are written to `deploy/logs/` (gitignored).

### After a deployment

The previous slot is kept intact for fast rollback. Only the inactive slot is
cleaned, and only after the active slot has been confirmed.

## Caddy

| Item | Value |
|---|---|
| Executable | `C:\ce-staging\caddy-bin\caddy.exe` |
| Version | v2.11.4 |
| Config | `C:\ce-staging\Caddyfile` (Caddyfile adapter) |
| Managed by | PM2, app name `ce-staging-proxy` |
| Access log (portfolio) | `C:\ce-staging\caddy-access-portfolio.log` |

Caddy is **shared infrastructure owned by another project on this host.** The
portfolio only appends its own site block.

The portfolio site block routes explicitly by hostname, is never a default or
catch-all site, and mirrors the existing house style (two security headers plus
a rolling access log).

### Changing Caddy safely

```
1. back up:  copy Caddyfile to Caddyfile.backup-YYYYMMDD-HHMMSS (never overwrite one)
2. edit:     append only; do not reorder or reformat existing blocks
3. validate: caddy.exe validate --config C:/ce-staging/Caddyfile --adapter caddyfile
4. reload:   caddy.exe reload   --config C:/ce-staging/Caddyfile --adapter caddyfile
5. verify:   re-test the OTHER domain before declaring success
```

Use `caddy reload`, never a PM2 restart of `ce-staging-proxy`: reload keeps the
same process and does not interrupt the other site. The last reload left the
Caddy PID unchanged.

## Other Services on This Host - Do Not Disturb

| Port | Owner | Note |
|---|---|---|
| 80, 443 | Caddy (`ce-staging-proxy`) | shared - serves both domains |
| 3200 | another project's Next.js app (`ce-staging`) | loopback only - NOT ours |
| 3100 | this portfolio (`portfolio`) | loopback only - ours |
| 3000 | this portfolio's dev preview | ours |
| 5432 | PostgreSQL | listening on 0.0.0.0, no inbound rule admits it |
| 3389 | Remote Desktop | system |

The other project's PM2 process file lives outside its repository because it
holds live secrets. **Never read from, copy, or write to it.** The portfolio's
own PM2 file is separate and secret-free.

## Server Safety Rules

1. Inspect before changing - enumerate ports, sites, certificates, firewall rules.
2. Preserve existing domains. Another production domain is served from this host.
3. Preserve existing ports and services. Never stop or rebind what is not ours.
4. Back up any configuration before editing, with a timestamped name.
5. Use host-based routing. Never add a catch-all or default site.
6. Avoid destructive firewall changes. No range opening, no disabling.
7. Never force-renew or replace certificates belonging to other domains.
8. Prefer graceful reload over process restart for shared infrastructure.

## Process Persistence

PM2 is the existing standard on this host: the other application and Caddy
itself both run under it. The portfolio follows the same pattern.

```
reboot survival configured: YES (via the host's existing PM2 mechanism)
actual reboot test:         NOT PERFORMED
```

A reboot was deliberately not performed because another production domain is
served from this host. Persistence was validated structurally instead:
`pm2 save` wrote the process list to `%USERPROFILE%\.pm2\dump.pm2`, and
`pm2-windows-startup` is registered in the `HKCU\...\Run` key to resurrect it.

**Known limitation, inherited from the host's existing setup:** that Run key
fires at *Administrator logon*, not at system boot. An unattended reboot with no
logon would leave PM2 - and therefore both this portfolio and the pre-existing
application - not running. This is the host's current behaviour for every
service, not something introduced by the portfolio. Converting PM2 to a true
boot-time service would affect the other project too and was not done
unilaterally.

## DNS

`intelligent-systems-lab.duckdns.org` is a DuckDNS record resolving to
108.186.112.75. It was already configured before this deployment and required no
change.

No DuckDNS token is stored in this repository, and none is required for normal
operation. If dynamic IP updating is ever needed, the token must live outside
the repository.

## Verified Reachability

```
LOCAL SERVER TEST:              PASS  (127.0.0.1:3100 returns 200)
LISTENING ON PUBLIC INTERFACE:  PASS  (Caddy on 80/443)
HOST FIREWALL:                  PASS  (80/443 allowed; 3100 has no inbound rule)
PROVIDER FIREWALL:              PASS  (proven - see below)
EXTERNAL CLIENT TEST:           INDIRECT (see below)
```

Every request in QA originated on the VPS itself, so those tests do not by
themselves prove reachability from the outside internet. However, Let's Encrypt
completed a `tls-alpn-01` challenge for this hostname, which required inbound
connections from four public validation IPs to port 443 on this host, and the
certificate was issued. That is genuine external-reachability evidence for 443.
A visual check from the user's own browser is still worthwhile.
