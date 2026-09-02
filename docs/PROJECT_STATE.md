<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Project State

Current truth. Historical narrative lives in `docs/CHANGELOG.md`.
Everything below was read from the repository, not recalled from conversation.

## Stage Status

```
Stages 01-08   COMPLETE and FROZEN
Deployment     LIVE at https://intelligent-systems-lab.duckdns.org
Stage 09       IN PROGRESS - through 09C4.0, 0 of 3 demos built
Demo 01        Overview + the three CRM modules DEPLOYED; rental core ready
```

Stage 09 changed direction: `#work` becomes a launcher into three
frontend-only product demos, not case studies. 09A froze the shared runtime;
09B froze Demo 01's contract; 09C1 built its domain; 09C2 built the shell and
Overview; 09C2.1 hardened both; 09C3 built the three CRM modules, Leads,
Customers and Inbox, with 09C3.1.1/09C3.1.2 hardening their controls. Seven
modules remain, `#work` is a placeholder,
and `currentStage` stays 8. See `docs/DEMO_OPERATIONS_IMPLEMENTATION.md` and
`docs/NEXT_STAGE.md`. The case-study framework and its one verified internal
case are preserved, unpublished; see `docs/CASE_STUDY_SOURCE_AUDIT.md`.

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

No animation library, UI kit, icon package, CSS framework or AI SDK, by
intent.

## Scripts

`dev`, `dev:remote` (0.0.0.0:3000), `build`, `start`, `start:portfolio`,
`lint`, `qa:memory`, `deploy:safe`. See `package.json`. `deploy:safe` is the
only supported production path: production serves an alternating release slot
and never the default `.next`, so `npm run build` cannot disturb the live site.

## Rendering Architecture

Server-first. The hero, the background system and both navigation presentations
are server components. Thirty-nine `"use client"` modules exist: nine on the
site, five in the demo platform and twenty-five in the Operations interface.
`project-state.json` holds the authoritative list.

No `requestAnimationFrame` loop and no pointer tracking runs anywhere. Timers
exist only inside the three user-triggered sequences - the Stage 06 flow, the
Stage 07 adaptation and the Stage 08 experiments - each torn down by effect
cleanup on scenario change, restart and unmount (D-035, D-042, D-044). Nothing
runs on a timer at rest.

## Routes

| Route | Purpose | Rendering |
|---|---|---|
| `/` | Hero + five navigation anchor sections | Static (prerendered) |
| `/specimen` | Stage 02 typography specimen, unlinked | Static (prerendered) |
| `/demos/operations` | Demo 01 shell + Overview, `noindex`, unlinked | Static page, client subtree |
| `/demos/operations/leads` | Demo 01 CRM pipeline, `noindex`, unlinked | Static page, client subtree |
| `/demos/operations/customers` | Demo 01 customer records, `noindex`, unlinked | Static page, client subtree |
| `/demos/operations/inbox` | Demo 01 conversations, `noindex`, unlinked | Static page, client subtree |

Section ids on `/`: `hero`, `systems`, `products`, `ai-learning`, `lab`, `work`.
`#systems` (05), `#products` (06), `#ai-learning` (07) and `#lab` (08) are real
sections. `#work` is the last Stage 03 QA placeholder. `/demos` is itself a
404 - the layout there has no page of its own.

## Source Tree

```
src/
  app/
    layout.tsx            root layout, loads Geist, renders SiteShell
    globals.css           composition root; imports every site stylesheet
    page.tsx, page.css    hero + anchor sections
    demos/layout.tsx      Stage 09A - demo frame, robots noindex
    demos/operations/     Stage 09C2 - the Operations demo route
    icon.png, apple-icon.png   derived from the approved logo.png
    specimen/page.tsx, page.css   typography specimen
  components/
    layout/SiteShell.tsx
    visual/{AuroraBackground,PrismLight,GrainOverlay}.tsx
    navigation/SiteNavigation.tsx      "use client"
    navigation/{DesktopNavigation,MobileNavigation,SystemMarkImage}.tsx, items
    hero/{Hero,IntelligenceConstellation,CapabilityRail}.tsx, geometry
    (each capability section below has the same shape: a server section
     shell, one "use client" lab holding the state, one "use client" ARIA
     tablist holding none, presentational renderers, and a data module)
    systems/    Stage 05 - ArchitectureLab; canvas, trace, principles;
                architecture-{data,geometry}.ts (4 modes)
    products/   Stage 06 - ProductStudio; web/mobile/assist surfaces, event
                rail, capability rail; product-scenarios.ts (three scenarios)
    learning/   Stage 07 - LearningLab; knowledge map, learner and tutor
                panels, journey; learning-{scenarios,geometry}.ts
    lab/        Stage 08 - LabWorkspace; flow, experiment views, observation,
                controls, pattern rail; lab-experiments.ts (5 experiments)
    work/       Stage 09 - case-study renderers; built, never wired in
    demos/      Stage 09A - DemoShell, DemoDisclosure, DemoResetControl,
                DemoSelect
  content/case-studies.ts   typed case-study model + render-safety filter
  demos/operations/         Stage 09C1 domain (21 modules) + ui/ (shell,
                sidebar, top bar, Overview panels, notifications, icons,
                module routes, leads/, customers/, inbox/). Overview and the
                three CRM modules are built; seven modules unbuilt.
  demo-runtime/             Stage 09A - shared demo platform (18 modules):
                types, config, demo-registry, clock, ids, repository,
                async-service, events, audit, jobs, session, connectivity,
                broadcast, runtime, persistence/*, react/*
  styles/
    tokens.css            all design tokens - the source of truth for values
    typography.css, motion.css, layers.css, surfaces.css   foundations
    navigation.css, hero.css, systems.css, products.css, learning.css, lab.css
    work.css  written, not imported   demo-shell.css, operations.css  demo only

public/
  textures/micro-grain.svg    locally generated SVG turbulence tile
  brand/logo-*.png            approved portfolio mark, derived from logo.png
qa/                            Playwright QA harness (see QA_BASELINE.md)
docs/                          canonical project memory (this directory)
```

