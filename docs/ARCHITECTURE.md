<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Architecture

How the code is actually organised, and the principles that keep it that way.

## Shape

A single Next.js App Router application. Static, server-rendered, no backend.
Two prerendered routes. Nine client components; everything else is server-
rendered markup and CSS.

```
src/
  app/
    layout.tsx              root layout: loads Geist, renders SiteShell
    globals.css             composition root - imports every stylesheet
    page.tsx                "/"  hero + five anchor sections
    page.css
    demos/
      layout.tsx            09A - demo platform frame; robots noindex.
                            No page beneath it, so /demos is a 404 by design
      operations/
        layout.tsx          09C3.1 - holds the product's client boundary, so
                            the runtime survives navigation between modules
        page.tsx            "/demos/operations"  Overview
        leads/page.tsx      "/demos/operations/leads"  CRM pipeline
    specimen/
      page.tsx              "/specimen"  Stage 02 typography specimen
      page.css
  components/
    layout/
      SiteShell.tsx         background + navigation + <main> frame
    visual/
      AuroraBackground.tsx  background layers A and B
      PrismLight.tsx        background layer C
      GrainOverlay.tsx      background layer D
    navigation/
      SiteNavigation.tsx    "use client" - navigation state and observers
      DesktopNavigation.tsx presentational
      MobileNavigation.tsx  presentational
      SystemMarkImage.tsx   wraps the canonical mark asset
      nav-items.ts          single source for the five destinations
    hero/
      Hero.tsx
      IntelligenceConstellation.tsx
      CapabilityRail.tsx
      constellation-geometry.ts   node/link maths, module scope
    systems/
      IntelligentSystemsSection.tsx   section shell (server)
      ArchitectureLab.tsx             "use client" - mode + hovered node
      ArchitectureCanvas.tsx          SVG links + HTML nodes, both layouts
      ArchitectureModeSelector.tsx    full ARIA tablist
      ExecutionTrace.tsx
      EngineeringPrinciples.tsx
      architecture-data.ts            four modes, declarative
      architecture-geometry.ts        orthogonal routing
    products/   06 - ProductStudio; web/mobile/assist surfaces, event rail
    learning/   07 - LearningLab; knowledge map, learner and tutor panels
    lab/        08 - LabWorkspace; flow, experiment views, observation
    work/       09 - case-study renderers; built, not wired into the page
    demos/      09A - DemoShell, DemoDisclosure, DemoResetControl
  content/
    case-studies.ts         typed case-study model and render-safety filter
  demo-runtime/             09A - the shared demo platform runtime
    types.ts config.ts demo-registry.ts clock.ts ids.ts
    persistence/{adapter,indexed-db,memory}.ts
    repository.ts async-service.ts events.ts audit.ts jobs.ts
    session.ts connectivity.ts broadcast.ts runtime.ts
    react/{DemoRuntimeProvider.tsx,hooks.ts}
  styles/
    tokens.css              every design token
    typography.css, motion.css, layers.css, surfaces.css
    navigation.css, hero.css
    systems.css, products.css, learning.css, lab.css   one per section
    work.css        09 - written, not imported (the section is unwired)
    demo-shell.css  09A - imported by src/app/demos/layout.tsx, not globals.css

public/
  textures/micro-grain.svg
  brand/logo-96.png            portfolio mark, 28px in navigation
  brand/logo-192.png           larger derivative

deploy/
  safe-deploy.ps1           the production deployment (build inactive slot,
                            smoke test, switch, auto-rollback)
  pm2.portfolio.config.js   PM2 process definition; refuses to serve .next
  pm2-status.mjs            PM2 introspection for the deploy script
  logs/                     per-deployment logs (gitignored)

qa/                         Playwright harness + screenshot baselines
docs/                       canonical project memory
```

## Demo Platform

A second application area, added in Stage 09A and not yet reachable.

```
Portfolio application
  └── Demo platform                 src/demo-runtime/, src/app/demos/
        ├── Shared runtime          persistence, clock, ids, events,
        │                           audit, jobs, session, connectivity
        ├── Operations domain       BUILT - domain 09C1, shell + Overview
        │                           09C2, Leads 09C3.1
        ├── Field domain            PLANNED - not built
        └── Learning domain         PLANNED - not built
```

