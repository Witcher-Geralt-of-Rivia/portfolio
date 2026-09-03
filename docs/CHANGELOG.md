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
Three scenarios (Operations SaaS, Commerce Platform, Field Workflow) switch
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
  painted over the section in full-page captures: the nav's dark text was
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
  relaxed: a deliberate `any` in `src/` is still reported as an error.
- **Stage 06 semantic-list indentation corrected.** The component-local reset
  now declares all three properties (`margin`, `padding`, `list-style`) instead
  of leaning on the global reset for margin. Measured: 40px marker inset on all
  six lists without the reset, 0px with it, except the timeline's 14px, which
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
scenarios (Adaptive Tutor, Assessment Engine, Learning Path Builder) switch
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
  something the label does not: "DB" inside "Persistence" survives, "HTTP"
  inside "HTTP" does not.
- The phone map was illegible on the first pass. SVG text inside a fixed
  viewBox scales with the container, so 10px labels rendered at 5.2px at 360px;
  raising the size alone made fifteen labels collide. The phone view now raises
  the size and sheds the prerequisite labels and in-node codes. Measured
  throughout rather than eyeballed.
- Left unconstrained, the tablet layout drew the 520-unit viewBox into an 864px
  column, rendering 9px technical labels at 15px, larger than any other label
  on the site. The drawing width is capped at 640px there.
- The path builder's adapted route named `validation -> testing -> persistence`,
  an edge that does not exist, so the map drew one signal instead of two. The
  route now follows real edges.
- Panels were stretching to the map's height and opening a large void under the
  tutor's next action; they are sized to content instead.
- Three contrast roles first measured below AA because the element box included
  a decorative marker (a dashed gap ring, a legend swatch, a context dot)
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
experiments in one workspace (API Request Inspector, Rate Limit Simulator,
Webhook Reliability, Queue & Retry Simulator, Idempotency Guard) covering
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
  them and nothing was ever refused, the opposite of what a rate-limit demo
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
found during the bootstrap and fixed here. `CLAUDE.md`, the file loaded first
in every session, still said "Stages 01-04 are frozen", three stages behind.
`CLAUDE_HANDOFF.md` said stages 01-07 were frozen two lines above a table that
stopped at 05. `ARCHITECTURE.md` had its stylesheet prose corrected in Stage 07
but not its source-tree fence, which still listed eight of ten. `PROJECT_STATE.md`
described the Stage 07 sequence as "a single interval" when it uses an interval
and a settle timeout. `DEPLOYMENT.md` named three smoke markers when the script
asserted five, and still described the smoke port as fixed. D-039 carried the
same stale count.

### QA
67 text roles pass contrast (worst 6.13:1). CLS 0.00000 at load, 0.00053 after
five experiments and five runs. 50 experiment switches (17 of them
mid-execution), 100 executions and 100 run/reset cycles all clean, with 0
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
that established it: three parallel read-only sweeps plus direct searches over
every tracked file and every commit, finding that every project-shaped artefact
in the tree declares itself synthetic in its own source. Writing case studies
from that material would have meant inventing clients, problems and outcomes on
a live public site, which D-045 forbids at the scale of a single number and
therefore forbids at the scale of an engagement.

One verified case survives from that work: Internal Production Delivery
System, the portfolio's own A/B release system, approved by the user on
2026-08-30. It is preserved, unpublished, and is not one of the three demos.
Its provenance must never be mixed with them.

### Scope

Only the shared foundation. No CRM screens, no dashboards, no field-service or
learning screens, no Demo 01 visual design, and no business seed data. Those
belong to each product specification, starting with 09B.

### Runtime

`src/demo-runtime/`, eighteen modules in one dependency direction: types, then
persistence/clock/ids/events, then repository, then runtime, then React. It
knows records, collections, events, jobs, audit, roles, a clock and
persistence, and never what a lead, a vehicle or a lesson is, which is what
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
  the data being restored. IndexedDB reset left the collection empty while the
  memory adapter passed. Replaced with a keyed range delete issued before the
  first put; reset also went from 1444ms to ~400ms.
- The global `* { margin: 0 }` reset beats the user agent's
  `dialog:modal { margin: auto }`, pinning the confirmation dialog to the
  top-left corner. Centring is restated locally.
- The disclosure pill measured 481px on one line: it overflowed a 430px
  viewport by 84px and squeezed the demo title to 3px at 1024px. It now stacks
  its two halves below 1120px, and the bar wraps below 640px.
- The demo shell sat inside the site's reading gutter, leaving 335px of usable
  width on a phone, not enough for Back and Reset to share a row. A demo is an
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
against production while its Stage 06 section said dev server. That section
was re-measured in 39bca9c and only the header was left behind.
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
was not deployed: Stage 09A changes no user-visible route.

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
duration. The seed distributions are tied together by identity: seven Active
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
coprime to their length: every element visited once, counts untouched, order
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
  currently rented and legitimately eligible for a *future* window.
  Eligibility is interval-based, status is now-based, and both are right. The
  test now confirms onto a currently-free vehicle and separately asserts that
  an active contract outranks a future reservation.
