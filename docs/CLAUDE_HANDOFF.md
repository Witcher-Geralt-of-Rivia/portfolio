<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Claude Handoff

> **IMPORTANT FOR CLAUDE**
>
> Do not rely on conversational memory for this project.
>
> Read the canonical repository documents before making changes.
>
> Frozen stages may not be redesigned without an explicit user instruction.
>
> When information conflicts, stop and report the conflict instead of guessing.

## Project

A technical portfolio built to demonstrate engineering capability to clients on
freelance platforms. Internal identity: **Intelligent Systems Lab**.

It is a technical portfolio, **not** a personal or social website. There is no
biography, no photograph, and no contact route of any kind.

## Mission

Three capability families: **AI Agents and Automation** (CRM, ERP, SaaS, APIs,
backend), **Web and Mobile + AI**, and **AI Education / Learning Systems**.

Within 5-10 seconds a visiting client should understand that this is advanced
systems engineering, not isolated screens.

## Non-Negotiable Rules

**No contact information, anywhere.** No email, telephone, WhatsApp, Telegram,
Discord, physical address, contact form, booking/calendar CTA, "Hire Me" or
"Let's Talk". This applies to visible UI, metadata, OpenGraph, JSON-LD, HTML
comments, example data, hidden accessibility text and source comments.

**No paid AI runtime.** No OpenAI, Anthropic/Claude, or Gemini API. No AI API
key, no `.env` requirement for AI, no hosted inference dependency. Future AI
demonstrations must be deterministic local simulations, static JSON, scripted
sequences or client-side interaction.

**No backend.** No database server, API route, server action or external
persistence service. The demo platform stores synthetic data in the browser
through IndexedDB; D-046 records why that is not a departure.

Both rules hold until the user explicitly changes them. See
`docs/PRIVACY_AND_SECURITY.md`.

## Technology

| Item | Value |
|---|---|
| Framework | Next.js 16.3.3 (App Router, Turbopack), React 19.2.8 |
| Runtime | Node v24.19.0 / npm 11.17.0 |
| Language | TypeScript (strict), ESLint 9 |
| Fonts | `geist` ^1.7.2, self-hosted variable WOFF2 via `next/font/local` |
| Styling | Plain CSS with design tokens. No Tailwind, no CSS-in-JS |
| Animation | CSS and SVG only. No GSAP/Motion/Three.js/D3/Lottie |
| Backend | None. No database, API route or server action |
| QA | Playwright + pngjs (devDependencies), scripts in `qa/` |

Rendering is almost entirely server-side; 88 `"use client"` modules exist, most
of them in the Operations interface, and `docs/project-state.json` holds the
list. Everything else is server-rendered markup and CSS.

## Current Runtime

Windows Server VPS, shared with another application on port 3200.

```
dev preview   npm run dev:remote      http://108.186.112.75:3000
production    https://intelligent-systems-lab.duckdns.org
              Caddy v2.11.4 -> 127.0.0.1:3100 (PM2 app "portfolio")
local prod    npx next start --port 3001   (QA only; 3200 is not ours)
```

**Deploy with `npm run deploy:safe`. Nothing else.** Production serves an
alternating release slot (`.next-release-a` / `.next-release-b`), never the
default `.next`, so an ordinary `npm run build` cannot touch it. See
`docs/DEPLOYMENT.md`.

`next.config.ts` sets `allowedDevOrigins` to the VPS IP plus `localhost` and
`127.0.0.1`. Without those entries Next 16 returns 403 for `/_next/*` dev assets
from a non-localhost origin. Do not remove them. It is development-only and the
production domain is deliberately not listed. See `docs/DEPLOYMENT.md`.

## Frozen Stages

Stages 01-08 are complete, QA-verified and **frozen**. Do not redesign them.

```
01 background (aurora, prism, grain, 3 surfaces)   05 systems architecture lab
02 typography (Geist Sans + Mono, scale, roles)    06 product engineering studio
03 navigation + SiteShell                          07 AI learning adaptive lab
04 hero + Intelligence Constellation               08 engineering lab
```

Details in `docs/PROJECT_STATE.md`. History in `docs/CHANGELOG.md`.

## Design Identity

The approved logo at `logo.png` is canonical source artwork, never modified or
served; sizes are derived by `qa/brand-derive.mjs` (D-054).

**Intelligent Systems Lab**: premium, bright, soft, technical, calm, futuristic,
precise, advanced engineering.

Colours are soft, bright, milky, multi-hue and continuously transitioning. The
background never reads as plain white and never becomes dark.

Forbidden drift: plain white, dark cyberpunk, neon, generic purple gradient,
generic glassmorphism, gaming UI, crypto UI. Full anti-pattern list in
`docs/DESIGN_SYSTEM.md`.