Stage 09A built the shared foundation and froze it. Stage 09B froze the
Operations domain's contract in `docs/DEMO_OPERATIONS_SPEC.md`, and Stage 09C1
built that domain: `src/demos/operations/`, twenty-one modules of types, seed,
selectors and services with no interface at all. Field and Learning remain
unspecified and unbuilt.

The dependency runs one way and is asserted by QA: no runtime module imports
from `src/demos/`, and no Operations entity name appears in runtime code.

One layer was missing until Stage 09C3.1 and is worth naming, because its
absence was invisible: **workflows**. A service commits and publishes domain
events; the automation engine evaluates events; nothing joined the two, so the
rules never ran outside the QA harness. `services/lead-workflows.ts` is that
join: it runs a mutation, collects what it published on the runtime's event
bus, and hands it to the rule engine (D-063). Screens call workflows where a
rule is meant to fire, and services directly where none is.

The rule that keeps one runtime serving three unrelated products: the runtime
knows records, collections, events, jobs, audit, roles, a clock and
persistence, and never knows what a lead, a vehicle or a lesson is. UI never
touches IndexedDB; everything above the persistence adapter speaks to its
interface. Dependency direction is one-way: types, then persistence/clock/ids,
then repository, then runtime, then React, then a demo's domain, then its UI.

`src/app/demos/layout.tsx` sets `robots: noindex` for the subtree. Its only
route is `/demos/operations`, added in 09C2; the module segments beneath it do
not exist yet, and the sidebar renders those modules as non-interactive rather
than linking to a 404. That temporary state is carried by an `implemented`
flag in `ui/modules.ts` and is deleted as each module lands.

Full detail, including the persistence schema and the QA contracts, is in
`docs/DEMO_PLATFORM.md`; Demo 01's frozen product contract is in
`docs/DEMO_OPERATIONS_SPEC.md`, and how it is built in
`docs/DEMO_OPERATIONS_IMPLEMENTATION.md`. Decisions D-046 to D-053.

## Composition

`layout.tsx` applies the two Geist font variables to `<html>` and renders
`SiteShell`, which is the only place the page furniture is assembled:

```
SiteShell
  AuroraBackground   fixed, inert, z -4 / -3
  PrismLight         fixed, inert, z -2
  GrainOverlay       fixed, inert, z -1
  SiteNavigation     fixed, z 100 / 110
  <main class="site-main">{children}</main>
```

Pages render only their own content. `SiteShell` contains nothing page-specific.

`.site-main` provides default top clearance for the fixed navigation. A page that
opens with the hero sets its own larger clearance, so
`.site-main:has(.hero)` zeroes the shell padding rather than stacking two gaps.

## Styling

Plain CSS, no framework. `globals.css` is a composition root that imports the
eleven stylesheets in a fixed order: tokens, typography, motion, layers,
surfaces, navigation, hero, systems, products, learning, lab. A new section appends its own
stylesheet to the end of that chain and never edits an earlier one.

Every principal value is a custom property in `tokens.css`. Components reference
tokens; they do not hard-code colours, radii, shadows or timings. When a value
appears in more than one place it belongs in `tokens.css`.

Each stylesheet owns one concern. Navigation rules do not live in `globals.css`;
hero rules do not live in `navigation.css`.

## Client/Server Boundary

There are thirteen `"use client"` modules, each with deliberately bounded
responsibilities: nine on the site itself, and four in the demo platform, which
nothing imports yet. `docs/project-state.json` holds the authoritative list.

`SiteNavigation.tsx`:

- compact menu open/close state
- focus management (move into panel, return to trigger, Tab containment)
- active-section tracking via IntersectionObserver
- Escape handling
- body scroll lock

`ArchitectureLab.tsx` holds two pieces of state: the selected architecture mode
and the node currently hovered or focused. The mode transition, packet motion,
connection highlighting and trace stagger are all CSS.