- The content scan's telephone pattern matched ISO timestamps. Timestamps are
  excluded before the digit patterns run; flagging one would train the next
  reader to ignore the check.

### QA

`qa/stage09c1-operations.mjs`, 211 checks, the whole business suite run twice,
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
compresses poorly (512 costs 164 KB against 55 KB), and a 164 KB tab icon
would be disproportionate in a project whose previous mark was 890 bytes. No
`favicon.ico` exists to shadow it.

At 16px the fine detail dissolves and the silhouette and colour identity
survive; at 20px and above the mark is clearly itself. That was rendered and
looked at, not assumed.

The Stage 03 four-node SVG mark is retired: `SystemMarkImage` became
`PortfolioMark`, the asset is deleted, and the deployment smoke gate now
asserts `/brand/logo-96.png`: a smoke test should check what the site
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
one. No filler cards are invented to keep the row at four, and there are no
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
that schedules no frames at rest, reporting 19 seconds for a 74ms operation.
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
`operations = building`, `currentStage` stays 8, and nothing was deployed:
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
  anything, so the fill was chosen to look plausible, a decoration in the
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
notifications read (eight writes, eight revision bumps) cleared the badge and
emptied the list after the first write while seven were still outstanding. A
reload restored them, so the demo appeared to lose data it had never saved.

The QA harness caught it as an intermittent failure and reading IndexedDB at
the moment the badge cleared confirmed it: six or seven still unread. The
persistence layer was never at fault: the adapter awaits `tx.oncomplete`, so a
resolved commit is durable. The screen was reporting completion before the work
was done.

The hook now keeps the previous answer while re-reading the same question, and
drops it when the question changes. That distinction is the whole fix: keeping
stale data across a role change would have leaked the previous role's records
for a frame, which is the failure D-056 closes (D-058).

- **The KPI breakdown was clipped** between 1180px and 1440px. Each part is
  `nowrap` by design and nothing sat between two of them, so the line had no
  break opportunity and "7 Proposal" was cut off, a list that reads as
  complete and is not. A wrapping flex gap replaced the middle dot. Found by
  reading a production screenshot after the first deployment, which is the
  review workflow of D-061 working on its first pass.

### QA

`qa/stage09c21-operations-hardening.mjs`, 111 checks: KPI semantics and sums,
the role composition matrix, role containment, the mobile sheet at 390 and 360,
the master logo's bytes and the derived mark's geometry, and reset. Full
regression is 719 checks across seven suites, all against a local production
build on port 3001, never 3200, which belongs to the other application here.

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

---

## Stage 09C3.1 - Operations Leads

Status: **Complete**

### Summary
Built the Leads module: the first screen in this product that writes, and the
pattern the remaining nine reuse. Deployed for external review before Customers
begins (D-062, D-067).

Stage 09C3 was split into three (Leads, Customers, then Inbox and the
integrated workflow) because Leads establishes the table, the mobile records,
the detail drawer, the forms, the confirmations and the URL contract that the
others inherit. A problem in the pattern found after three screens exist is a
problem fixed three times.

### The automations were never running

The finding of the stage, and it was invisible from the outside.

The lead services build the right domain events and hand them to
`runtime.commit`, which publishes them on the runtime's event bus.
`processEvents` in `automations.ts` describes itself as *"called by workflows
after the mutation that produced the events"*, and no workflow existed. It had
no caller outside its own module, and the bus had no subscribers. So creating a
website lead never assigned it, and qualifying a lead never scheduled its
follow-up, both of which the frozen 09B contract requires.

The QA harness had appeared to prove otherwise, because it hand-wrote the
events itself with invented ids and called the engine directly. It was testing
the rules correctly while the path production would take did not exist.

`services/lead-workflows.ts` is the join: it runs a mutation, collects what it
published on the bus, and hands that to the rule engine. No service signature
moved and the rules stayed where they were (D-063).

### Also fixed in the domain

Four gaps that a screen would otherwise have papered over with a hidden button
(D-064): archived leads could be edited, restaged and reassigned; a converted
lead could be moved back down the pipeline, contradicting the rule that made
Won unreachable by hand in the first place; editing was the one lead mutation
that wrote no audit entry; and `source` could not be corrected.

### The route became a layout

The provider and shell moved into `/demos/operations/layout.tsx`, so moving
between Overview and Leads no longer disposes the runtime and rebuilds it. The
shell now asks the URL which module it is showing rather than being told.

### Defects the suite passed over

Three, found by reading rendered pixels after the harness was green:

- Lead names rendered in the column headers' monospace face and sat ten pixels
  above their own row: `.ops-table th` out-specifies a row-header class, and a
  row header is data, not a header.
- The last row carried a stub of border under its name alone, because
  `tr:last-child td` does not reach a `th`.
- A just-created lead was reported as an unknown id for about half a second:
  creating one opens it immediately as confirmation, before the list query has
  revalidated, and "not in the list" and "not read yet" were the same branch.

### QA

`qa/stage09c31-leads.mjs`, 281 checks against a local production build (252
against production, where the domain probe route does not exist). Full
regression is 1000 checks across eight suites; see `docs/QA_BASELINE.md`.

