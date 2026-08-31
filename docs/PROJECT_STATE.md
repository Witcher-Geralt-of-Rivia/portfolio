<!-- PROJECT_STAGE: 5 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Project State

Current truth. Historical narrative lives in `docs/CHANGELOG.md`.
Everything below was read from the repository, not recalled from conversation.

## Stage Status

```
Stages 01-05   COMPLETE and FROZEN
Deployment     LIVE at https://intelligent-systems-lab.duckdns.org
Stage 06       NOT STARTED
```

The next task is Stage 06 - Product Engineering, filling `#products`.
See `docs/NEXT_STAGE.md`.

## Toolchain

| Item | Value |
|---|---|
| Framework | Next.js 16.3.3 |
| Router | App Router (`src/app`) |
| Bundler | Turbopack (Next default) |
| React / ReactDOM | 19.2.8 |
| Node | v24.19.0 |
| npm | 11.17.0 |
| TypeScript | ^5, `--noEmit` clean |
| ESLint | ^9 with `eslint-config-next` 16.3.3, clean |
| Platform | Windows Server 2022 |

## Dependencies

Runtime:

```
geist        ^1.7.2
next         16.3.3
react        19.2.8
react-dom    19.2.8
```

Development:

```
@types/node ^20, @types/react ^19, @types/react-dom ^19
eslint ^9, eslint-config-next 16.3.3, typescript ^5
playwright ^1.62.1        QA harness - do not remove
pngjs ^7.0.0              QA pixel analysis - do not remove
```

There is no animation library, no UI kit, no icon package, no CSS framework and
no AI SDK. That is intentional.

## Scripts

```
dev          next dev
dev:remote   next dev --hostname 0.0.0.0 --port 3000
build        next build
start        next start
lint         eslint
qa:memory    node qa/project-memory-check.mjs
deploy:safe  powershell -NoProfile -ExecutionPolicy Bypass -File deploy/safe-deploy.ps1
```

`deploy:safe` is the only supported production deployment path. Production
serves an alternating release slot and never the default `.next`, so a plain
`npm run build` cannot disturb the live site.

## Rendering Architecture

Server-first. The entire hero, the whole background system and both navigation
presentations are server components.

Two `"use client"` entry points exist:

- `src/components/navigation/SiteNavigation.tsx` - compact menu state, focus
  management, active-section tracking via IntersectionObserver, Escape
  handling, body scroll lock.
- `src/components/systems/ArchitectureLab.tsx` - the architecture mode and the
  hovered/focused node. Everything visual below it is CSS.

No `requestAnimationFrame` loop, no `setInterval` animation and no pointer
tracking runs anywhere in the project.

## Routes

| Route | Purpose | Rendering |
|---|---|---|
| `/` | Hero + five navigation anchor sections | Static (prerendered) |
| `/specimen` | Stage 02 typography specimen, unlinked | Static (prerendered) |

Section ids on `/`: `hero`, `systems`, `products`, `ai-learning`, `lab`, `work`.
`#systems` is the real Stage 05 section. The remaining four are still Stage 03
QA placeholders with no real content.

## Source Tree

```
src/
  app/
    layout.tsx            root layout, loads Geist, renders SiteShell
    globals.css           composition root; imports every stylesheet
    page.tsx              hero + anchor sections
    page.css              anchor section styling
    specimen/page.tsx     typography specimen
    specimen/page.css
  components/
    layout/SiteShell.tsx
    visual/AuroraBackground.tsx
    visual/PrismLight.tsx
    visual/GrainOverlay.tsx
    navigation/SiteNavigation.tsx      "use client"
    navigation/DesktopNavigation.tsx
    navigation/MobileNavigation.tsx
    navigation/SystemMarkImage.tsx
    navigation/nav-items.ts
    hero/Hero.tsx
    hero/IntelligenceConstellation.tsx
    hero/CapabilityRail.tsx
    hero/constellation-geometry.ts
    systems/IntelligentSystemsSection.tsx    section shell (server)
    systems/ArchitectureLab.tsx              "use client"
    systems/ArchitectureCanvas.tsx
    systems/ArchitectureModeSelector.tsx     full ARIA tablist
    systems/ExecutionTrace.tsx
    systems/EngineeringPrinciples.tsx
    systems/architecture-data.ts             four modes
    systems/architecture-geometry.ts         orthogonal routing
  styles/
    tokens.css            all design tokens - the source of truth for values
    typography.css        type roles and base elements
    motion.css            aurora/prism keyframes + reduced motion
    layers.css            four background layers + responsive behaviour
    surfaces.css          Milk / Frost / Prism
    navigation.css        navigation geometry and states
    hero.css              hero layout, constellation, hero motion
    systems.css           Intelligent Systems section and architecture lab

public/
  textures/micro-grain.svg    locally generated SVG turbulence tile
  marks/system-mark.svg       custom four-node system mark, 890 bytes

qa/                            Playwright QA harness (see QA_BASELINE.md)
docs/                          canonical project memory (this directory)
```