## Current Site Structure

Two routes:

- **`/`**: hero (`#hero`), the four capability sections `#systems` (05),
  `#products` (06), `#ai-learning` (07), `#lab` (08), then `#work`, which is
  `FeaturedDemoSection`: it publishes Demo 01 as a disclosed engineering demo
  and is **not** the gated case-study section (D-098). Ends in `SiteFooter`.
- **`/specimen`**: Stage 02 typography specimen, unlinked, kept verifiable.
`/demos/operations` and its ten module routes are the Operations demo: `noindex, nofollow`, linked from `#work`. `/demos` is a 404.

Source is public at `github.com/Witcher-Geralt-of-Rivia/portfolio`, branch `main`. Push every verified commit and tag after its stage's QA and verify the remote SHA; run `node qa/public-repo-safety.mjs --history` first. Never let a secret enter history, and do not rewrite it.

Navigation destinations are exactly: Systems, Products, AI Learning, Lab, Work.
There is deliberately no Contact, Hire Me, About, Blog or social link.

## Current Components

```
src/components/
  layout/SiteShell.tsx            background + navigation + <main> content frame
  visual/{AuroraBackground,PrismLight,GrainOverlay}.tsx   background layers A-D
  navigation/SiteNavigation.tsx   CLIENT - navigation state and observers
  navigation/{DesktopNavigation,MobileNavigation,SystemMarkImage}.tsx
  navigation/nav-items.ts         single source for the five destinations
  hero/{Hero,IntelligenceConstellation,CapabilityRail}.tsx
  hero/constellation-geometry.ts  node/link maths, evaluated at build time
  learning/  07 - LearningLab; knowledge map, learner and tutor panels
  systems/   05 - ArchitectureLab; canvas, trace, principles; four modes
  products/  06 - ProductStudio; web/mobile/assist surfaces, event rail
  lab/       08 - LabWorkspace; flow, experiment views, observation, controls
  work/      FeaturedDemoSection + FeaturedPreview own #work; the 09
             case-study renderers are here too, built and still not wired in
  certifications/  built, mounted, renders nothing: no credential exists
  demos/     09A - DemoShell, DemoDisclosure, DemoResetControl
src/demo-runtime/   09A - shared demo platform; see docs/DEMO_PLATFORM.md
```

Each capability directory has the same shape: a server section shell, one
CLIENT lab, one CLIENT ARIA tablist, presentational renderers and a data
module. Full tree in `docs/ARCHITECTURE.md`.

## Current QA Status

All stages PASS; evidence and numbers in `docs/QA_BASELINE.md`. Headline
invariants: CLS 0 at every tested viewport, zero third-party requests, zero
horizontal overflow, zero console errors, all meaningful text at or above
WCAG AA.

## Known Intentional Deviations

These are deliberate and evidence-backed. **Do not "fix" them** without new
measurements showing the original approach is better. Reasons in
`docs/DECISIONS.md`.

- Display measures use calibrated `em`, not `ch` (`ch` caused font-swap CLS).
- Constellation chips are HTML over SVG, with no `backdrop-filter`.
- Cross-link routing bows asymmetrically, avoiding a wireframe-orb look.
- Mobile capability rail drops its vertical dividers; `:has()` zeroes the
  shell's top padding for the hero and hides site chrome on demo routes.
- No scroll cue; no forced `<br>` in the hero heading.
- No navigation item is active while the hero owns the viewport.
- Architecture gradients use `userSpaceOnUse` (the default degenerates on
  horizontal paths); the trace drops below the canvas at 1149px, not 999px.
- The demo runtime hand-rolls IndexedDB (D-047); a three-demo launcher waits
  for all three (D-050), which is why `#work` publishes one flagship instead
  (D-098); the action queue leads with the most urgent item (D-055).

Each is an entry in `docs/DECISIONS.md` with its measured reason.

## Infrastructure State

| Item | State |
|---|---|
| Git | Repository initialised. Branch `main`. Tags: `portfolio-production-v1`, `portfolio-safe-deployment-v1`, and `portfolio-stage-0N-verified` for stages 04-08 |
| Production | LIVE at `https://intelligent-systems-lab.duckdns.org` |
| Dev preview | `npm run dev:remote` on `0.0.0.0:3000`, still available |
| Host firewall | 80/443 allowed; 3000 allowed; 3100 has no inbound rule |
| Provider firewall | Reachable on 443 - proven by external ACME validation |
| Domain / TLS | DuckDNS A record to 108.186.112.75; Caddy automatic HTTPS |
| Reverse proxy | Caddy v2.11.4, shared with another project - append only |
| Deployment | `npm run deploy:safe` - PM2 app `portfolio` on `127.0.0.1:3100`, alternating release slots, smoke test, auto-rollback |

