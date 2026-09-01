<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Project Changelog

Stage-level history. Current truth lives in `docs/PROJECT_STATE.md`; this file
records how the project got there. Full reasoning is in `docs/DECISIONS.md`.

---

## Stage 01 - Visual Foundation

Status: **Frozen**

### Summary
Established the portfolio atmosphere: a four-layer fixed background
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
`src/styles/navigation.css`, the Stage 03 system mark (retired in 09C2),
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

---

## Stage 09A - Demo Platform Foundation

Status: **Complete** (Stage 09 remains in progress)

### The strategy change

Stage 09 changed direction. It was Work / Selected Engineering Case Studies;
it is now three disclosed interactive frontend-only product demos backed by one
reusable demo runtime, with `#work` becoming a launcher into them.

The reason the original route stalled is preserved rather than rewritten.
Case studies were blocked on content: the repository holds no verified client
engagement, and `docs/CASE_STUDY_SOURCE_AUDIT.md` records the exhaustive search
that established it — three parallel read-only sweeps plus direct searches over
every tracked file and every commit, finding that every project-shaped artefact
in the tree declares itself synthetic in its own source. Writing case studies
from that material would have meant inventing clients, problems and outcomes on
a live public site, which D-045 forbids at the scale of a single number and
therefore forbids at the scale of an engagement.

One verified case survives from that work — Internal Production Delivery
System, the portfolio's own A/B release system, approved by the user on
2026-08-30. It is preserved, unpublished, and is not one of the three demos.
Its provenance must never be mixed with them.

### Scope

Only the shared foundation. No CRM screens, no dashboards, no field-service or
learning screens, no Demo 01 visual design, and no business seed data — those
belong to each product specification, starting with 09B.

### Runtime

`src/demo-runtime/`, eighteen modules in one dependency direction: types, then
persistence/clock/ids/events, then repository, then runtime, then React. It
knows records, collections, events, jobs, audit, roles, a clock and
persistence, and never what a lead, a vehicle or a lesson is — which is what
lets three unrelated products share it (D-049).

Persistence is native IndexedDB with a memory fallback and no library (D-047).
One database, `portfolio-demo-runtime`, four stores, five indexes, and `demoId`
leading every composite key so cross-demo reads are structurally impossible.
UI never touches IndexedDB; everything speaks to the adapter interface.

Ids are per-collection counters, time is a logical clock, and mutation plans
are computed before anything is written (D-048). No `Math.random`, no
`crypto.randomUUID` for canonical entities, no `Date.now()`.

### Chrome and routing

`src/app/demos/layout.tsx` sets `robots: index false, follow false` and imports
`demo-shell.css` itself, so no demo CSS ships on the homepage. It has no
`page.tsx` beneath it, so `/demos` is a 404: an unfinished demonstration must
not be reachable, and a demo becomes a route only when it is finished.

The shared bar carries `← Portfolio`, the disclosure, the title, a role slot, a
persistence notice and Reset. 36-37px at desktop widths, 87px in two rows on
phones.

### Bugs found and fixed

- `resetDemo` purged with a cursor. A cursor's `continue()` queues a fresh
  request, so its deletes landed *after* the synchronous seed writes and wiped
  the data being restored — IndexedDB reset left the collection empty while the
  memory adapter passed. Replaced with a keyed range delete issued before the
  first put; reset also went from 1444ms to ~400ms.
- The global `* { margin: 0 }` reset beats the user agent's
  `dialog:modal { margin: auto }`, pinning the confirmation dialog to the
  top-left corner. Centring is restated locally.
- The disclosure pill measured 481px on one line: it overflowed a 430px
  viewport by 84px and squeezed the demo title to 3px at 1024px. It now stacks
  its two halves below 1120px, and the bar wraps below 640px.
- The demo shell sat inside the site's reading gutter, leaving 335px of usable
  width on a phone — not enough for Back and Reset to share a row. A demo is an
  application surface and now runs full bleed.
- A folder named `__probe` produced a 404: a leading underscore marks a Next.js
  private folder, which is excluded from routing.

### Documentation corrections