Stylesheet import order in `globals.css`: tokens, typography, motion, layers,
surfaces, navigation, hero, systems.

## Stage 01 - Background (FROZEN)

Four fixed, inert layers painted behind all content:

| Layer | Element | z-index |
|---|---|---|
| A base surface | `.backdrop-base` | -4 |
| B aurora fields | `.aurora` | -3 |
| C prism light | `.prism` | -2 |
| D micro grain | `.grain` | -1 |

Backgrounds: `--background-base #f7f7fb`, `--background-warm #faf7f4`,
`--background-cool #f5f8fb`. Layer A is a 135deg gradient across those three.

Aurora palette: lavender `#e9e0ff`, sky `#dceeff`, aqua `#d9f4f3`,
mint `#ddf5e8`, rose `#f9dfeb`, peach `#fbe4d7`, lemon `#f8efc9`.

Six aurora fields as implemented in `src/styles/layers.css`:

| # | Colour | Blur | Opacity | Cycle |
|---|---|---|---|---|
| 1 | lavender | 140px | 0.55 | 31s |
| 2 | sky | 140px | 0.55 | 37s |
| 3 | mint | 150px | 0.45 | 43s |
| 4 | rose | 140px | 0.42 | 35s |
| 5 | peach | 130px | 0.38 | 47s |
| 6 | lemon over aqua | 140px | 0.38 | 41s |

All six use `ease-in-out`, `alternate`, `infinite`, with negative delays so they
never synchronise. Blur is static; only `transform` and `opacity` animate.

Prism: two beams, 58s and 68s, opacity 0.22 and 0.16, beam B `soft-light`.

Grain: `/textures/micro-grain.svg`, 256px tile, opacity **0.024**, blend
**multiply**. Below roughly 0.021 the dither rounds away entirely, which is why
the value is not the lower figure originally sketched.

Surfaces: `.surface-milk` `rgba(255,255,255,0.68)`, `.surface-frost`
`rgba(248,249,253,0.46)`, `.surface-prism` `rgba(255,255,255,0.60)`.

Under `prefers-reduced-motion: reduce` every field parks at a composed offset,
zero animations run, and the colour composition remains complete.

## Stage 02 - Typography (FROZEN)

Two families, both self-hosted, zero third-party font requests:

```
Geist Sans   geist/font/sans   Geist-Variable.woff2       69,652 bytes
Geist Mono   geist/font/mono   GeistMono-Variable.woff2   71,368 bytes
```

Both are variable WOFF2 (weight axis 100-900) loaded through `next/font/local`,
applied at `<html>` via `--font-geist-sans` and `--font-geist-mono`.
`next/font` emits preload links.

Working weights: 400 body, 450 lead, 500 UI, 520 subhead, 560 heading,
620 emphasis. The system has no 700+ tier.

### Text colour roles - important

```
--text-primary     #191b24    headings, important body and UI
--text-secondary   #515666    supporting paragraphs, lead copy
--text-annotation  #595e6c    captions, technical labels, metadata
--text-muted       #7c8190    decorative only
```

**`--text-muted` must NOT be used for meaningful small text.** It measures
approximately 3.2:1 against the live background, below WCAG AA. It is reserved
for decorative indexes and intentionally low-priority annotation.
`--text-annotation` is the accessible small-technical role and measures
5.2-6.4:1 in actual use.

### Display measure correction - intentional architecture

`--measure-display-1: 8.62em` and `--measure-display-2: 10.6em`.

These are **deliberately em, not ch**. The `ch` unit resolves against the
currently rendered font's "0" advance: 0.662em in Geist Sans against 0.555em in
the metric-adjusted fallback, a 19% gap. With `ch`, `13ch` meant 723px before the
font arrived and 862px after, changing the display heading's line count and
costing 0.016-0.021 CLS. The em values reproduce exactly 13 and 16 characters per
line in Geist while removing the dependency on which font is currently resolved.
Prose measures remain in `ch`, where no shift was measurable.

Do not revert these to `ch`. See decision D-006.

## Stage 03 - Navigation and Shell (FROZEN)

`SiteShell` composes the background layers, the navigation and a `<main>`
content frame. Content max width 1200px, gutters `clamp(20px, 5vw, 72px)`.

Desktop (>= 900px): fixed bar, 1060px max width, 64px tall, 18px from the top,
20px radius, z-index 100, centred, Frost surface at `rgba(248,249,253,0.53)`.
Identity cluster reserves 210px. Five links, 40px tall, 13px Geist Sans.

Compact (< 900px): 56px bar inset 12px, z-index 110, 18px radius, 40x40 menu
trigger. Panel fixed at top 78px and inset 12px, 28px radius,
`rgba(248,249,253,0.62)`, items 74px tall, labels `clamp(28px, 8vw, 36px)`.
Panel order follows the hue wheel so the compact stack stays colourful.