Stylesheet import order in `globals.css`: tokens, typography, motion, layers,
surfaces, navigation, hero, systems, products, learning, lab.

## Stage 01 - Background (FROZEN)

Four fixed, inert layers painted behind all content:

`.backdrop-base` (-4), `.aurora` (-3), `.prism` (-2) and `.grain` (-1).
Backgrounds, the seven-hue aurora palette and the three surface recipes are
declared in `src/styles/tokens.css`, their source of truth; layer A is a 135deg
gradient across the three background tones.

Six aurora fields in `src/styles/layers.css` - lavender, sky, mint, rose, peach
and lemon-over-aqua - at 130-150px blur and 0.38-0.55 opacity, cycling over
31-47s, all `ease-in-out`, `alternate`, `infinite`, with negative delays so
they never synchronise. Blur is static; only `transform` and `opacity` animate.
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

Four roles, declared in `tokens.css`: primary for headings and important body,
secondary for supporting paragraphs, annotation for captions and technical
labels, muted for decoration only.

**`--text-muted` must NOT be used for meaningful small text.** It measures
approximately 3.2:1 against the live background, below WCAG AA.
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

Behaviours: IntersectionObserver active-section tracking (`rootMargin
"-30% 0px -55% 0px"`, resolved in document order so only one item is ever
current); Escape closes; focus moves into the panel on open and returns to the
trigger on close; Tab is confined to trigger plus panel links; body scroll lock
with `scrollbar-gutter: stable` so locking cannot shift layout.

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

Scenarios: Operations SaaS (default, `/app/overview`), Commerce Platform
(`/app/commerce`) and Field Workflow (`/app/dispatch`), each declaring its own
web and phone block lists.

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
Assessment Engine an 11-node evaluation graph; Learning Path Builder an
8-milestone roadmap with 2 optional branches. All three share the 520x340
viewBox and one renderer, and each declares two deterministic variants.
`Adapt` walks a five-stage
reducer - analysing, selecting, assessing, feedback, updated - then swaps the
variant, so map states, highlighted route, journey position, mastery figures
and tutor brief all move together. Measured at 340ms per stage, 1.70s end to
end, then a 1.4s hold on "Path updated" before the control returns to "Adapt
again".

Knowledge state is never carried by colour alone: mastered, learning, gap and
locked each have their own ring pattern and core mark, and the legend names all
four in text. Link paths are computed at build time in `learning-geometry.ts`.
Map type is sized in viewBox units, so the phone view raises the label size and
drops prerequisite labels rather than render 8px type - floor 9.38px at 360px.

Nothing here reaches the network: 0 requests across 20 adapt runs and 30
scenario changes. "Maya" is a fixture, the percentages are not measurements,
and the lab header carries LOCAL / DETERMINISTIC SIMULATION.

## Stage 08 - Engineering Lab (FROZEN)

Section `#lab`, heading "Small systems. Serious engineering."

Five experiments in one workspace, selected by an ARIA tablist styled as an
instrument index: API Request Inspector, Rate Limit Simulator, Webhook
Reliability, Queue & Retry Simulator, Idempotency Guard. The workspace is a
single 1200x740 surface holding three regions - input left, the system flow and
the experiment's visual centre, observation right.

Every experiment is a precomputed frame sequence in `lab-experiments.ts`. Each
frame carries the complete state the UI needs, so the render is a pure function
of (experiment, variant, frame) and Run always produces the same sequence.
There is no `Math.random` and no generated timing anywhere in the section.

Runs last 1.2-1.8s and every end state is fixed; per-experiment frame counts
are in `docs/QA_BASELINE.md`. Failure is attributable to a stage: a validation
error stops the flow at Validate, an unauthorized call at Authenticate. Failure
is soft peach or rose, success mint, waiting lavender, in-progress sky - never
a saturated traffic light.

Nothing here reaches the network, and the illustrative labels ("T+2", "retry
delay", "simulated step 6 of 6") are sequence positions, not latency.

## Assets

`public/brand/*.png`, derived from the approved `logo.png` (never served), plus
`public/textures/micro-grain.svg`. No stock imagery or icon package.

## Deployment

Live at `https://intelligent-systems-lab.duckdns.org`. PM2 app "portfolio" on
127.0.0.1:3100, behind a Caddy shared with another project on 3200. Production
serves `.next-release-a` / `-b`; `.next` is development only. Update with
`npm run deploy:safe`; host rules in `docs/DEPLOYMENT.md`. Source is public at
`github.com/Witcher-Geralt-of-Rivia/portfolio` (`main`), a separate operation.

## Known Gaps

- LCP timing: UNVERIFIED in the headless QA environment (see QA_BASELINE.md)
- Reboot survival relies on PM2 logon-time resurrection, firing at Administrator
  logon rather than at boot. Not reboot-tested: another domain shares this box.
- A `next dev` tree on port 3000 rewrites `AGENTS.md` on restart; qa:style catches it.
