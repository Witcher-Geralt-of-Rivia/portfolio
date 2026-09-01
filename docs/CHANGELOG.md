<!-- PROJECT_STAGE: 8 -->
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

---

## Stage 06 - Product Engineering

Status: **Frozen**

### Summary
Built `#products`, heading "One product. Every surface." A Product Engineering
Studio shows one product across four surfaces simultaneously: a web application
frame, a phone, an AI-assist panel and the backend event pipeline beneath them.
Three scenarios — Operations SaaS, Commerce Platform, Field Workflow — switch
through a real ARIA tablist. `Run product flow` walks a seven-step local state
machine along the six-stage event rail and propagates into every surface.

### Files
`src/components/products/{ProductEngineeringSection,ProductStudio,
WebProductSurface,MobileProductSurface,AiAssistSurface,ProductEventFlow,
ProductScenarioSelector,ProductCapabilityRail}.tsx`,
`src/components/products/product-scenarios.ts`, `src/styles/products.css`,
`src/app/page.tsx`, `src/app/globals.css`, `qa/stage06-*.mjs`

### Notable during implementation
- ESLint was linting `.next-release-a/b`. The A/B hardening added those
  directories but the ignore list still only covered `.next`, so 174 errors in
  generated output would have failed the deployment's own validate phase.
- `products.css` shipped no list reset. The global reset zeroes margins only,
  and each stylesheet clears its own list defaults, so the browser's 40px marker
  inset silently indented the rows, timeline, step list and capability rail.
- The capability rail used `auto-fit`, which chose four columns at tablet width
  and left two empty cells showing the divider colour. Explicit counts that
  divide six (1/2/3/6) replaced it.
- The desktop composition stretched its aside track and right-aligned the
  children, leaving 100–185px of dead space beside the web frame. The frame is
  now held at its 730px design width with the pair centred.
- The field scenario's service-area SVG was a 2.4:1 box rendering 227px tall,
  making that scenario's frame far taller than the others. Same drawing,
  shallower viewBox.
- At phone widths the mono row meta would not wrap and starved the row name
  down to an ellipsis; name and meta now take separate lines.

### QA harness corrections
Four apparent application bugs were measurement artifacts, consistent with the
headless behaviour already recorded in `QA_BASELINE.md`:
- Frame-forcing screenshots cost over a second each, which swallowed the whole
  2.2s flow and made it look instantaneous. Interaction assertions now read DOM
  state directly and take no screenshots mid-run.
- `waitForFunction` defaults to rAF polling; a headless page that is not
  painting starves rAF, delaying detection and letting throttled interval
  callbacks fire in a burst afterwards. Switched to interval polling.
- The fixed site navigation and the `<nextjs-portal>` dev-tools indicator both
  painted over the section in full-page captures — the nav's dark text was
  being sampled as the assist panel's background, reading 1.00:1. Both are
  removed for capture only; neither exists in the production build.
- Counting `document.getAnimations()` counted 180–260ms colour transitions at
  `currentTime: 0` as "animating at rest". Only infinite keyframe animations
  scoped to `#products` are counted now.

### Also in this stage
Every `qa/` script now honours `QA_BASE`, so the whole suite can run against the
production build rather than only `next dev`. Stage 06 and the Stages 01-05
regression were both measured that way. Correcting `stage03-desktop.mjs` to
measure the desktop bar against the content frame - the criterion already
recorded in `QA_BASELINE.md` - cleared a false `centred=FAIL` caused by overlay
scrollbars. The navigation itself was not changed.

### QA
50 text roles measured for contrast across all three scenarios with the flow
complete: all pass, worst case 5.01:1. CLS 0.00000 at load and after three
scenario changes plus three flows. 30 scenario changes and 15 flow runs clean,
with 0 network requests. Eight viewports pass with no overflow and no surface
collision. Flow measured at 2.18–2.21s over seven steps. Stage 06 contributes
zero infinite animations at rest; under reduced motion it runs no keyframe
animation at all while content still changes. Stages 01–05 regression all PASS.

---

## Post-Stage 06 Hardening

Status: **Complete**

### Summary
Three narrow corrections to lint, CSS and the deployment gate. No visual section
was redesigned and no frozen behaviour changed.

### Files
`eslint.config.mjs`, `src/styles/products.css`, `deploy/safe-deploy.ps1`,
`qa/stage06-listreset.mjs`, canonical docs