### Not done

Nine module screens. `#work` is untouched, the registry still reads
`operations = building`, and `currentStage` stays 8. Stage 09C3.2 is blocked
until the deployed Leads screen has been reviewed live.

---

## Stage 09C3.1.1 - Leads Control Presentation

Status: **Complete**

### Summary
The first external review of Leads found four presentation faults. This stage
fixed those four and nothing else: no business logic, no domain, no seed, no
roles, no automation rules.

### The same fault, three times

A control that did not say what it was.

The **filters** were a small uppercase word beside a browser select: two
elements read as two things, repeated four times across a toolbar, with the
platform's own arrow still on each select. The label moved inside the border,
so `Stage · Qualified` is one object whose current value is part of its name
(D-069).

**Sort** was two controls for one decision: a field in a select and, beside it,
an unlabelled square carrying an arrow. That asked the visitor to work out that
the square belonged to the select, and then which way the arrow meant. It is
one control now, with twelve options that each name a field and a direction:
"Last activity: newest", "Lead name: A–Z". The sort semantics are unchanged.

The **page size** was the same fault at its smallest: `10` behind the words
"PER PAGE", pinned to the far right of a bar whose other contents were a
thousand pixels away. It reads `10 rows` and sits in the footer with the
controls it belongs to.

### The other two

The **pagination footer** was three clusters spread across 1305px with no
shared structure. One grid under a rule now, stacked and centred on a phone,
with real disabled buttons so the first and last page are announced rather than
merely drawn (D-071).

The **provenance band** was a 469px capsule with 608px of empty bar beside it,
reading as a badge stuck on rather than the frame's own statement. Given the
middle column of a three-zone bar it spans 1407px of the 1406px available at
1920, with its text still left-aligned and its words unchanged (D-070).

### Measured, not preferred

The narrow layout is wrapping flex rather than grid because a two-column grid
puts the back link and the controls in one row whether or not they fit, and at
360px they do not. The back link is 120px, the role select's intrinsic width is
167px because "Fleet Coordinator" needs it, and Reset is 59px: 363px of content
in a 321px bar. The grid grew to hold them and the band, spanning both columns,
stretched to that overflowed width. Two rows at 430px and above, three below,
which is what it was before this stage.

### QA

`qa/stage09c31-leads.mjs` grew from 281 to 398 checks across three new
sections. Full regression is 1152 checks. A pre-existing harness weakness was
fixed rather than worked around: the responsive section waited for the
result-count element, which renders a blank placeholder before the query
settles.

### Not done

Nine module screens. `#work` is untouched, the registry still reads
`operations = building`, and `currentStage` stays 8. Stage 09C3.2 is blocked
until the deployed screen has been reviewed live.

---

## Stage 09C3.1.2 - Custom Select System and Em Dash Removal

Status: **Complete**

### Summary
Two narrow corrections. The product now draws its own dropdown menus, and the
em dash is gone from everything this project writes.

### The menu was never ours to style

A native `<select>` can be styled shut but not open. The external review found
six controls whose closed design was right and whose open popup was the
operating system's: square corners, almost no option padding, a saturated
system-blue selection band, a Windows border. No CSS on `<option>` reaches any
of that.

`src/components/demos/DemoSelect.tsx` is the replacement: a `role="combobox"`
button owning a `role="listbox"` the project draws. The trigger keeps the
design approved in 09C3.1.1; only the open state changed (D-072).

Focus never leaves the trigger. The active option is pointed at with
`aria-activedescendant`, which is what keeps Escape, Tab and outside-click
simple: there is only ever one focused element to return to. Enter, Space,
arrows, Home, End and a 600ms typeahead all behave as the ARIA pattern
specifies, and the menu opens onto the current value rather than the first
item.

The menu is portalled into the nearest `<dialog>` when there is one. A modal
dialog sits in the browser's top layer, so a menu portalled to the body from
inside the phone filter sheet would have been painted behind the sheet that
opened it.

Eleven controls use it: the six the review named, plus the create/edit form's
three and the detail's two, which had the same defect and were converted so the
product has one select rather than two kinds.

### No em dash

791 occurrences across 161 files, judged one at a time rather than substituted:
a colon where the second half explains, a comma for an aside, a full stop
between two sentences, parentheses around a bracketed clause with its own
commas, a hyphen in a heading (D-073).

The sort labels became `Last activity: newest`, which is also a better label:
the colon says the direction belongs to the field. The tables' empty-value
placeholder became a hyphen.

`npm run qa:style` keeps it out. It builds the banned character from its
codepoint so the guard does not fail its own rule, and it names file, line and
column.

### QA

`qa/stage09c31-leads.mjs` grew to 407 checks. Full regression is 1165 checks.

One assertion changed meaning. The role-leak test used to drive the role while
a lead detail was open, which `selectOption` allowed because it does not
hit-test. The detail is a modal dialog, so the chrome behind it is genuinely
inert and a visitor cannot reach the role control at all. The suite asserts
that now, then closes the detail and checks the leak protection as before.