Nine inconsistencies were found during the bootstrap audit and fixed.
`PROJECT_STATE.md` said seven `"use client"` modules where the code, three
other canonical documents and `project-state.json` all said nine.
`DESIGN_SYSTEM.md` still carried the absolute "no `setInterval`" rule that
D-042 had already retired from `ARCHITECTURE.md`, contradicting three frozen
stages that use one. `CLAUDE_HANDOFF.md` said Stage 09 had not started while
four Stage 09 files existed. `NEXT_STAGE.md` was stale by one commit, still
describing three empty drafts and "nothing truthful to publish" after case-01
was approved. `ARCHITECTURE.md`'s source tree was missing four component
directories and `src/content/`. `QA_BASELINE.md` declared every number measured
against production while its Stage 06 section said dev server — that section
was re-measured in 840381b and only the header was left behind.
`CASE_STUDY_SOURCE_AUDIT.md` denied, in the present tense, directories it later
listed. The audit itself was cited as canonical by two documents but was in
neither `canonicalDocs` nor the memory harness, so nothing checked it.

### QA

`qa/stage09a-runtime.mjs` 76 checks and `qa/stage09a-shell.mjs` 85 checks, all
passing, run against real browser IndexedDB through two temporary fixtures that
were deleted before commit. Covers seed, CRUD, atomic failure, typed errors,
demo isolation, reset determinism across repeated cycles, the query layer, the
seed-version policy, 500 generic records, reload persistence, forced IndexedDB
failure into the memory fallback, and cross-tab invalidation carrying no record
data. Idle cost: 0 intervals, 0 rAF, 0 timers over three seconds. Network: 0
API requests, 0 external requests.

### Not done

`#work` is untouched and still renders its Stage 03 placeholder. Nothing is
wired into `page.tsx` or `globals.css`, `currentStage` stays 8, and production
was not deployed — Stage 09A changes no user-visible route.

---

## Stage 09B - Operations Product Specification

Status: **Complete** (Stage 09 remains in progress)

Planning only. No product code, no routes, no seed data, no deployment.

### What was frozen

Demo 01's complete product contract, in `docs/DEMO_OPERATIONS_SPEC.md`: the
rental-operations domain, the public label "Rental Operations Platform" with
the in-app identity "Operations Console", eleven modules and their URL
strategy, four simulated roles and a full permission matrix, thirteen domain
entities with every field, the relationship map, five automation rules, six
acceptance workflows, the responsive shell, error mapping, accessibility
requirements, QA contracts, and every seed count and distribution.

Three values are specified as derived rather than stored, because that is what
stops the demo contradicting itself: vehicle status follows a precedence rule
over work orders, contracts and reservations; a payment's overdue state comes
from `dueAt` against the logical clock; and a contract total is rate times
duration. The seed distributions are tied together by identity — seven Active
contracts *are* the seven Rented vehicles, four Confirmed reservations the four
Reserved, three open work orders the three in Maintenance, six Won leads the
six customers carrying `sourceLeadId`.

The Overview KPI "payments requiring attention" reads 8 on seeded data, and the
specification forbids writing 8 as a literal anywhere.

### Findings resolved during the bootstrap

Two, both recorded rather than absorbed:

- The project has no icon package and every mark in it is authored locally as
  SVG, so §159's "existing icon strategy" resolves to inline SVG and no
  library. Recorded in the specification.
- The Stage 09A runtime cannot express a seeded audit trail: `ResetPayload`
  carries only `records` and `meta`, and both adapters purge audit on reset.
  The specification asks for 63 seeded audit entries, so Stage 09C must extend
  the payload with an optional `audit` array in both adapters. Because 09A is
  frozen and tagged, this is written up as D-052 rather than done silently.

### Guard

`qa/stage09b-operations-spec.mjs`, 93 checks, asserting that the document still
contains the frozen contract: eleven modules and no Settings, thirteen
entities, four roles, five rules, six workflows, every seed count, every
distribution and that the distributions sum to their totals, the relationship
identities, the anti-hardcoding rules, the scope exclusions, and that no email
address, telephone number or messaging link has appeared anywhere in it.

Two of its first assertions were harness bugs rather than specification
problems, and both were the same mistake: the guard flagged the document's own
prohibition list, where `mailto:` is named precisely because it is forbidden.
The patterns now require the part that would make a string a usable address,
and phrase assertions run against a whitespace-collapsed view so re-wrapping a
paragraph cannot break a check.

