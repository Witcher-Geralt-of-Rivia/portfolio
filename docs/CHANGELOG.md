<!-- PROJECT_STAGE: 4 -->
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