### What changed
- **ESLint excludes generated A/B output.** `node_modules` is now listed
  explicitly alongside `.next`, `.next-release-a` and `.next-release-b`, so
  every skipped path is auditable in one place rather than half of it resting
  on an ESLint built-in default. The release-slot entries themselves shipped
  with Stage 06 (D-037); this completes and documents the set. Verified: the
  same 83 source files are linted before and after, and no source rule was
  relaxed — a deliberate `any` in `src/` is still reported as an error.
- **Stage 06 semantic-list indentation corrected.** The component-local reset
  now declares all three properties (`margin`, `padding`, `list-style`) instead
  of leaning on the global reset for margin. Measured: 40px marker inset on all
  six lists without the reset, 0px with it — except the timeline's 14px, which
  is its own panel padding. Every list stays a real `<ul>`/`<ol>`.
- **Deployment smoke coverage extended to `#products`.** The gate now asserts
  `id="systems"`, `id="products"` and the Stage 06 heading. The heading is the
  assertion that matters: the pre-Stage-06 placeholder emitted `id="products"`
  too, so an id-only check would have passed a build that lost the section.

### Notable during implementation
- Both `.next-release-a/**` and directory-form `.next-release-a/` prune the
  tree correctly; ESLint tests each path prefix with a trailing slash, so the
  existing `/**` style was already skipping traversal rather than enumerating
  and discarding. The style was left as it was.
- `QA_BASELINE.md`'s Stage Status block still stopped at Stage 05 while the
  same file recorded full Stage 06 results and `project-state.json` listed 6 as
  passing. Corrected to Stage 06 PASS.

### QA
`npx eslint src` and `npx eslint .` both exit 0 with zero generated-output
findings. Smoke assertions exercised against both real build directories: the
Stage 06 build passes all three, the pre-Stage-06 build is correctly rejected.
Stage 06 responsive, interaction, contrast, performance and list-reset harnesses
all PASS; Stages 01–05 regression all PASS.

---

## Stage 07 - AI Learning Systems

Status: **Frozen**

### Summary
Built `#ai-learning`, heading "Learning paths that adapt." An Adaptive Learning
Laboratory shows a system changing its own next move: learner state, a
knowledge model, a tutor surface and the learning journey beneath them. Three
scenarios — Adaptive Tutor, Assessment Engine, Learning Path Builder — switch
through a real ARIA tablist. `Adapt` walks a five-stage reducer and swaps the
scenario to its second deterministic variant, moving all four surfaces together.

### Files
`src/components/learning/{AILearningSection,LearningLab,LearningScenarioSelector,
KnowledgeMap,LearnerStatePanel,TutorPanel,LearningJourney,LearningPrinciples}.tsx`,
`src/components/learning/learning-{scenarios,geometry}.ts`,
`src/styles/learning.css`, `src/app/page.tsx`, `src/app/globals.css`,
`deploy/safe-deploy.ps1`, `qa/stage07-*.mjs`

### Notable during implementation
- Primary map nodes rendered a code inside the circle *and* a label below,
  giving "REST" under "REST". The code is now drawn only where it says
  something the label does not — "DB" inside "Persistence" survives, "HTTP"
  inside "HTTP" does not.
- The phone map was illegible on the first pass. SVG text inside a fixed
  viewBox scales with the container, so 10px labels rendered at 5.2px at 360px;
  raising the size alone made fifteen labels collide. The phone view now raises
  the size and sheds the prerequisite labels and in-node codes. Measured
  throughout rather than eyeballed.
- Left unconstrained, the tablet layout drew the 520-unit viewBox into an 864px
  column, rendering 9px technical labels at 15px — larger than any other label
  on the site. The drawing width is capped at 640px there.
- The path builder's adapted route named `validation -> testing -> persistence`,
  an edge that does not exist, so the map drew one signal instead of two. The
  route now follows real edges.
- Panels were stretching to the map's height and opening a large void under the
  tutor's next action; they are sized to content instead.
- Three contrast roles first measured below AA because the element box included
  a decorative marker — a dashed gap ring, a legend swatch, a context dot —
  whose colour was sampled as the text's background. The text nodes are now
  wrapped so the measurement lands on the real background. Same class of
  artifact as Stage 06's assist-context row.

### Documentation corrections
Eight pre-existing inconsistencies were found during the bootstrap and fixed
here rather than left to drift further. `ARCHITECTURE.md` claimed one client
component in one place and four in another while the code had five; it also
carried an absolute "no `setInterval`" principle directly above a paragraph
describing the Stage 06 interval, and listed seven stylesheets where there were
nine. `CLAUDE_HANDOFF.md` said stages 01-05 were frozen in one section and
01-06 in another. `PROJECT_STATE.md` reported two client entry points and
repeated the absolute timer claim. `project-state.json` was missing the Stage
06 tag, and `DEPLOYMENT.md` described the smoke port as fixed when the script
picks the first free one of four. All were stale documentation lagging code the
user had already approved, tagged and deployed.