### Not done

Nine module screens. `#work` is untouched, the registry still reads
`operations = building`, and `currentStage` stays 8. Stage 09C3.2 is blocked
until the deployed screen has been reviewed live.

---

## Stage 09C3.2 - Operations Customers

Status: **Complete**

### Summary
The second module that writes, and the first assembled entirely from the
patterns Leads established: the same table, mobile records, drawer, overlay,
forms and URL contract. 32 customers, 6 of them converted from the seed's Won
leads, with search, two filters, eight sorts, pagination, create, edit, archive
and a relationship view onto five other modules.

### Role decides what exists, not what is visible

This is the stage's substantial idea. A Finance Analyst cannot open
Reservations, so they do not get a Reservations column showing dashes: the
column is not defined for them, and the reservations collection is never read.
Both the table's columns and the drawer's sections are derived from
`permissions.ts` through one policy table, `customers-view.ts` (D-074).

Finance also gets a different order. Its drawer opens with Contracts and
Payments, so it reads as a finance view of a customer rather than as Admin's
view with three groups blanked out.

### The audit gap

`updateCustomer` recorded status and segment alone. Renaming a customer or
rewriting their notes changed the record and wrote no audit entry, so the
detail's Activity panel stayed silent about a change the visitor had just made
and could see in the fields above it. It now diffs all four fields and writes
only what moved, which is what D-064 settled for leads.

### Archiving says why it will not

A customer holding an Active contract or a Confirmed reservation cannot be
archived. The confirmation states the rule before the attempt, and a refusal
leaves the dialog open carrying the service's own sentence rather than closing
over a generic conflict.

### Shared footer

`OpsPagination` was lifted out of `LeadsScreen` unchanged, classes included, so
the two modules cannot drift into two footers. Leads renders identically after
the move: same range, page label, steps, size control and geometry.

### QA

`qa/stage09c32-customers.mjs`, 174 checks, and one Leads assertion updated
because Customers is now interactive. Full regression is green.

### Not done

Eight module screens. `#work` is untouched, the registry still reads
`operations = building`, and `currentStage` stays 8. Stage 09C3.3 is blocked
until the deployed screen has been reviewed live.

---

## Stage 09C3.3 - Operations Inbox and the CRM Workflow

Status: **Complete**

### Summary
The third module that writes, and the one that joins the other two. A
conversation is always about a lead or a customer, so the Inbox is where the
CRM stops being three lists and becomes one product: 20 conversations, 64
messages, search over subject names and message bodies, three filters, a
transcript, a local reply, assignment, read state, close and reopen, and the
subject's own context beside it.

Stage 09C3 is complete. Leads, Customers and Inbox are all built.

### The shape is different because the work is

Leads and Customers are tables. An inbox is a list kept beside the thread being
read, so both are on screen and each scrolls on its own. No drawer, no
pagination, and a module that fills the height the shell leaves it rather than
growing down the page (D-077).

The three-panel width was measured rather than assumed. A 1180 viewport does
not give a three-panel inbox 1180 pixels: the sidebar appears at exactly that
width and takes 240, and the transcript came out 221 wide. Three panels start
at 1400; from 1180 down it is list and thread with the context behind a
disclosure; below 768 it is one thing at a time (D-082, D-083).

### Two domain gaps, found before the UI

Assignment took any string, so a conversation could be assigned to the Fleet
Coordinator, who cannot open the Inbox, or to an id belonging to nobody. It now
accepts null or an active actor whose role writes Inbox, and refuses the rest
through the typed error contract (D-075).

Assignment and replies wrote no audit at all. The frozen contract said a reply
"writes audit where appropriate" and never said what was appropriate, so this
stage settled it: replies and assignments are audited, read and unread are not,
because marking a thread unread to come back to it is triage rather than
history. The reply entry carries no part of the message body (D-076).

`addSystemMessage` was deleted. Its comment claimed Rule 03 used it; Rule 03
has always done its own commit, and the function had no callers anywhere.

### The assist reconciliation

The frozen contract said the Inbox shows the Lead Brief for lead and customer
conversations. It cannot: a brief is composed from a lead's stage, priority,
vehicle interest and follow-up, and twenty-six of the thirty-two seeded
customers were never leads. Seven of the nine seeded customer conversations
reach no lead at all.

So a lead conversation gets a brief from its lead, a converted customer gets
one from its source lead, and an established customer gets none, with a line
saying why. Nothing is invented for someone who never had a stage (D-078). The
frozen wording is amended rather than quietly reinterpreted.

### The CRM joins up

Inbox opens the lead or customer behind a thread. A lead brief opens the
conversation it talks about. A converted lead opens its customer, which was a
bare id until Customers existed. A customer drawer opens each of its
conversations and its origin lead. Notifications whose source is a lead, a
customer or a conversation now open it (D-084, D-085).

### QA

`qa/stage09c33-inbox.mjs`. The domain half measures the seeded distribution,
proves the audit policy and every assignment refusal, and drives Rule 03 end to
end: confirming a reservation through the real service appends a System message
to the customer's conversation and marks it unread, which proves the automation
without building Reservations early.

