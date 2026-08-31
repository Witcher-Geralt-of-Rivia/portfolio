<!-- PROJECT_STAGE: 5 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Project Changelog

Stage-level history. Current truth lives in `docs/PROJECT_STATE.md`; this file
records how the project got there. Full reasoning is in `docs/DECISIONS.md`.

---

## Stage 01 - Visual Foundation

Status: **Frozen**

### Summary
Established the Milky Intelligence atmosphere: a four-layer fixed background
(base gradient, six drifting aurora fields, two prism light sweeps, a micro-grain
dither) plus the three reusable surfaces. Scaffolded the Next.js App Router
project with TypeScript and no CSS framework.

### Files
`src/styles/tokens.css`, `motion.css`, `layers.css`, `surfaces.css`,
`src/app/globals.css`, `src/components/visual/{AuroraBackground,PrismLight,
GrainOverlay}.tsx`, `public/textures/micro-grain.svg`

### Notable during implementation
- The grain SVG initially rendered nothing: its comment contained a double
  hyphen, which is invalid inside an XML comment, so the tile never parsed.
- Grain opacity had to rise to 0.024; below about 0.021 the dither rounds away
  and gradient banding returns.
- Aurora field sizes were enlarged from the first pass, and the mobile stack was
  reordered to follow the hue wheel - stacking complementary hues in a narrow
  column cancelled them to grey (35 percent of the mobile page measured neutral).

### QA
6 viewports. Near-white at most 0.46 percent, 10-12 hue families, CLS 0,
compositor-only animation, reduced motion static and complete.

---

## Stage 02 - Typography

Status: **Frozen**

### Summary
Added Geist Sans and Geist Mono, self-hosted as variable WOFF2 through the
`geist` package and `next/font/local`. Built the full type scale, the technical
mono roles, and the text colour roles including the new accessible
`--text-annotation`.

### Files
`src/styles/typography.css`, `tokens.css` (extended), `src/app/layout.tsx`,
`globals.css`, `src/app/specimen/*` (typography specimen)

### Notable during implementation
- Zero third-party font requests; only two WOFF2 files reach the browser.
- CLS of 0.016-0.021 was traced to the `ch` unit, not to font loading: Geist's
  "0" is 19 percent wider than the metric-adjusted fallback, so `13ch` changed
  the display heading's line count on font swap. Display measures became
  calibrated `em`; CLS went to 0.0000.
- `--text-muted` was measured at 3.15:1 and removed from all meaningful text.

### QA
6 viewports, CLS 0.0000 in production, all text roles at or above WCAG AA.

---

## Stage 03 - Navigation and Site Shell

Status: **Frozen**

### Summary
Added the fixed desktop navigation, the compact bar and panel below 900px, the
custom system mark, and `SiteShell` as the global composition root. Introduced
the only client component in the project.

### Files
`src/components/navigation/*`, `src/components/layout/SiteShell.tsx`,
`src/styles/navigation.css`, `public/marks/system-mark.svg`,
`src/app/page.tsx` (anchor sections), `tokens.css` (nav tokens)

### Notable during implementation
- `scrollbar-gutter: stable` was added to `html` so locking body scroll for the
  compact menu cannot shift layout sideways.
- The typography specimen moved to `/specimen` so the Stage 02 regression tests
  kept a page to measure.
- Three apparent failures during QA turned out to be headless frame starvation,
  not application bugs. See the artefact notes in `docs/QA_BASELINE.md`.

### QA
6 viewports. Geometry, focus trap, Escape, scroll lock, focus return, active
section sequence with no flicker, CLS 0, zero third-party requests.

---

## Stage 04 - Hero and Intelligence Constellation

Status: **Frozen**

### Summary
Built the homepage hero and its signature artwork: eight capability nodes and an
orchestrator core, connected by 21 curved paths with five travelling signals.
Entirely server-rendered; hover uses CSS `:has()`, motion uses CSS `offset-path`
and keyframes.

### Files
`src/components/hero/{Hero,IntelligenceConstellation,CapabilityRail}.tsx`,
`src/components/hero/constellation-geometry.ts`, `src/styles/hero.css`,
`src/app/page.tsx`, `globals.css`, navigation components (identity anchor and
hero active-state change)

### Notable during implementation
- The first routing pass bowed every link outward, which rendered as a wireframe
  orb. Cross-links were reworked to bow asymmetrically.
- Node chips are HTML over the SVG so labels keep real pixel sizes on mobile.
- The mobile capability rail lost its vertical dividers after wrapping exposed
  misalignment.
- Navigation behaviour changed intentionally: no item is active while the hero
  owns the viewport, and the system mark became an anchor to `#hero`.

### QA
8 viewports (1024x768 and 430x932 added). CLS 0 everywhere, zero external
requests, no console errors, 30 seconds of motion with no lockstep, reset or
strobe, all hero text at or above WCAG AA.

---

## Infrastructure - Remote Preview

Status: **Active**

Configured `npm run dev:remote` binding `0.0.0.0:3000`, reachable at the VPS
public IP. Added `allowedDevOrigins` after discovering that Next 16 served 403s
for dev chunks to a real browser on the public IP while `curl` still returned
200. No firewall rule was created - port 3000 was already permitted.

---

## Infrastructure - Persistent Context System

Status: **Complete**

### Summary
Made the repository the canonical source of project memory, so a fresh or
context-compressed session can resume without conversational history.

### Files
`docs/CLAUDE_HANDOFF.md`, `PROJECT_STATE.md`, `DESIGN_SYSTEM.md`,
`ARCHITECTURE.md`, `DECISIONS.md`, `QA_BASELINE.md`,
`PRIVACY_AND_SECURITY.md`, `DEPLOYMENT.md`, `CHANGELOG.md`, `NEXT_STAGE.md`,
`docs/project-state.json`, `qa/project-memory-check.mjs`, root `CLAUDE.md`

