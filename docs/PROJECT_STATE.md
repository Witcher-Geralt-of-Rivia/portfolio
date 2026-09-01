<!-- PROJECT_STAGE: 7 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Project State

Current truth. Historical narrative lives in `docs/CHANGELOG.md`.
Everything below was read from the repository, not recalled from conversation.

## Stage Status

```
Stages 01-07   COMPLETE and FROZEN
Deployment     LIVE at https://intelligent-systems-lab.duckdns.org
Stage 08       NOT STARTED
```

The next task is Stage 08 - Engineering Lab, filling `#lab`.
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

```
runtime  geist ^1.7.2, next 16.3.3, react 19.2.8, react-dom 19.2.8
dev      typescript ^5, eslint ^9, eslint-config-next 16.3.3,
         @types/{node ^20,react ^19,react-dom ^19}
         playwright ^1.62.1 + pngjs ^7.0.0   QA harness - do not remove
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
presentations are server components. Seven `"use client"` modules exist:
`navigation/SiteNavigation.tsx` (compact menu state, focus management,
active-section tracking via IntersectionObserver, Escape handling, body scroll
lock), plus one lab and one stateless ARIA tablist for each built capability
section. `project-state.json` holds the authoritative list.

No `requestAnimationFrame` loop and no pointer tracking runs anywhere. The only
timers are the user-triggered Stage 06 flow and Stage 07 adapt sequences, each
a single interval torn down on scenario change, restart and unmount - see D-035
and D-042. Nothing animates on a timer at rest.

## Routes

| Route | Purpose | Rendering |
|---|---|---|
| `/` | Hero + five navigation anchor sections | Static (prerendered) |
| `/specimen` | Stage 02 typography specimen, unlinked | Static (prerendered) |

Section ids on `/`: `hero`, `systems`, `products`, `ai-learning`, `lab`, `work`.
`#systems` (05), `#products` (06) and `#ai-learning` (07) are real sections.
`#lab` and `#work` are still Stage 03 QA placeholders with no real content.

## Source Tree

```
src/
  app/
    layout.tsx            root layout, loads Geist, renders SiteShell
    globals.css           composition root; imports every stylesheet
    page.tsx, page.css    hero + anchor sections
    specimen/page.tsx     typography specimen
    specimen/page.css
  components/
    layout/SiteShell.tsx
    visual/{AuroraBackground,PrismLight,GrainOverlay}.tsx
    navigation/SiteNavigation.tsx      "use client"
    navigation/{DesktopNavigation,MobileNavigation,SystemMarkImage}.tsx
    navigation/nav-items.ts
    hero/{Hero,IntelligenceConstellation,CapabilityRail}.tsx
    hero/constellation-geometry.ts
    systems/IntelligentSystemsSection.tsx    section shell (server)
    systems/ArchitectureLab.tsx              "use client"
    systems/ArchitectureModeSelector.tsx     full ARIA tablist
    systems/{ArchitectureCanvas,ExecutionTrace,EngineeringPrinciples}.tsx
    systems/architecture-{data,geometry}.ts  four modes; orthogonal routing
    products/ProductEngineeringSection.tsx   section shell (server)
    products/ProductStudio.tsx               "use client" - flow state machine
    products/ProductScenarioSelector.tsx     full ARIA tablist
    products/{WebProductSurface,MobileProductSurface,AiAssistSurface}.tsx
    products/{ProductEventFlow,ProductCapabilityRail}.tsx
    products/product-scenarios.ts            three scenarios + event rail
    learning/AILearningSection.tsx           section shell (server)
    learning/LearningLab.tsx                 "use client" - adapt state machine
    learning/LearningScenarioSelector.tsx    full ARIA tablist
    learning/{KnowledgeMap,LearnerStatePanel,TutorPanel}.tsx
    learning/{LearningJourney,LearningPrinciples}.tsx
    learning/learning-{scenarios,geometry}.ts  three scenarios; curved links
  styles/
    tokens.css            all design tokens - the source of truth for values
    typography.css        type roles and base elements
    motion.css            aurora/prism keyframes + reduced motion
    layers.css            four background layers + responsive behaviour
    surfaces.css          Milk / Frost / Prism
    navigation.css, hero.css, systems.css, products.css, learning.css

public/
  textures/micro-grain.svg    locally generated SVG turbulence tile
  marks/system-mark.svg       custom four-node system mark, 890 bytes

qa/                            Playwright QA harness (see QA_BASELINE.md)
docs/                          canonical project memory (this directory)
```