### Not done

Seven module screens. `#work` is untouched, the registry still reads
`operations = building`, and `currentStage` stays 8. Stage 09C4 is blocked
until the deployed screen has been reviewed live.

---

## Stage 09C3.3.1 - Inbox Viewport Containment

Status: **Complete**

### Summary
The first external review of the Inbox rejected it. The application sat at the
top of the page with a very large band of portfolio background beneath it: a
1430x2751 document holding an 800px product.

The suspected cause was the `height: 100dvh` the module puts on the demo shell
so its panels can scroll internally. Measurement cleared that rule. The shell
was 800 tall with a scrollHeight of 800, and every box beneath it was contained.

The real cause is that `overflow` clips a descendant only when the descendant's
containing block is inside the clipping box. `.visually-hidden` is
`position: absolute`, nothing between a conversation row and `.site-main` was
positioned, so twenty-four of those spans, including the ", unread" and ", read"
text that gives the list its non-colour unread cue, resolved their containing
block to `.site-main` and escaped every clip. They laid out at their static
offsets, the last at y=2750, giving `body` 2751px of overflow (D-086).

Nothing was visible there, and the document did not scroll. That is exactly why
the suite missed it: it had no assertion on the height of the document and took
only viewport screenshots, which cannot show a region below the viewport.

### The fix

`position: relative` on the five boxes that clip. No layout cost, no repaint,
no `body { overflow: hidden }`, no clipping to shrink a number, no hard-coded
heights.

One regression came with it and the mobile section caught it: a positioned
transcript paints above the static context toggle, so the button stopped taking
clicks on a phone. Positioning the toggle restores DOM order as the tiebreak.

### QA

The Inbox suite now measures the document, captures a full page at eight
viewports, samples the bottom of each capture for backdrop pixels, and asserts
that no absolutely positioned descendant of the module resolves its containing
block outside it. That last check states the rule rather than the symptom.

```
                    before      after
body.scrollHeight     2751        800
full-page capture 1430x2751  1430x800
backdrop below      1951px        0px
```

Overview, Leads and Customers keep their page-growth behaviour, measured
unchanged.

### The second finding

The review's screenshot also showed conversation previews reading "asdf". A
fresh profile against production returns the canonical 20 conversations, 64
messages, 6 unread, 13 Open and 7 Closed with none of that text, a test reply
reproduces it, and Reset demo data clears it exactly. Browser-local mutations
from the review session, not a persistence defect. No product logic changed.

---

## Stage 09C4.0 - Rental Operations Core Readiness

Status: **Complete**

### Summary
The readiness stage for Reservations, Contracts, Fleet, Maintenance and
Payments. No screens. Five of them were about to depend on the frozen domain
contract, and three clauses in it were not being enforced.

### The automation gap, again

`confirmReservation` emits `reservation.confirmed`, the runtime publishes it,
and Rule 03 is written and correct. Nothing listened. The bus is
fire-and-forget with no replay, and the only production subscriber in the
repository was the one the Leads workflow opens.

So a Reservations screen calling the bare service would have reproduced the
defect D-063 fixed for leads, and the QA would have gone on passing, because
both suites that appear to prove Rule 03 works do the join by hand. The
mechanism moved to a neutral `services/workflows.ts`, and
`reservation-workflows.ts` wraps confirm, convert and cancel (D-088). The
screen asks for one business action.

### Two vehicles that disagreed with their own derivation

The contract says a vehicle is recomputed after every mutation touching its
contracts, reservations or work orders. `convertReservationToContract` left it
`Reserved` with a pointer to a reservation that was no longer Confirmed;
`createMaintenance` left it `Available` while an Open work order made the
derivation say `Maintenance`. Both now refresh in the same commit (D-089).

`createReservation` also accepted a `vehicleId` it never validated, so a draft
could name a vehicle that does not exist or the wrong class.

### The invariant, as QA

`qa/stage09c40-core-readiness.mjs` walks the whole fleet after every mutation
and compares each stored vehicle against `deriveVehicleStatus` and
`deriveVehicleLinks` over the resulting world. That is what found both
omissions. 62 checks, and no existing assertion was weakened: the older suites
pass unchanged because the fixes make stored state agree with a derivation they
already trusted.

### Not built

There is no Fleet write service and 09C4.3 cannot start without one. The edit
contract is specified; the create contract is not, because the frozen document
describes the seeded twenty-four asset codes and never says who supplies the
twenty-fifth. Reported with a recommendation rather than decided in passing
(D-090).

### One interaction recorded, not changed

Creating an Open work order on a vehicle out on an Active contract now moves
the stored status to `Maintenance`, because the precedence puts an active work
order above a rental, while starting that work order is still refused because
the contract puts that conflict at start. The tension predates this stage: the
derivation always said Maintenance and the stored record disagreed in silence.
Resolving it would be a specification change and is not taken here.

---

## Stage 09C4.1 - Operations Reservations

Status: **Complete**

### Summary
The first module of the rental group: 18 reservations with search, two filters,
eight sorts, pagination, a detail drawer, create and edit, and the three
lifecycle actions that matter. Everything except confirmation is the CRM
pattern applied again.