Exactly one navigation presentation is in the accessibility tree at a time; the
other is `display: none`.

Behaviours: IntersectionObserver active-section tracking with
`rootMargin: "-30% 0px -55% 0px"`, resolved in document order so only one item is
ever current; Escape closes the panel; focus moves into the panel on open and
returns to the trigger on close; Tab is confined to trigger plus panel links;
body scroll lock with `scrollbar-gutter: stable` on `html` so locking cannot
shift layout.

**No navigation item is active while the hero owns the viewport.** `activeId`
starts empty and clears when no section intersects. Systems becomes active only
on entering `#systems`.

The system mark plus wordmark is an anchor to `#hero` labelled
"Return to portfolio introduction". There is no visible Home link.

Deliberately absent: Contact, Hire Me, About, Blog, Resume, Testimonials,
Services and any social link.

## Stage 04 - Hero and Constellation (FROZEN)

Hero copy, exactly as implemented:

```
Eyebrow    AI Systems - Product Engineering - Learning Technology
           (rendered with middot separators)
Heading    Engineering intelligent systems.
Lead       AI agents, automation, SaaS, APIs, web, mobile and adaptive
           learning systems - engineered across interfaces, workflows,
           data and backend infrastructure.
Actions    Explore systems (#systems)   Selected work (#work)
Rail       01 Intelligent Systems  02 Product Engineering  03 AI Learning Systems
```

Both actions are internal anchors. There is no contact action.

Layout: `min-height: max(720px, 100svh)`; two columns
`minmax(0,0.92fr) / minmax(480px,1.08fr)` at >= 1100px; stacked below that with
text first; text column max 560px.

### Intelligence Constellation

```
viewBox              0 0 640 640
principal nodes      8    Agents, Automation, CRM / ERP, API, Data,
                          Learning, Mobile, Web
auxiliary nodes      6    (3 hidden below 500px)
connections          21   8 central spokes, 8 ring, 5 cross
signals              5    (2 hidden below 500px)
centre               ORCHESTRATOR
SVG shape elements   38
hero DOM elements    130
```

Implementation: HTML node chips positioned in percentages over an SVG connection
layer. Hover is CSS `:has()`. Motion is CSS `offset-path` for signals and CSS
keyframes for drift. No Canvas, no WebGL, no Three.js, no animation library, no
AI API, and no client JavaScript in the hero at all.

Geometry is computed once in `constellation-geometry.ts` at module scope, so the
browser receives finished path strings.

## Stage 05 - Intelligent Systems (FROZEN)

Section `#systems`, heading "From event to decision to execution."

The System Architecture Lab holds four modes, switched by a real ARIA tablist
with arrow-key navigation. Every mode is declared in `architecture-data.ts`;
there is no hand-built JSX per mode.

| Mode | Nodes | Connections | Trace rows |
|---|---|---|---|
| Agent Workflow (default) | 10 | 11 | 8 |
| Automation | 10 | 12 | 8 |
| CRM / ERP | 9 | 10 | 8 |
| SaaS Backend | 10 | 12 | 8 |

Implementation: SVG connections beneath HTML node surfaces, the Stage 04
pattern. Routing is soft-orthogonal with rounded turns and separated corridors
where links converge. Packets move on CSS `offset-path`; the mode transition,
node highlighting and trace stagger are all CSS.

Below 700px the positioned topology is replaced by a vertical execution flow
built from the same data, with the parallel band as a three-column row.

Nothing in this section reaches the network. Switching mode is local state over
static TypeScript. The trace timings are labelled LOCAL SIMULATION and are not
performance claims.

Desktop panel measures 1200x621 and is height-stable across all four modes.

## Assets

```
public/marks/system-mark.svg      890 bytes, viewBox 0 0 28 28, custom
public/textures/micro-grain.svg   locally generated feTurbulence tile
```

No stock imagery, no downloaded icons, no external image dependency.

## Deployment

The site is live. Full detail in `docs/DEPLOYMENT.md`.

```
Public URL       https://intelligent-systems-lab.duckdns.org
Reverse proxy    Caddy v2.11.4 (shared host infrastructure, another project's)
Internal bind    127.0.0.1:3100, loopback only, no public inbound rule
Release slots    .next-release-a / .next-release-b (alternating; .next is dev only)
Deploy command   npm run deploy:safe
Process manager  PM2, app name "portfolio"
Certificate      Caddy automatic HTTPS (Let's Encrypt)
Dev preview      still available at http://108.186.112.75:3000
```

Update procedure: `npm run deploy:safe`. Caddy is untouched by a release.

## Known Gaps

- Stage 05 section content: NOT STARTED
- LCP timing: UNVERIFIED in the headless QA environment (see QA_BASELINE.md)
- Reboot survival relies on the host's existing PM2 logon-time resurrection,
  which fires at Administrator logon rather than at system boot. This affects
  every service on the host, not just the portfolio. Not reboot-tested, because
  another production domain is served from the same machine.