### Deliberate exclusions

No CSV or PDF export, no global command palette, no generic visual rule
builder, no Settings module, no maps, no payment provider, no push
notifications, no optimistic mutations, no virtualization, no icon library.
Recorded in the specification so they are not reintroduced as scope creep.

### Not done

No source implementation. `docs/DEMO_OPERATIONS_SPEC.md` and the guard are the
whole deliverable, plus canonical-document updates. The registry still reads
`operations = planned`, `currentStage` stays 8, `#work` is untouched, and
nothing was deployed.

---

## Stage 09C1 - Operations Domain, Seed and Runtime Audit Extension

Status: **Complete** (Stage 09 remains in progress)

The first implementation substage of 09C. Builds the whole non-visual
Operations foundation; no screen, no route, no component.

### Runtime extension (D-052)

`ResetPayload` and `DemoSeed` gained an optional `audit` array, written inside
the same transaction as the purge and reseed in both adapters. The runtime
assigns `demoId` and the sequence numbers, so a seed cannot hand out a sequence
that collides with the ones later mutations allocate, and `meta.auditSequence`
starts past the seeded history.

Optional means optional: a demo that seeds no history still resets audit to
zero. Stage 09A's own harnesses pass unchanged, 76 and 85 checks.

### Domain

`src/demos/operations/`, twenty-one modules. Thirteen entities with every
canonical value a literal union, the four-role permission matrix, nine
services, the derived-state selectors, the query helpers and the five-rule
automation engine.

Permission is enforced in the services themselves rather than by a screen
choosing not to draw a button, so a Sales Agent cannot record a payment through
the domain even with no UI in the way.

### Seed

301 records and 63 audit entries, built by deterministic functions. The four
relationship identities hold by construction rather than by assertion: the
vehicle indices are carved into four non-overlapping pools, so seven Active
contracts *are* the seven Rented vehicles and three active work orders *are*
the three in Maintenance.

Distributions are expanded from the frozen counts and walked with a stride
coprime to their length — every element visited once, counts untouched, order
still completely determined, and no list opening with twelve consecutive "New"
leads.

### Two specification gaps closed first (D-053)

Stage 09C1 asked that ambiguities be reconciled rather than chosen silently in
code, and three were:

- Stage 09B stored all three payment statuses while also deriving the effective
  one, which is precisely the stale second source of truth the derived-state
  rules exist to prevent. Stored status is now `Pending | Paid`; `Overdue` is
  derived from `dueAt` against the logical clock.
- Money had no unit. It is integer cents throughout, so a balance built from
  several payments cannot drift.
- Rule 02's follow-up offset was written as "a deterministic offset" with no
  figure. It is two days.

The spec was amended before any code was written, and the 09B guard now asserts
all three so they cannot drift back.

### Bugs and false failures found

- The QA harness compared distributions with `JSON.stringify`, which is
  key-order sensitive; the tally is built in first-encounter order, so correct
  counts failed. Compared per key now.
- A W2 assertion picked `eligible[0]` and expected Reserved. That vehicle was
  currently rented and legitimately eligible for a *future* window —
  eligibility is interval-based, status is now-based, and both are right. The
  test now confirms onto a currently-free vehicle and separately asserts that
  an active contract outranks a future reservation.
- The content scan's telephone pattern matched ISO timestamps. Timestamps are
  excluded before the digit patterns run; flagging one would train the next
  reader to ignore the check.

### QA

`qa/stage09c1-operations.mjs`, 211 checks, the whole business suite run twice —
once per persistence adapter, because the two must be indistinguishable.
Covers the dependency boundary by reading the source, seed integrity, the six
workflows, the role matrix, seven conflict contracts, reset determinism, demo
isolation, 2184 seeded strings scanned for contact data and real brands,
reload persistence, forced IndexedDB failure into the memory fallback, and a
performance tripwire.

### Not done

No UI. `/demos/operations` is still not a route, `#work` still renders its
placeholder, `currentStage` stays 8, and nothing was deployed. The registry now
reads `operations = building`.

---

## Stage 09C2 - Branding, Operations Shell and Overview

Status: **Complete** (Stage 09 remains in progress)