### Confirmation is the module

A booking becomes a hold on a real vehicle, so confirmation is not a status
toggle. The surface states the customer, the period and the requested class,
then offers the vehicles the eligibility selector returned for those dates, as
a radio group. The screen never filters the fleet itself.

When nothing is free, confirmation cannot proceed and the surface says which
class is unavailable. No override, no substitute class, no automatic date
change.

### One click, and Rule 03 runs

The action goes through `confirmReservationWorkflow`. A screen calling the bare
service would have left Rule 03 asleep, which is exactly the defect 09C4.0
found and fixed at the workflow layer. The suite proves it from the product
side by reading the store the screen wrote to: one click produces an
AutomationRun, a System message and an unread conversation.

### A draft chooses no vehicle

The create form asks for customer, class, start, end and notes. A draft does
not hold capacity, so a vehicle picked then could be gone by the time anyone
confirms and the field would have shown an allocation that was never made
(D-091). The seed already worked this way.

### Links and facts

Customers is built, so the customer is a link for roles that can open it. The
Fleet Coordinator gets the name without the link, because withholding the name
would stop them doing their own job. Fleet and Contracts are not built, so the
vehicle and the converted contract are facts rather than links (D-092).

### The containment rule, written down

`.ops-reservations` is now `position: relative`. Five `.visually-hidden`
elements in the module are absolutely positioned, and with no positioned
ancestor inside it they resolved against `.site-main`. Nothing clips here so
nothing escaped anywhere visible, but that was a property of this layout rather
than of the markup, and it is the arrangement that produced the Inbox defect
(D-086).

### A shell defect the public build showed

Every sheet on the operations shell was rendering at a flat 720px whatever it
held: 220px of empty panel under the Leads form, 193px under the Customers
form, 188px under Confirm reservation. A dialog is `position: fixed` with
`inset: 0`, and an inset-filling box with `height: auto` stretches to its
containing block rather than to its content, so `auto` resolved to the viewport
and the cap clamped it. `.ops-overlay--sheet` is now `height: fit-content`,
which is what `auto` was written to mean (D-093).

The defect arrived with the shell in 09C3.1, so this changes Leads and
Customers too. Every sheet-touching suite passes unchanged.

### Not done

Six module screens. `#work` is untouched, the registry still reads
`operations = building`, and `currentStage` stays 8. 09C4.2 Contracts is
blocked until Reservations has been reviewed live, and 09C4.3 stays blocked on
the Fleet asset-code contract.

---

## Stage 09C4.A - Rental Operations Core: Contracts, Fleet and Maintenance

Status: **Complete**

### Summary
Three modules in one batch. Demo 01 now has eight of its eleven screens, and
the three that remain are Payments, Automations and Reports.

```
Contracts     14 agreements. Admin activates, completes and cancels;
              Sales, Fleet and Finance read a complete and inert record.
Fleet         24 vehicles. Admin and the Fleet Coordinator add and edit;
              status and every relationship pointer stay derived.
Maintenance   10 work orders. Same two roles open, start, complete and
              cancel; completing raises the fleet notification.
```

### An asset code is issued, never typed

The open half of D-090 is closed. `services/vehicles.ts` is the eleventh
service and the first that allocates a domain identity: the canonical seed ends
at `MTR-024`, so the first created vehicle is `MTR-025` and the next
`MTR-026`.

The allocation reads the highest suffix among the vehicles that exist rather
than the size of the collection, then checks its candidate against the codes in
use. Length would be wrong the moment anyone deleted a record, and the check on
top covers the padded twin that parses to the same number. A suffix is never
reissued (D-094).

### Rule 05, and the third appearance of one defect

`completeMaintenance` emits `maintenance.completed` and Rule 05 listens for it,
but the event bus is fire-and-forget. A Maintenance screen calling the bare
service would have left the canonical notification unwritten while every domain
assertion still passed.

That is the defect D-063 found for leads and D-088 found for reservations,
arriving a third time in the same shape. `maintenance-workflows.ts` and
`contract-workflows.ts` are the answer, and the suite proves the difference by
running both paths: the bare service produces no automation run and no
notification, the workflow produces exactly one of each.

### What holds a vehicle

The batch's QA writes the capacity ladder down, because it is the part of this
domain most likely to be guessed wrong: a draft holds nothing, a confirmed
reservation holds, converting releases, a **pending contract holds nothing**,
activating holds, and an open work order outranks all of it. Capacity is taken
by the deliberate act, not by the paperwork before it.

### The tension is preserved, and stated

A work order may be opened on a vehicle that is out on a rental. The vehicle
then reads Maintenance while the contract stays Active, because only `status`
is a precedence and the three relationship pointers are set independently. The
work cannot be started until the contract completes.

Nothing about that was redesigned. The Maintenance drawer says it in words when
it applies, and the service's own refusal is what a visitor sees if they try.

### Reservations gains two links

D-092 said the assigned vehicle and the converted contract were facts because
Fleet and Contracts did not exist, and that they would become links when they
did. They do now. The Sales Agent still reads the vehicle as a fact, because the
Sales Agent cannot open Fleet.