The VPS already hosts other services. Read the safety rules in
`docs/DEPLOYMENT.md` before touching any server configuration.

## Files That Are Canonical

| Question | File |
|---|---|
| Fast orientation | `docs/CLAUDE_HANDOFF.md` (this file) |
| What exists right now | `docs/PROJECT_STATE.md` |
| Visual language and anti-patterns | `docs/DESIGN_SYSTEM.md` |
| Code structure and principles | `docs/ARCHITECTURE.md` |
| Why something is the way it is | `docs/DECISIONS.md` |
| Verified QA numbers and evidence | `docs/QA_BASELINE.md` |
| Hard restrictions | `docs/PRIVACY_AND_SECURITY.md` |
| Runtime and server state | `docs/DEPLOYMENT.md` |
| Demo platform architecture | `docs/DEMO_PLATFORM.md` |
| Demo 01 product contract | `docs/DEMO_OPERATIONS_SPEC.md` |
| Demo 01 implementation | `docs/DEMO_OPERATIONS_IMPLEMENTATION.md` |
| Stage history | `docs/CHANGELOG.md` |
| What to do next | `docs/NEXT_STAGE.md` |
| Machine-readable state | `docs/project-state.json` |

Raw design values live in `src/styles/tokens.css`. Docs must not duplicate it.

## Current Task Status

Stages 01-08 complete and frozen; the site is live over HTTPS. Stage 09 is **in
progress**: 09A froze the shared runtime, 09B froze Demo 01's contract, and 09C
built all eleven Operations modules. 09D0 hardened the deployment gate so a run
cannot report SUCCESS unless the intended PM2 process owns the listener (D-097).
The landing page finalization then gave `#work` its flagship section and the
page an ending. Demo 02 and 03 are unbuilt; `currentStage` stays 8.

## Next Allowed Task

**Demo 02 - Field Operations.** Its product specification must be frozen first,
the way 09B froze Demo 01's. See `docs/NEXT_STAGE.md`. Every external review so
far has found defects the suite had no opinion about (D-062, D-067, D-099).

Do not begin it automatically.

The site is public: anything shipped is immediately visible. Follow the update
procedure in `docs/DEPLOYMENT.md` and never point the domain at `next dev`.

## Forbidden Actions

- Redesigning any frozen stage without an explicit user instruction
- Adding contact information, a paid AI provider, or a server backend
- Installing an animation, chart, icon, state or image library
- Configuring DNS, HTTPS, Certbot, nginx, Caddy, IIS or Apache uninvited
- Altering ports 80/443 or existing web-server configuration on the VPS
- Removing the QA harness (`qa/`, `playwright`, `pngjs`)
- Breaking `npm run dev`, `npm run dev:remote` or `npm run build`
- Deploying by hand (`npm run build && pm2 restart portfolio`) instead of
  `npm run deploy:safe`
- Pointing production at `.next`

## Session Bootstrap Procedure

Run this before editing anything:

1. Read, in order: this file, then `PROJECT_STATE.md`, `DESIGN_SYSTEM.md`,
   `DECISIONS.md`, `QA_BASELINE.md`, `PRIVACY_AND_SECURITY.md`,
   `NEXT_STAGE.md` (all under `docs/`)
2. `git status` and `git log --oneline -10`
3. Inspect the files relevant to the requested task

### Conflict rule

If repository documents contradict **each other**: STOP, report the conflicting
statements, and do not edit product code until the user resolves it. If they
contradict **the code**: inspect `git log` to judge which is stale and report the
discrepancy. If a conversation statement contradicts canonical documentation,
the repository wins. Never silently pick whichever is convenient.

### When the user supplies a new Stage specification

1. Reload the canonical docs
2. Compare the request against frozen constraints
3. Report any conflict before writing code
4. Implement only the requested stage
5. Run regression QA on previous stages
6. Update the canonical state docs
7. Stop

## Session Close Procedure

At the end of any significant task, update **only** the documents whose
information actually changed:

- `docs/PROJECT_STATE.md` - if what exists changed
- `docs/DECISIONS.md` - if a decision was made or reversed
- `docs/QA_BASELINE.md` - if QA results changed
- `docs/CHANGELOG.md` - always, for a completed stage
- `docs/NEXT_STAGE.md` - if the next task changed
- `docs/project-state.json` - if stage or constraints changed
- `docs/CLAUDE_HANDOFF.md` - if any summary above is now wrong

Then run `npm run qa:memory` to confirm the documents remain internally
consistent. Do not rewrite documents that did not change.