The first visible substage of 09C, and a user-approved branding change that
crosses the Stage 03 freeze.

### Branding

The user supplied an approved logo at `logo.png`. It is canonical source
artwork and is never modified or served; `qa/brand-derive.mjs` produces the
deployable sizes from it with `pngjs`, already a devDependency, rather than
adding an image library.

Measured before use rather than assumed: 1254x1254, 64% fully transparent with
`rgba(0,0,0,0)` corners, so the transparency is real and no plate is needed
behind it on any background. Downsampling premultiplies alpha before averaging,
because straight RGBA averaging would drag the colour of transparent pixels
into every edge of a mark that is 35% partial alpha.

`icon.png` is 256 rather than 512. The mark is a soft gradient that PNG
compresses poorly — 512 costs 164 KB against 55 KB — and a 164 KB tab icon
would be disproportionate in a project whose previous mark was 890 bytes. No
`favicon.ico` exists to shadow it.

At 16px the fine detail dissolves and the silhouette and colour identity
survive; at 20px and above the mark is clearly itself. That was rendered and
looked at, not assumed.

The Stage 03 four-node SVG mark is retired: `SystemMarkImage` became
`PortfolioMark`, the asset is deleted, and the deployment smoke gate now
asserts `/brand/logo-96.png` — a smoke test should check what the site
actually serves.

The design language's previous name is retired across the working tree, and
the site title is now "Intelligent Systems Lab". CSS token names were left
alone: renaming `--aurora-lavender` to satisfy a wording change would risk a
regression across eight frozen stages for nothing (D-054).

### Operations shell and Overview

`/demos/operations` exists in the source build. A Server Component page carries
the metadata and inherits the subtree's `noindex, nofollow`; everything needing
the browser sits below one client boundary.

The shell is a 240px sidebar, a 66px top bar and the content area, inside the
Stage 09A demo chrome. Role and build state are answered independently: a
module the role cannot view is not rendered at all, and a module that exists
but is unbuilt renders as a non-interactive label rather than a link to a 404.
That second state is temporary, carried by an `implemented` flag, and is
deleted as each module lands.

Overview's four KPIs derive to 38 / 4 / 10 / 8 with nothing hard-coded. Which
KPIs appear follows the role matrix: a KPI summarises a module's data, so
showing one for a module the role cannot open would make the Overview a hole in
its own policy. Sales Agent sees two, Fleet Coordinator two, Finance Analyst
one — no filler cards are invented to keep the row at four, and there are no
trend badges, because there is no previous period to compare against.

Eleven navigation icons and the funnel and fleet visuals are authored SVG. No
chart library, no icon package, no new dependency of any kind.

### Two contradictions found and resolved

- **Action queue order.** Stage 09B froze notifications first; Stage 09C2 froze
  overdue payments first. The contradiction was visible on the first render:
  the queue opened with six identical "Lead assigned" rows and pushed all three
  overdue payments off the six-item list. Resolved in favour of most-urgent
  first (D-055), with the spec amended and the labels rewritten to carry the
  amount, date or name that tells the rows apart.
- **Main landmark.** `SiteShell` already renders the document's `<main>`, so
  the shell's own would have made two. The route keeps its `<h1>` inside the
  single existing landmark.

### Bugs found by measuring

- The notification panel emptied itself on open: its query was keyed on the
  open state, so toggling discarded the settled result. The badge said eight
  unread beside a list showing none.
- The panel sorted by recency alone, and the seeded unread items are the
  oldest, so the twelve rows shown were all read ones.
- The badge was white on the sky accent at 4.04:1, below AA for 10px text.
- Adding the mark to the demo bar cost the row 26px, squeezing the title to
  57px at 768px. The bar now wraps at 860px instead of 640px.

### Harness artifacts, not product defects

Three, each worth recording because each would otherwise read as a failure:
`visually-hidden` text is clipped to 1px by design and counted as clipped;
the notification badge deliberately overhangs its trigger; and Playwright's
`waitForFunction` defaults to rAF polling, which starves against an application
that schedules no frames at rest — reporting 19 seconds for a 74ms operation.
Interactions are now measured inside the page.

### QA