Stylesheet import order in `globals.css`: tokens, typography, motion, layers,
surfaces, navigation, hero, systems, products, learning.

## Stage 01 - Background (FROZEN)

Four fixed, inert layers painted behind all content:

| Layer | Element | z-index |
|---|---|---|
| A base surface | `.backdrop-base` | -4 |
| B aurora fields | `.aurora` | -3 |
| C prism light | `.prism` | -2 |
| D micro grain | `.grain` | -1 |

Backgrounds, the seven-hue aurora palette and the three surface recipes are
declared in `src/styles/tokens.css`, which is their source of truth. Layer A is
a 135deg gradient across the three background tones.

Six aurora fields are implemented in `src/styles/layers.css`, in the order
lavender, sky, mint, rose, peach and lemon-over-aqua, at 130-150px blur and
0.38-0.55 opacity. Cycles are 31-47s, all `ease-in-out`, `alternate`,
`infinite`, with negative delays so they never synchronise. Blur is static;
only `transform` and `opacity` animate.

Prism: two beams, 58s and 68s, opacity 0.22 and 0.16, beam B `soft-light`.

Grain: `/textures/micro-grain.svg`, 256px tile, opacity **0.024**, blend
**multiply**. Below roughly 0.021 the dither rounds away entirely, which is why
the value is not the lower figure originally sketched.

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

Desktop (>= 900px): a fixed, centred Frost bar on the geometry declared by the
`--nav-*` tokens; identity cluster reserves 210px; five links 40px tall.
Compact (< 900px): a 56px bar with a 40x40 trigger and a panel whose items are
74px tall, ordered along the hue wheel so the stack stays colourful. Exactly
one presentation is in the accessibility tree at a time; the other is
`display: none`.

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

A 640x640 viewBox around an ORCHESTRATOR centre: 8 principal nodes (Agents,
Automation, CRM / ERP, API, Data, Learning, Mobile, Web), 6 auxiliary nodes and
5 signals, of which 3 and 2 respectively hide below 500px, joined by 21
connections - 8 central spokes, 8 ring, 5 cross. 38 SVG shapes, 130 hero DOM
elements.

Implementation: HTML node chips positioned in percentages over an SVG
connection layer. Hover is CSS `:has()`, motion is CSS `offset-path` and
keyframes, and geometry is computed once in `constellation-geometry.ts` at
module scope so the browser receives finished path strings. No Canvas, WebGL,
animation library, AI API, or client JavaScript in the hero at all.

## Stage 05 - Intelligent Systems (FROZEN)

Section `#systems`, heading "From event to decision to execution."

The System Architecture Lab holds four modes - Agent Workflow (default),
Automation, CRM / ERP and SaaS Backend - of 9-10 nodes, 10-12 connections and 8
trace rows each, switched by a real ARIA tablist. Every mode is declared in
`architecture-data.ts`; there is no hand-built JSX per mode.

Implementation: SVG connections beneath HTML node surfaces, the Stage 04
pattern. Routing is soft-orthogonal with rounded turns and separated corridors
where links converge. Packets move on CSS `offset-path`; the mode transition,
node highlighting and trace stagger are all CSS. Below 700px the positioned
topology is replaced by a vertical execution flow built from the same data,
with the parallel band as a three-column row.

Nothing in this section reaches the network. Switching mode is local state over
static TypeScript. The trace timings are labelled LOCAL SIMULATION and are not
performance claims.

Desktop panel measures 1200x621 and is height-stable across all four modes.

## Stage 06 - Product Engineering (FROZEN)