### Notable
The project was **not** under version control. Git was initialised, and the
verified Stage 04 state was captured as a checkpoint commit and tagged
`portfolio-stage-04-verified` before any documentation was written.

No product code, styling or visual behaviour was changed.

---

## Infrastructure - Domain, HTTPS and Production Deployment

Status: **Complete**

### Summary
Published the verified Stage 04 portfolio at
`https://intelligent-systems-lab.duckdns.org` behind the host's existing Caddy
reverse proxy, with a Let's Encrypt certificate issued automatically. Deployment
did not change any application code or advance the design stage.

### What changed
```
repository:  package.json (start:portfolio script)
             deploy/pm2.portfolio.config.js (new, no secrets)
             qa/production-check.mjs (new)
             docs/* updated to record production state
external:    C:\ce-staging\Caddyfile - one site block appended
             backup: C:\ce-staging\Caddyfile.backup-20260831-070207
```

### Architecture
```
Internet -> Caddy v2.11.4 (80/443, shared)
              +-- appclubedaeconomia.com.br -> 127.0.0.1:3200  (unchanged)
              +-- intelligent-systems-lab.duckdns.org -> 127.0.0.1:3100  (new)
```

The Next.js production process runs under PM2 as `portfolio`, bound to loopback
only, with no public inbound firewall rule. The development preview on port 3000
remains available and was verified to coexist with production.

### Notable during implementation
- PM2 was already the host's process-management standard - it manages both the
  other application and Caddy itself - so the portfolio reuses it rather than
  introducing a second mechanism.
- Caddy was reloaded gracefully; its PID did not change and the other domain
  never dropped a request.
- A tooling environment variable leaked into the production process on first
  launch (PM2 inherits the starting shell's environment). The process was
  recreated with a clean environment and re-saved.
- External inbound reachability on 443 is proven by Let's Encrypt's tls-alpn-01
  validation, which connected from four public IPs.

### QA
Existing domain identical pre/post change. New domain: 200 over HTTPS, trusted
certificate, 308 redirect from HTTP, zero console errors, zero failed requests,
zero mixed content, zero third-party requests, all sensitive paths 404.

---

## Stage 05 - Intelligent Systems

Status: **Frozen**

### Summary
Replaced the `#systems` placeholder with the first real capability section: an
interactive System Architecture Lab holding four switchable topologies (Agent
Workflow, Automation, CRM / ERP, SaaS Backend), a deterministic execution
trace, and a four-item engineering principles strip.

### Files
`src/components/systems/*` (8 modules), `src/styles/systems.css`,
`src/app/page.tsx`, `src/app/globals.css` (import plus a visually-hidden
utility)

### Notable during implementation
- Modes are declarative data, not four JSX trees; positions are fixed and
  nothing uses randomness.
- Connections render as SVG beneath HTML node surfaces, the Stage 04 pattern,
  so labels keep real pixel sizes. Below 700px the topology becomes a vertical
  execution flow built from the same data.
- The flow gradient had to move to `userSpaceOnUse`: with the default units a
  horizontal path has a zero-height bounding box and the connection all but
  disappeared.
- Connection opacity was raised above the brief's range after visual review;
  at the suggested value the routing was invisible and the panel read as
  scattered cards.
- The trace column now collapses below the canvas at 1149px, because at 1024px
  the side column squeezed the canvas until Automation's four-node band
  overlapped.

### QA
Eight viewports PASS, CLS 0 everywhere, 20 mode transitions with no residue,
18 contrast roles PASS, full tablist keyboard behaviour, reduced motion static
and complete, zero external requests, zero console errors.

### Deployment
Shipped through the documented procedure: build then `pm2 restart portfolio`.
Caddy was not touched and its process was never restarted.

---

## Infrastructure - Safe A/B Production Deployment

Status: **Complete**

### Summary
Made the Stage 05 outage structurally impossible. Production now serves an
alternating release directory and never the default `.next`, so a build cannot
rewrite files the running process is reading.

### Files
`next.config.ts` (validated dynamic distDir), `deploy/safe-deploy.ps1`,
`deploy/pm2-status.mjs`, `deploy/pm2.portfolio.config.js`, `package.json`
(`deploy:safe`), `.gitignore`, `qa/deploy-continuity*.mjs`, docs

### What changed
```
.next            development and local builds (never served in production)
.next-release-a  production release slot
.next-release-b  production release slot

npm run deploy:safe   the only supported production deployment
```

`deploy:safe` runs 15 phases: preflight, slot selection with a hard
target-must-not-equal-active assertion, clean the inactive slot only, validate
(qa:memory + tsc + eslint), build, verify output, smoke-test on a loopback port,
switch PM2, public health check, automatic rollback on failure, and `pm2 save`
only after success. It is serialised by a named mutex and cleans up its smoke
server in a `finally` block.

### Notable during implementation
- Migrated production from legacy `.next` to `.next-release-a`, then proved
  alternation with a second deployment to `.next-release-b`.
- The rollback path was exercised for real, not just written.
- PowerShell 5.1 cannot parse `pm2 jlist` (duplicate `username`/`USERNAME`
  keys), so PM2 introspection moved to a small Node helper.
- The deployment strips `CLAUDE*` variables before invoking PM2; the production
  process environment is now two variables instead of 69.
- Next.js appends per-slot type paths to `tsconfig.json` on first build into
  each slot; this settles once both slots exist.

### QA
Accidental plain build: 255/255 public requests 200. Inactive-slot build:
327/327 200. Rollback drill: restored correctly, public healthy, exit 1.
Caddy hash unchanged and its process never restarted. Stages 01-05 regression
all PASS - no visual change.