### A dead activity feed

`ReservationDetail` was calling `selectLeadActivity`, which filters audit
entries by `collection === leads`, with a reservation id. The Reservations
Activity section could therefore never populate. Three new drawers needed the
same narrowing, so it became `selectActivity(entries, collection, entityId)` and
the Reservations call site was corrected with it.

### Not done

Payments, Automations and Reports. `#work` is untouched, the registry still
reads `operations = building`, and `currentStage` stays 8.

---

## Stage 09C4.B - Payments, Automations, Reports, and the finished Demo 01

Status: **Complete**

### Summary
The last three modules. The Rental Operations Platform now has all eleven
screens the specification names, and the temporary scaffolding that carried it
there is gone.

```
Payments      26 records. Admin and the Finance Analyst record against a
              contract; Sales and Fleet never see the module.
Automations   the five frozen rules. Admin enables, disables, tests and reads
              their history. No rule builder, and there will not be one.
Reports       the four frozen groups, read-only, for Admin and Finance.
```

### Overdue reaches Rule 04 by being asked, not by a clock

A payment becomes overdue because time passed, and no mutation accompanies
that. `reconcileTimeDerivedState` existed to raise `payment.overdue` and had no
call sites at all: the same shape of gap D-063 found for leads and D-088 for
reservations, a third time.

`reconcileOverdueWorkflow` is now called when the Payments module opens and
after a payment is recorded. No timer, no poll, no wall clock. The pass skips
any payment that already carries a Finance notification, so a second entry
raises nothing, and calls are serialised so a payment recorded mid-pass cannot
duplicate an alert (D-095).

On the canonical seed the first entry raises three: `payment_0016`,
`payment_0018` and `payment_0019`. The screen says so, once, politely.

### Money at the edge, cents underneath

The record form takes dollars because that is what a person writing down a
payment writes, and `centsFromInput` converts once, in one place, rejecting
anything that is not a whole number of cents. `Math.round(48.5 * 100)` is right
and the two obvious alternatives are not.

Nothing in the module says charge, process, card or bank. It is accounting
state, and the wording is load-bearing.

### Reports is four groups, because the specification says four

The build was briefed toward five report families. The frozen contract says
"Exactly four groups" and names them, so four is what shipped, and the two
selector families written for the others were removed rather than left unused
(D-096). Every share on the page is printed with the denominator it was taken
over, and the component cannot render one without it.

### The build-state mechanism is deleted

`implemented` in `ui/modules.ts` was always declared as temporary build state
rather than product domain, and both `ARCHITECTURE.md` and the file's own header
said it would be deleted once the eleventh module landed. This is that moment.
The flag, the sidebar branch that read it, its two styles and the QA check that
tracked it are all gone. Whether a module appears is one question now, answered
in `permissions.ts` and nowhere else.

### Cross-links finished

The notification centre had three source types and now has eight: a reservation,
payment, maintenance, automation rule and automation run notification all lead
somewhere. The Overview action queue rows became links, which the file's own
comment had been reserving for "a later stage".

`CustomerDetail` was deliberately left alone. Its relation panel is a compact
summary approved in 09C3.2, and turning it into a navigation surface would be a
redesign of an approved module rather than a cross-link.

### Not done

`#work` is still a placeholder and Stage 09 is not complete: Demo 02 and Demo 03
do not exist. `currentStage` stays 8. The registry now reads
`operations = verified`, which turns nothing on:
`workSectionIsPublishable()` needs all three demos and has no callers yet.

---

## Stage 09D0 - Deployment supervision hardening

Status: **Complete**

Infrastructure only. No product behaviour changed and Demo 01 was not touched.

### The defect

On 2026-09-03 `deploy:safe` printed SUCCESS while PM2 sat at `errored`.

The slot switch took 19 seconds rather than the usual 7 to 13. PM2 spawned the
replacement before the previous process had released port 3100, the replacement
died with `EADDRINUSE`, and PM2 retried until it gave up. One earlier child had
bound successfully and went on serving every request correctly, so the public
health check passed and the script concluded SUCCESS.

Production was then a live site owned by a process PM2 had lost: no pid file,
status errored, every `pm2 restart` spawning a child that could not bind. Up,
and with no recovery path, and nothing saying so.

### The invariant

```
A production deployment is successful only when the public service is healthy
AND the service is owned by the intended online PM2-managed portfolio process.
```

Ownership is five conditions at once, held for three consecutive samples inside
a thirty second bound: PM2 knows the process, it is online, its
`PORTFOLIO_DIST_DIR` is the intended slot, something is listening on 3100, and
that listener is the managed pid or a descendant of it (D-097).

The last one is what separates a deployment from an accident, and it is the only
one the incident would have failed on its own.

### What changed in the script

```
step  9   new: supervision check, gating everything after it
step 11   rollback is held to the same proof before it is persisted
step 12   pm2 save runs only after supervision and public health both pass
step 13   final verification asserts and throws, instead of printing OK
```