Section `#products`, heading "One product. Every surface."

The Product Engineering Studio shows one product across four surfaces at once:
a web application frame, a phone, an AI-assist panel and the backend event
pipeline beneath. Three scenarios switch through a real ARIA tablist, each
declared in `product-scenarios.ts`; the surfaces are block renderers over that
data, not hand-built JSX per scenario.

| Scenario | Route | Web blocks | Phone blocks |
|---|---|---|---|
| Operations SaaS (default) | `/app/overview` | tiles, chart, rows, rows | cards |
| Commerce Platform | `/app/commerce` | tiles, cards, timeline, rows | card, progress, suggestion |
| Field Workflow | `/app/dispatch` | tiles, map, rows, rows | card, checklist |

`Run product flow` walks a seven-step local state machine across the six-stage
event rail (UI Event, API, Service, Data, Background Job, Sync), lighting each
stage and propagating into the phone and the assist panel. Measured at 300ms
per step, 2.18-2.21s end to end. The interval is torn down when the scenario
changes, the flow restarts or the component unmounts, so an abandoned run
leaves no stale state.

Every frame is authored in HTML and CSS: no screenshot, no device mockup, no
browser facsimile, no vendor chrome. The phone is a neutral container with a
sensor capsule - no camera, no notch clone, no manufacturer detail. Surfaces
stay anchored when the scenario changes - the phone holds one height (367px)
across all three - so only the contents transform.

Nothing here reaches the network: 0 requests across 15 flow runs and 30
scenario changes. The AI panel is provider-neutral with no input and no model,
labelled AI ASSIST / LOCAL SIMULATION; web frames are labelled DEMO DATA. These
are engineering simulations, not client work.

## Stage 07 - AI Learning Systems (FROZEN)

Section `#ai-learning`, heading "Learning paths that adapt."

The Adaptive Learning Laboratory shows a system changing its own next move:
learner state left, a knowledge model centre, a tutor surface right, the
learning journey beneath. Three scenarios switch through an ARIA tablist, each
declared in `learning-scenarios.ts` and rendered by one set of components.

Adaptive Tutor (default) draws a 15-node knowledge map over a 7-step journey;
Assessment Engine an 11-node evaluation graph over 6 steps; Learning Path
Builder an 8-milestone roadmap with 2 optional branches over 6 steps. All three
share the 520x340 viewBox and one renderer. Every scenario declares two
deterministic variants. `Adapt` walks a five-stage
reducer - analysing, selecting, assessing, feedback, updated - then swaps the
variant, so map states, highlighted route, journey position, mastery figures
and tutor brief all move together. Measured at 340ms per stage, 1.70s end to
end, then a 1.4s hold on "Path updated" before the control returns to "Adapt
again".

Knowledge state is never carried by colour alone: mastered, learning, gap and
locked each have their own ring pattern and core mark, and the legend names all
four in text. Link paths are computed at build time in `learning-geometry.ts`,
bowed away from the canvas centre so arcs stay clear of the labels.

Map type is sized in viewBox units and so shrinks with the container: the phone
view raises the label size and drops prerequisite labels and in-node codes
rather than render 8px type. Measured floor 9.38px at 360px.

Nothing here reaches the network: 0 requests across 20 adapt runs and 30
scenario changes. "Maya" is a fixture, the percentages are not measurements,
and the lab header carries LOCAL / DETERMINISTIC SIMULATION.

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
Release slots    .next-release-a / .next-release-b (.next is dev only)
Process manager  PM2, app name "portfolio"; Caddy automatic HTTPS
Dev preview      still available at http://108.186.112.75:3000
```

Update procedure: `npm run deploy:safe`. Caddy is untouched by a release.

## Known Gaps

- LCP timing: UNVERIFIED in the headless QA environment (see QA_BASELINE.md)
- Reboot survival relies on the host's existing PM2 logon-time resurrection,
  which fires at Administrator logon rather than at system boot. This affects
  every service on the host, not just the portfolio. Not reboot-tested, because
  another production domain is served from the same machine.