`qa/stage09c2-operations-ui.mjs`, 140 checks against a **local production
build** on port 3001. Port 3200 was tried first and turned out to belong to the
other application on this host; the attempt failed to bind and disturbed
nothing.

Covers brand terminology and assets, route metadata and robots, the disclosure
and mark, every Overview figure, the full role matrix, role persistence,
notification behaviour, reset, accessibility, contrast, nine viewports, the
memory fallback, CLS, idle cost and network.

### Not done

Ten module screens. `#work` is untouched, the registry still reads
`operations = building`, `currentStage` stays 8, and nothing was deployed —
production remains on the previous release with no Operations route.

---

## Stage 09C2.1 - Operations Shell Hardening and Review Deployment

Status: **Complete**

### Summary
Fixed what looking at the rendered product showed, then deployed
`/demos/operations` so it can be judged live before ten more module screens are
built on the same shell. Stage 09C3 is deliberately blocked until that review
comes back.

### Fixed

- **KPI progress bars had no denominator.** "38 open leads" is not 38% of
  anything, so the fill was chosen to look plausible — a decoration in the
  visual language of a measurement. Replaced by breakdowns that sum to the
  headline and can be checked against the panels below (D-057).
- **The role rule was half applied.** 09C2 filtered KPI cards and left panels,
  the action queue and notifications alone. `ui/overview-policy.ts` now derives
  every surface's visibility from `permissions.ts`. The visible symptom was a
  Finance notification badge reading 8 over a list of 3 (D-056).
- **The notification popover overflowed a phone.** Below 768px it is a
  full-width sheet under the top bar, with a scrim, an explicit close control,
  the page behind locked and its own internal scroll.
- **The mark carried the master's transparent padding**, about 11% of each
  side, leaving 25px of visible mark in a 28px box. A tight derivative keeping
  the artwork's aspect renders 30px (D-059).
- **The product named itself three times in the top 120px.** `DemoShell`'s
  title is now optional and Operations passes none; the filler that held the
  bar's row open stands down when the bar wraps, where it had been pushing the
  back link to the right-hand edge of a phone screen (D-060).

### The bug underneath

Fixing the badge exposed a shared-runtime defect worth more than the rest.
`useDemoQuery` discarded its data on every revalidation, so marking eight
notifications read — eight writes, eight revision bumps — cleared the badge and
emptied the list after the first write while seven were still outstanding. A
reload restored them, so the demo appeared to lose data it had never saved.

The QA harness caught it as an intermittent failure and reading IndexedDB at
the moment the badge cleared confirmed it: six or seven still unread. The
persistence layer was never at fault — the adapter awaits `tx.oncomplete`, so a
resolved commit is durable. The screen was reporting completion before the work
was done.

The hook now keeps the previous answer while re-reading the same question, and
drops it when the question changes. That distinction is the whole fix: keeping
stale data across a role change would have leaked the previous role's records
for a frame, which is the failure D-056 closes (D-058).

- **The KPI breakdown was clipped** between 1180px and 1440px. Each part is
  `nowrap` by design and nothing sat between two of them, so the line had no
  break opportunity and "7 Proposal" was cut off — a list that reads as
  complete and is not. A wrapping flex gap replaced the middle dot. Found by
  reading a production screenshot after the first deployment, which is the
  review workflow of D-061 working on its first pass.

### QA

`qa/stage09c21-operations-hardening.mjs`, 111 checks: KPI semantics and sums,
the role composition matrix, role containment, the mobile sheet at 390 and 360,
the master logo's bytes and the derived mark's geometry, and reset. Full
regression is 719 checks across seven suites, all against a local production
build on port 3001 — never 3200, which belongs to the other application here.

Two 09C2 assertions were updated rather than removed: the demo bar mark is no
longer square, and the queue's re-render is waited for as a condition instead
of a fixed 150ms sleep.

### Deployed

`npm run deploy:safe`, the only supported path. The route is `noindex,
nofollow`, nothing links to it, `#work` is untouched and still renders its
Stage 03 placeholder, the registry still reads `operations = building`, and
`currentStage` stays 8. The last concatenated occurrence of the retired
design-language name, a mutex name in the deploy script, was renamed with it.

### Not done

Ten module screens. Stage 09C3 is blocked until the deployed build has been
reviewed on a real screen (D-061).