`ProductStudio.tsx` holds the selected scenario and the position of the product
flow. The flow is a single `setInterval` advancing a step index; its effect
cleanup clears the timer, so changing scenario, restarting or unmounting all
abandon the run rather than letting it write into a stale scenario. The lit
stage, the phone's sync marker and the assist panel's resolved brief are all
derived from that one index.

`LearningLab.tsx` holds the selected learning scenario, which of that
scenario's two deterministic variants is showing, and the position of the adapt
sequence. It is the one place in the project that uses a reducer: the sequence
has to move four surfaces together, and a reducer keeps that transition in one
readable function. Both of its timers are cleared by effect cleanup.

`LabWorkspace.tsx` holds the selected experiment, its variant, and how far the
frame sequence has advanced. Each experiment is a precomputed frame list, so
running one is an index walking forward and the render is a pure function of
that index, which is what makes the sequences reproducible.

The four selectors (`ArchitectureModeSelector`, `ProductScenarioSelector`,
`LearningScenarioSelector`, `LabExperimentSelector`) are client only because a
tablist needs key handling and roving tabindex. They own no state; the
selection lives in their parent.

Everything else - the aurora, the prism, the grain, the hero, the
constellation, all three section shells, the product surfaces, the event rail,
the knowledge map, the learner and tutor panels, the learning journey and the
principles and capability strips - is server-rendered markup plus CSS.

The constellation's hover uses CSS `:has()` specifically so the hero does not
need to become a client component.

## Geometry as Build-Time Data

`constellation-geometry.ts` computes node positions, edge-terminated connection
paths and curve control points at module scope. Because it is imported by a
server component in a statically prerendered route, that maths runs once at build
time and the browser receives finished path strings.

Two rules are encoded there and should not be casually changed:

1. Connections terminate at node **edges**, never centres, so a line can never
   run underneath a label.
2. Cross-links bow asymmetrically, choosing whichever side keeps the arc inside
   the composition while still clearing the orchestrator. Uniform outward bows
   produce meridian lines and the artwork reads as a wireframe orb.

`architecture-geometry.ts` does the equivalent for the systems section, but
soft-orthogonal rather than organic: straight runs with small rounded turns,
and separated horizontal corridors where several links converge on one node so
a fan-in reads as a routing bundle instead of one overdrawn line.

## Architectural Principles

- Prefer CSS and SVG for visual effects.
- Avoid client components; reach for one only when behaviour genuinely requires
  state, focus control or an observer.
- No continuous JavaScript animation: no `requestAnimationFrame` loop, no
  pointer tracking, and nothing running on a timer at rest. A user-triggered
  sequence may use timers when it has to move several surfaces together,
  provided effect cleanup tears every one of them down on each exit - see
  D-035, D-042 and D-044. That is the only sanctioned use of a timer.
- Animate compositor-friendly properties: `transform`, `opacity`, and where
  necessary `offset-distance` and `stroke-dashoffset`.
- Use IntersectionObserver rather than scroll polling.
- No backend unless a future requirement genuinely needs one.
- No paid AI runtime, ever, under the current constraints.
- No external image dependency unless explicitly justified. All artwork is
  authored locally as SVG or CSS.
- Keep one canonical source per asset. The system mark exists once, at
  `public/brand/logo-96.png`, derived from the approved master at `logo.png`
  by `qa/brand-derive.mjs`, and is referenced rather than duplicated into JSX.
- Keep one canonical source per data set. The five navigation destinations exist
  once, in `nav-items.ts`, and are consumed by the desktop bar, the compact panel
  and the page's anchor sections.

## Release Layout

`next.config.ts` resolves `distDir` from `PORTFOLIO_DIST_DIR`, validated against
an allow-list. Production runs from `.next-release-a` or `.next-release-b` and
never from `.next`, so building can never rewrite what the live process is
reading. Deployment alternates slots and keeps the previous one for rollback.

## Performance Posture

Measured behaviour that should be preserved:

- Idle after entrance: no continuous JavaScript work; layout and style recalc
  counts stay at or near zero over a six-second idle window.
- CLS 0 at every tested viewport.
- Zero third-party network requests at runtime.
- Hero DOM around 130 elements; constellation SVG around 38 shape elements.

If a change pushes any of these materially, treat it as a regression and
investigate before shipping.
