<!-- PROJECT_STAGE: 5 -->
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
freelance platforms. Internal identity: **Milky Intelligence**.

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

Rendering is almost entirely server-side. The **only** client component in the
project are `src/components/navigation/SiteNavigation.tsx` and
`src/components/systems/ArchitectureLab.tsx` (plus the two presentational
modules the lab imports).

## Current Runtime

Development preview on a Windows Server VPS:

```
npm run dev:remote     # next dev --hostname 0.0.0.0 --port 3000
http://108.186.112.75:3000
```

Production, live:

```
https://intelligent-systems-lab.duckdns.org
Caddy v2.11.4  ->  127.0.0.1:3100  (PM2 app "portfolio")
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

Stages 01-05 are complete, QA-verified and **frozen**. Do not redesign them.

| Stage | Scope | Status |
|---|---|---|
| 01 | Background: aurora, prism, grain, 3 surfaces | FROZEN |
| 02 | Typography: Geist Sans + Mono, scale, text roles | FROZEN |
| 03 | Navigation + SiteShell | FROZEN |
| 04 | Hero + Intelligence Constellation | FROZEN |
| 05 | Intelligent Systems architecture lab | FROZEN |

Details in `docs/PROJECT_STATE.md`. History in `docs/CHANGELOG.md`.

## Design Identity

**Milky Intelligence** — premium, bright, soft, technical, calm, futuristic,
precise, advanced engineering.

Colours are soft, bright, milky, multi-hue and continuously transitioning. The
background never reads as plain white and never becomes dark.

Forbidden drift: plain white, dark cyberpunk, neon, generic purple gradient,
generic glassmorphism, gaming UI, crypto UI. Full anti-pattern list in
`docs/DESIGN_SYSTEM.md`.

## Current Site Structure

Two routes:

- **`/`** — hero (`#hero`), then the Stage 05 Intelligent Systems section
  (`#systems`), then four remaining anchor sections: `#products`,
  `#ai-learning`, `#lab`, `#work`.
  Those four are **QA placeholders only** — an eyebrow label and the words
  "Navigation specimen section". One stage replaces one placeholder; leave the
  others alone.
- **`/specimen`** — the Stage 02 typography specimen, kept so the type scale
  stays verifiable. Not linked from the site.

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
  hero/Hero.tsx
  hero/IntelligenceConstellation.tsx
  hero/CapabilityRail.tsx
  hero/constellation-geometry.ts  node/link maths, evaluated at build time
  systems/IntelligentSystemsSection.tsx   section shell (server)
  systems/ArchitectureLab.tsx     CLIENT - the section's only client component
  systems/{ArchitectureCanvas,ArchitectureModeSelector,ExecutionTrace,
           EngineeringPrinciples}.tsx
  systems/architecture-data.ts    four modes: nodes, links, traces
  systems/architecture-geometry.ts  orthogonal connection routing
```

Full tree and architectural principles in `docs/ARCHITECTURE.md`.

## Current QA Status

All four stages PASS. Baseline evidence and numbers in `docs/QA_BASELINE.md`.

Headline invariants: CLS 0 at every tested viewport, zero third-party requests,
zero horizontal overflow, zero console errors, all meaningful text at or above
WCAG AA.

## Known Intentional Deviations

These are deliberate and evidence-backed. **Do not "fix" them** without new
measurements showing the original approach is better. Reasons in
`docs/DECISIONS.md`.

- Display measures use calibrated `em`, not `ch` (`ch` caused font-swap CLS).
- Constellation chips are HTML over SVG, with no `backdrop-filter`.
- Cross-link routing bows asymmetrically, avoiding a wireframe-orb look.
- Mobile capability rail drops its vertical dividers.
- `.site-main:has(.hero)` zeroes the shell's top padding.
- No scroll cue; no forced `<br>` in the hero heading.
- No navigation item is active while the hero owns the viewport.
- Architecture gradients use `userSpaceOnUse` (the default degenerates on
  horizontal paths); the trace drops below the canvas at 1149px, not 999px.

Each is an entry in `docs/DECISIONS.md` with its measured reason.

## Infrastructure State

| Item | State |
|---|---|
| Git | Repository initialised. Branch `main`. Tags `portfolio-stage-04-verified`, `portfolio-production-v1`, `portfolio-stage-05-verified` |
| Production | LIVE at `https://intelligent-systems-lab.duckdns.org` |
| Dev preview | `npm run dev:remote` on `0.0.0.0:3000`, still available |
| Host firewall | 80/443 allowed; 3000 allowed; 3100 has no inbound rule |
| Provider firewall | Reachable on 443 - proven by external ACME validation |
| Domain / DNS | DuckDNS A record to 108.186.112.75 |
| HTTPS / TLS | Caddy automatic HTTPS (Let's Encrypt) |
| Reverse proxy | Caddy v2.11.4, shared with another project - append only |
| Production deploy | COMPLETE (PM2 app `portfolio`, `127.0.0.1:3100`) |
| Deployment | `npm run deploy:safe` - alternating release slots, smoke test, auto-rollback |

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
| Stage history | `docs/CHANGELOG.md` |
| What to do next | `docs/NEXT_STAGE.md` |
| Machine-readable state | `docs/project-state.json` |

Raw design values live in `src/styles/tokens.css` - that file is the source of
truth for tokens. Documentation must not duplicate it.

## Current Task Status

Stages 01-05 complete and frozen. The persistent context system is complete and
the site is live over HTTPS. Stage 06 has **not** started.

## Next Allowed Task

**Stage 06 - Product Engineering / Web + Mobile + AI**, filling `#products`.
The user will supply that specification separately. See `docs/NEXT_STAGE.md`.

Do not begin it automatically.

The site is public now: anything shipped is immediately visible. Follow the
update procedure in `docs/DEPLOYMENT.md` and never point the domain at
`next dev`.

## Forbidden Actions

- Redesigning any frozen stage without an explicit user instruction
- Adding contact information of any kind
- Adding a paid AI provider, API key or hosted inference
- Adding a backend, database, API route or server action
- Installing GSAP, Motion, Three.js, React Three Fiber, D3, Lottie or Spline
- Configuring DNS, HTTPS, Certbot, nginx, Caddy, IIS or Apache in a task that
  did not ask for it
- Altering ports 80/443 or existing web-server configuration on the VPS
- Removing the QA harness (`qa/`, `playwright`, `pngjs`)
- Breaking `npm run dev`, `npm run dev:remote` or `npm run build`
- Deploying by hand (`npm run build && pm2 restart portfolio`) instead of
  `npm run deploy:safe`
- Pointing production at `.next`

## Session Bootstrap Procedure

Run this before editing anything:

1. Read `docs/CLAUDE_HANDOFF.md`
2. Read `docs/PROJECT_STATE.md`
3. Read `docs/DESIGN_SYSTEM.md`
4. Read `docs/DECISIONS.md`
5. Read `docs/QA_BASELINE.md`
6. Read `docs/PRIVACY_AND_SECURITY.md`
7. Read `docs/NEXT_STAGE.md`
8. `git status`
9. `git log --oneline -10`
10. Inspect the files relevant to the requested task

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
