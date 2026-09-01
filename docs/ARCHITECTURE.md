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
  styles/
    tokens.css              every design token
    typography.css, motion.css, layers.css, surfaces.css
    navigation.css, hero.css
    systems.css, products.css, learning.css, lab.css   one per section

public/
  textures/micro-grain.svg
  marks/system-mark.svg

deploy/
  safe-deploy.ps1           the production deployment (build inactive slot,
                            smoke test, switch, auto-rollback)
  pm2.portfolio.config.js   PM2 process definition; refuses to serve .next
  pm2-status.mjs            PM2 introspection for the deploy script
  logs/                     per-deployment logs (gitignored)

qa/                         Playwright harness + screenshot baselines
docs/                       canonical project memory
```

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

There are nine `"use client"` modules, each with deliberately bounded
responsibilities. `docs/project-state.json` holds the authoritative list.

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
that index — which is what makes the sequences reproducible.

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
  `public/marks/system-mark.svg`, and is referenced rather than duplicated
  into JSX.
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
