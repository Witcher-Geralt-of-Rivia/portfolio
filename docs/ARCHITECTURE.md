<!-- PROJECT_STAGE: 4 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Architecture

How the code is actually organised, and the principles that keep it that way.

## Shape

A single Next.js App Router application. Static, server-rendered, no backend.
Two prerendered routes. One client component in the entire project.

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
      SiteNavigation.tsx    "use client" - the only client component
      DesktopNavigation.tsx presentational
      MobileNavigation.tsx  presentational
      SystemMarkImage.tsx   wraps the canonical mark asset
      nav-items.ts          single source for the five destinations
    hero/
      Hero.tsx
      IntelligenceConstellation.tsx
      CapabilityRail.tsx
      constellation-geometry.ts   node/link maths, module scope
  styles/
    tokens.css              every design token
    typography.css
    motion.css
    layers.css
    surfaces.css
    navigation.css
    hero.css

public/
  textures/micro-grain.svg
  marks/system-mark.svg

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
seven stylesheets in a fixed order: tokens, typography, motion, layers, surfaces,
navigation, hero.

Every principal value is a custom property in `tokens.css`. Components reference
tokens; they do not hard-code colours, radii, shadows or timings. When a value
appears in more than one place it belongs in `tokens.css`.

Each stylesheet owns one concern. Navigation rules do not live in `globals.css`;
hero rules do not live in `navigation.css`.

## Client/Server Boundary

`SiteNavigation.tsx` is the only `"use client"` module. Its responsibilities are
deliberately bounded:

- compact menu open/close state
- focus management (move into panel, return to trigger, Tab containment)
- active-section tracking via IntersectionObserver
- Escape handling
- body scroll lock

Everything else - the aurora, the prism, the grain, the hero, the constellation,
its hover states and all of its motion - is server-rendered markup plus CSS.

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

## Architectural Principles

- Prefer CSS and SVG for visual effects.
- Avoid client components; reach for one only when behaviour genuinely requires
  state, focus control or an observer.
- No continuous JavaScript animation. No `requestAnimationFrame` loop, no
  `setInterval`, no pointer tracking.
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

## Performance Posture

Measured behaviour that should be preserved:

- Idle after entrance: no continuous JavaScript work; layout and style recalc
  counts stay at or near zero over a six-second idle window.
- CLS 0 at every tested viewport.
- Zero third-party network requests at runtime.
- Hero DOM around 130 elements; constellation SVG around 38 shape elements.

If a change pushes any of these materially, treat it as a regression and
investigate before shipping.