Every line of the old final verification ended in a hard-coded `OK`, including
the one that printed the PM2 status. That is how a deployment reported success
while the status it printed said errored.

A supervision failure now enters the existing rollback path rather than throwing
past it. A rollback that cannot prove itself supervised is deliberately not
saved: a broken process definition must never reach the resurrect file merely
because something is answering.

### Where the rule lives

`deploy/supervision.mjs`, a pure function with no PM2, no sockets and no
processes in it. PowerShell gathers the facts and asks it what they mean, which
is what lets `qa/stage09d0-deploy-supervision.mjs` test the rule against the
incident and against each failure mode separately, with no deployment involved.

`deploy/pm2-status.mjs` gained `pid` and `uptime_ms`, still printing environment
key names only and never a value.

### Not changed

The A/B release system, the slot names, the smoke test, Caddy, DuckDNS, TLS,
port 3200 and the neighbouring application. What changed is what counts as proof
that a switch worked.

---

## Portfolio landing page finalization - the flagship showcase

Status: **Complete**

### Summary
The homepage was a sequence of five capability sections that stopped. Four of
them presented finished work; the fifth, `#work`, was a Stage 03 navigation
specimen standing in for a section nobody had built yet, and after it the
document simply ended.

It now culminates and it now closes.

```
FeaturedDemoSection   owns #work. Publishes the Rental Operations Platform
                      as an interactive engineering demo, disclosed as one.
FeaturedPreview       a composed picture of the console: eleven module rail,
                      the fleet split, the reservation to payment flow, a
                      rule firing, the payment report.
SiteFooter            an ending. Identity, statement, the way back into the
                      page, a build note. No contact route of any kind.
```

The four frozen section headings are untouched, as is the H1.

### Two publication systems, one anchor

`SelectedWorkSection` publishes real client work and refuses to render until
`MINIMUM_PUBLIC_CASES` is satisfied. It is not imported, not rendered and not
weakened. The demo is published by a different component to a different
standard, and the page says which is which: `INTERACTIVE ENGINEERING DEMO` and
`SYNTHETIC DATA - FRONTEND ONLY` are rendered in the product frame's masthead,
above the preview, from the registry constants (D-098).

The four facts are countable by opening the demo: eleven connected modules,
thirteen domain entities, four simulated roles, five automation rules.

### The page disagreed with the product

The breadth band listed the eleven modules in three hand-typed groups. Directly
above it, the preview drew the console's real sidebar. They did not match:
the typed list put Contracts under "Rental operations" and Inbox under
"Customer operations", while the product puts Contracts under Customer
operations and Inbox under System.

One page, two architectures for one product, and a third waiting behind the
link. The band now derives from `MODULE_GROUPS` and `routesInGroup()`, the
configuration the sidebar itself renders from, and only the group descriptions
are written here (D-099).

### The preview is composed, not screenshotted

A miniature of the real console at this size is a picture of unreadable tables.
The preview is built to work at the size it occupies: hierarchy carries the
meaning before any text matters. Every figure in it is a canonical seed figure,
so the numbers on the landing page are the numbers on the screen.

```
fleet     24 vehicles: 10 available, 4 reserved, 7 rented, 3 maintenance
payments  26 records:  18 paid, 5 pending, 3 overdue
```

No iframe, no chart library, no external image, no duplicated module code.
Static and inert, `role="img"` with a descriptive label, contents hidden from
assistive technology.

### Visual defects found by looking at it

Tests passing is not the same as the page looking finished, and these were
found in screenshots rather than assertions:

```
the flagship headline rendered at default leading over four loose lines
  five invented token names. --leading-display, --tracking-display,
  --weight-display, --leading-relaxed and --motion-quick do not exist, so
  the browser used its defaults. Now matched to the frozen section grammar,
  and every var() in featured.css and page.css audited against tokens.css.

a 230px void in the middle of the preview
  the eleven item rail is taller than the main column's content, and
  `margin-top: auto` on the lower band collected all of the slack into one
  hole. Distributed instead, with the flow given the larger share.

the flow connector drifted off its nodes
  the line's `top` was a constant tuned to a padding that later changed.
  Both now read one custom property.

"/ AUTOMATION" opened the second line of the capability strip
  written as one string it wrapped wherever it fitted. It is a list now, and
  each separator trails its own item, so a wrap can only follow one.

the four notes wrapped three and one
  a two by two grid instead of a ragged flex wrap.

the footer's mark was a stray dot floating above the name
  it sits on the name's line.

the group notes lost their shared baseline
  Customer operations holds four modules and wraps to a second row of chips.
  `grid-template-rows: auto 1fr auto` keeps every note on the same line.
```

### Regression

`qa/stage09-render-safety.mjs` asserted that no work section was wired in, which
described the page this stage was asked to replace. It now asserts what that
absence stood for: the case-study section is neither imported nor rendered, and
the featured section owns the anchor. Its old substring test also read page.tsx's
comment explaining the invariant as a violation of it.

`qa/stage09e-landing.mjs` is new: 87 checks over identity, navigation, the
flagship's content and disclosure, the truth boundary, the ending, eight
viewport widths and reduced motion.