### QA harness corrections
`stage05-a11y.mjs` asserted that exactly one `[role="tab"]` in the whole
document was tabbable. Roving tabindex is a per-tablist property, so three
tablists correctly give three tabbable tabs; the check reported a false failure
on the Stage 06 build (2/7) as well as on Stage 07 (3/10), and it went unnoticed
in Stage 06 because only the tail of that harness's output was read. It now
asserts one tabbable tab per tablist. `public-browser-check.mjs` was extended to
exercise the Stage 07 lab and its lists over real HTTPS.

### QA
40 text roles pass contrast (worst 4.85:1). CLS 0.00000 at load, 0.00027 after
three scenario changes and three adaptations. 30/30 scenario changes and 20/20
adapt runs clean with 0 network requests. 8/8 viewports with no overflow, no
panel overlap and the phone order held at learner, map, tutor, journey. Map
labels clear the 9px rendered floor at every viewport with zero collisions.
Cancellation and unmount during a run both leave no stale state. Under reduced
motion no keyframe animation runs at all while every content change still
happens. Stages 01-06 regression all PASS.

---

## Stage 08 - Engineering Lab

Status: **Frozen**

### Summary
Built `#lab`, heading "Small systems. Serious engineering." Five interactive
experiments in one workspace — API Request Inspector, Rate Limit Simulator,
Webhook Reliability, Queue & Retry Simulator, Idempotency Guard — covering
validation, traffic control, signature verification and deduplication, retry
with backoff and dead-lettering, and safe retries under an idempotency key.

### Files
`src/components/lab/{EngineeringLabSection,LabWorkspace,LabExperimentSelector,
LabFlow,LabExperimentView,LabObservation,LabControls,LabPatternRail}.tsx`,
`src/components/lab/lab-experiments.ts`, `src/styles/lab.css`,
`src/app/page.tsx`, `src/app/globals.css`, `deploy/safe-deploy.ps1`,
`qa/stage08-*.mjs`

### Notable during implementation
- The rate limiter was wrong on the first pass. Limit 5 plus burst 2 was read
  as 7 units of capacity, so a sequence of exactly 7 requests admitted all of
  them and nothing was ever refused — the opposite of what a rate-limit demo
  should show. The window now admits five, two of which may arrive back to
  back on the burst allowance, and refuses the rest with a 429.
- Three columns sized to their content left roughly 200px of empty surface
  above the workspace footer, because the workspace height is fixed by design.
  The centre column now stretches and the side panels stay at the top.
- The flow's inter-stage connector rendered between each stage's two text
  lines and read as a stray dash. The gap between the boxes does that job.
- The queue drew Producer → Queue → Worker above the job list while the system
  flow above it already showed the same five stages. Replaced with a queue
  depth readout.
- Job rows printed "complete" in both the state and note columns; the note now
  reports attempts, which is the part that differs between jobs.
- At 768px the queue's backoff note escaped the workspace: the marks carry
  cumulative left margins to widen the gaps, and the trailing note was pushed
  past the edge. The row stacks below 1100px.

### Documentation corrections
Six inconsistencies, four of them left behind by Stage 07's own update, were
found during the bootstrap and fixed here. `CLAUDE.md` — the file loaded first
in every session — still said "Stages 01-04 are frozen", three stages behind.
`CLAUDE_HANDOFF.md` said stages 01-07 were frozen two lines above a table that
stopped at 05. `ARCHITECTURE.md` had its stylesheet prose corrected in Stage 07
but not its source-tree fence, which still listed eight of ten. `PROJECT_STATE.md`
described the Stage 07 sequence as "a single interval" when it uses an interval
and a settle timeout. `DEPLOYMENT.md` named three smoke markers when the script
asserted five, and still described the smoke port as fixed. D-039 carried the
same stale count.

### QA
67 text roles pass contrast (worst 6.13:1). CLS 0.00000 at load, 0.00053 after
five experiments and five runs. 50 experiment switches — 17 of them
mid-execution — 100 executions and 100 run/reset cycles all clean, with 0
network requests. Every experiment ends in exactly one state across 20 runs.
8 viewports x 5 experiments with no overflow, no overlap, no text under 8.4px
and the phone order held at system, input, observation. Idle long-task time 0ms
over six seconds. Under reduced motion no keyframe animation runs while every
experiment still completes. Stages 01-07 regression all PASS.
