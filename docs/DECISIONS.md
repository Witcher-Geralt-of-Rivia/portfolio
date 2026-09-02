<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Decisions

An ADR-lite log. Each entry records what was decided and, more importantly, the
evidence behind it, so a later session does not "fix" something that was
deliberate.

Status values: `Accepted`, `Superseded`, `Reversed`.

---

## D-001 - The portfolio visual identity

Status: Accepted
Stage: 01

### Decision
The site uses a bright, soft, multi-hue "milky" atmosphere generated entirely in
CSS and SVG: a stationary base gradient, six drifting aurora fields, two prism
sweeps and a micro-grain dither.

### Reason
The portfolio must read as premium engineering rather than as a template. A
continuously transitioning pastel atmosphere is distinctive, cheap to render and
impossible to mistake for a stock theme.

### Alternatives rejected
Dark developer theme, plain white with accent gradients, generic glassmorphism,
photographic or stock backgrounds.

### Future modification condition
Only on explicit user instruction. The anti-pattern list in
`docs/DESIGN_SYSTEM.md` exists to prevent gradual drift.

---

## D-002 - Persistent aurora rather than a static background

Status: Accepted
Stage: 01

### Decision
The background is never still. Six fields drift on cycles of 31/37/43/35/47/41s
with negative delays, `ease-in-out`, `alternate`, `infinite`.

### Reason
Cycle lengths share no common factor, so the composition never visibly repeats or
resets. Movement is slow enough to be felt rather than watched.

### Alternatives rejected
A static gradient (reads as a template); a single animated blob (reads as a
generic SaaS orb).

### Future modification condition
Movement may be reduced for measured performance reasons, but the page must never
become a static white surface.

---

## D-003 - Grain opacity is 0.024, not the lower figure first sketched

Status: Accepted
Stage: 01

### Decision
`--grain-opacity: 0.024` with `mix-blend-mode: multiply`.

### Reason
Measured. Below roughly 0.021 the dither rounds away entirely at 8-bit precision:
the longest flat run on a scanline stayed at 61px. At 0.021+ it collapses to
about 9px, which is what removes gradient banding. `soft-light` barely registers
on a near-white ground; `multiply` cut the flat run from 61px to 9px.

### Alternatives rejected
0.018 (ineffective), `soft-light` (ineffective at this lightness), `overlay`.

### Future modification condition
Only if measured banding behaviour changes. Re-run `qa/texture.mjs`.

---

## D-004 - Three surfaces only: Milk, Frost, Prism

Status: Accepted
Stage: 01

### Decision
Exactly three reusable surface treatments. Navigation reuses Frost at a slightly
higher alpha rather than defining its own material.

### Reason
A fourth glass system is how a design language becomes incoherent. Constraining
to three keeps every panel recognisably part of the same set.

### Future modification condition
Adding a surface requires an explicit user instruction and an update here.

---

## D-005 - Geist Sans + Geist Mono, self-hosted

Status: Accepted
Stage: 02

### Decision
`geist` npm package, both variable WOFF2 files served from the app via
`next/font/local`. Mono is reserved for machine-facing text.

### Reason
Self-hosting guarantees zero third-party font requests, which is both a privacy
property and a performance one. Verified: the only font resources are
`/_next/static/media/Geist_Variable-*.woff2` (69,652 B) and
`GeistMono_Variable-*.woff2` (71,368 B), with no request to Google Fonts, Adobe
or any CDN.

### Alternatives rejected
Google Fonts CDN, Fontshare, self-converted static weights.

### Future modification condition
Never load a font from a third-party origin.

---

## D-006 - Display measures in calibrated `em`, not `ch`

Status: Accepted
Stage: 02

### Decision
`--measure-display-1: 8.62em` and `--measure-display-2: 10.6em`. Prose measures
stay in `ch`.

### Reason
This is the single most counter-intuitive decision in the project. `ch` resolves
against the *currently rendered* font's "0" advance. Measured: Geist Sans "0" is
0.662em, the next/font metric-adjusted fallback is 0.555em, a 19% gap. So `13ch`
meant 723px before the font arrived and 862px after, which changed the display
heading's line count and cost 0.016–0.021 CLS. Preload and `font-display` tuning
cannot fix it, because it is a unit-resolution problem, not a timing one. The em
values were measured to reproduce exactly 13 and 16 characters per line in Geist;
CLS went to 0.0000 at all six viewports.

### Alternatives rejected
Keeping `ch` (measurable CLS); `font-display: block` (hides text, and the spec
forbids hiding the page while fonts load).

### Future modification condition
Do not revert to `ch` on large type. If node sizes change, re-derive the em value
with `qa/ch-measure.mjs`.

---

## D-007 - `--text-annotation` added; `--text-muted` restricted

Status: Accepted
Stage: 02

### Decision
`--text-annotation: #595e6c` is the accessible small-technical role.
`--text-muted: #7c8190` is decorative only.

### Reason
Measured against the live moving background, muted lands near 3.2:1, below AA
for any meaningful text. Annotation measures 5.2–6.4:1 everywhere it is used.
The Stage 01 muted token was left unchanged rather than altered, so the original
palette is intact and the accessible role is additive.

### Future modification condition
Never use muted for body copy, captions, control labels or technical labels.

---

## D-008 - Five navigation destinations, nothing else

Status: Accepted
Stage: 03

### Decision
Systems, Products, AI Learning, Lab, Work. Defined once in
`src/components/navigation/nav-items.ts`.

### Reason
The portfolio sells capability families, not a personal story. Contact, Hire Me,
About, Blog, Resume, Testimonials and Services are all deliberately absent.

### Future modification condition
Adding a destination requires an explicit user instruction. Adding any contact
destination is forbidden outright. See `docs/PRIVACY_AND_SECURITY.md`.

---

## D-009 - Compact navigation below 900px

Status: Accepted
Stage: 03

### Decision
A 56px top bar plus a floating Frost panel replaces the desktop bar under 900px.
Both presentations are rendered; CSS media queries swap them, so exactly one is
in the accessibility tree.

### Reason
Squeezing five links into a phone-width bar produces unreadable targets. Swapping
by media query rather than JavaScript avoids measuring the viewport in React and
keeps both presentations server-rendered.

### Future modification condition
Keep the accessibility-tree guarantee: the hidden presentation must be
`display: none`, not merely visually hidden.

---

## D-010 - Custom SVG system mark, one canonical source

Status: Accepted
Stage: 03

### Decision
The Stage 03 mark: 890 bytes, viewBox `0 0 28 28`, four connected
nodes plus a central hub. Referenced through a thin `SystemMarkImage` component
using a plain `<img>`.

### Reason
No logo may be downloaded, and no third-party company mark may appear. Keeping
the SVG in one file rather than duplicating it into JSX avoids two sources of
truth. `next/image` would add a wrapper and a loader path for an 890-byte vector
without shrinking anything, so a plain `<img>` with explicit width and height is
correct here, and it keeps the mark shift-free.

### Future modification condition
If the mark becomes interactive or needs per-instance theming, inlining it may be
reconsidered, but then the public file should be removed, not kept alongside.

---

## D-011 - Intelligence Constellation in CSS and SVG, not WebGL

Status: Accepted
Stage: 04

### Decision
The hero artwork is an SVG connection layer plus HTML chips, animated with CSS.
No Canvas, no WebGL, no Three.js.

### Reason
The composition needs about 38 SVG shapes and eight labels. WebGL would add a
large dependency, a canvas that cannot be styled by the design system, text that
does not inherit the font stack, and no accessibility story, all to draw
something CSS renders on the compositor for free.

### Alternatives rejected
Three.js / React Three Fiber, Canvas 2D, an animated raster or video.

### Future modification condition
Only if a future stage genuinely needs real-time 3D, and then only for that
component.

---

## D-012 - Constellation node chips are HTML over SVG, not SVG text

Status: Accepted
Stage: 04

### Decision
The eight capability chips and the orchestrator core are HTML positioned in
percentages over the SVG. Only connections, backplate, grid, relays and signals
are SVG.

### Reason
SVG `<text>` scales with the artboard. At the mobile artboard width (335px) a
13px label would render near 7px: unreadable. As HTML the labels stay at real
CSS pixels and can be tuned per breakpoint, which is what the responsive
requirements demand. Consequence: the core uses a CSS radial-gradient rather than
an SVG one, which is the only way to satisfy both the 112px desktop size and the
78–88px mobile size.

### Alternatives rejected
All-SVG (unreadable mobile labels); per-breakpoint SVG font-size hacks (fragile).

### Future modification condition
If node positions or chip sizes change, re-run `qa/stage04-geometry.mjs` and
`qa/stage04-occlusion.mjs`.

---

## D-013 - No `backdrop-filter` on the drifting chips

Status: Accepted
Stage: 04

### Decision
Constellation chips use a translucent fill, border and shadow: the Frost
language minus the blur.

### Reason
Eight chips drift continuously. A live backdrop filter would be re-computed every
frame for each of them. Over the smooth Stage 01 gradient the visual difference
is not perceptible, so the cost buys nothing.

### Future modification condition
Only if the chips stop moving.

---

## D-014 - Cross-link routing bows asymmetrically

Status: Accepted
Stage: 04

### Decision
`crossCurve()` picks whichever side keeps each arc inside the composition while
still clearing the orchestrator by 82 units, with per-link bend values so no two
arcs run parallel. Ring links use flat alternating chords.

### Reason
The first implementation bowed every ring and cross link outward with a uniform
curvature. Visual inspection showed the result read as a wireframe **sphere**:
meridian lines around an orb, which is an explicit design failure condition.
Asymmetric interior routing restores the network reading.

### Alternatives rejected
Uniform outward bows (the orb); straight chords (cut through the core).

### Future modification condition
After any routing change, inspect a zoomed capture of the constellation for the
orb failure mode. Numbers alone will not catch it.

---

## D-015 - Connections terminate at node edges, never centres

Status: Accepted
Stage: 04

### Decision
Every connection endpoint is computed on the chip's edge (plus a small gap) or
the orchestrator's rim.

### Reason
A line drawn to a node centre passes under its label. Terminating at edges means
a line is always either outside a chip or hidden behind it. Verified: maximum
pixel bleed over label text is 1/255 at 390px and 360px, below the grain
dither's own amplitude. Mobile chip fill is 0.82 alpha rather than 0.72
specifically to keep it there.

### Future modification condition
Re-verify with `qa/stage04-occlusion.mjs` after any geometry change.

---

## D-016 - Mobile capability rail drops its vertical dividers

Status: Accepted
Stage: 04

### Decision
Below 700px the hero capability rail becomes a grid (two-up, then one column
below 380px) with no left borders.

### Reason
Once items wrap, a left border lands at the *start* of a row, where it reads as a
stray mark rather than a separator. It also left the first item un-indented while
the rest were indented, visible as a bug in the first 360px capture. Spacing
carries the separation instead.

### Future modification condition
If the rail returns to a single row on small screens, the dividers can return
with it.

---

## D-017 - `.site-main:has(.hero)` zeroes the shell's top padding

Status: Accepted
Stage: 04

### Decision
The shell provides default top clearance for the fixed navigation; a page that
opens with the hero sets its own larger clearance and the shell stands down.

### Reason
Without it the hero's `clamp(124px, 14vh, 172px)` stacks on top of the shell's
118px, producing roughly 242px of dead space. `:has()` expresses the rule
declaratively where it belongs, rather than pushing page knowledge into
`SiteShell`.

### Future modification condition
If a second hero-like page type appears, generalise the selector rather than
duplicating the padding logic.

---

## D-018 - No scroll cue, and no forced line break in the hero heading

Status: Accepted
Stage: 04

### Decision
No "SCROLL" indicator. The heading uses `text-wrap: balance` with no `<br>`.

### Reason
Both were evaluated visually. The lower band already carries the capability rail
and the constellation's annotations; a scroll marker added clutter without
improving the composition. Balanced wrapping produces "Engineering / intelligent
systems." on desktop and the intended three lines on mobile without help.

### Future modification condition
Only if a tested width produces genuinely inferior wrapping, and then record the
width here.

---

## D-019 - No navigation item is active while the hero owns the viewport

Status: Accepted
Stage: 04

### Decision
`activeId` starts empty and clears whenever no section intersects the detection
band. Systems becomes current only on entering `#systems`.

### Reason
Highlighting Systems while the visitor is still reading the hero misrepresents
where they are. Sections are contiguous, so "nothing intersecting" can only
happen above the first one. Verified: no active item at y=0 and y=400, Systems
active on entry, no flicker at boundaries.

### Note
This intentionally differs from Stage 03's original behaviour. The Stage 03 QA
assertion was updated to match.

---

## D-020 - `allowedDevOrigins` must list the VPS IP, localhost and 127.0.0.1

Status: Accepted
Stage: remote preview

### Decision
`next.config.ts` sets
`allowedDevOrigins: ["108.186.112.75", "localhost", "127.0.0.1"]`.

### Reason
Next 16 blocks `/_next/*` dev resources from origins it does not recognise. A
real browser on the public IP got a 403 on a chunk and a dead HMR socket while
`curl` still returned 200, so a naive smoke test passes while the preview is
broken. `127.0.0.1` is listed explicitly because Next's default allowance covers
the hostname `localhost` but not the literal loopback address, which the QA
harness uses.

### Note
Dev-only. It has no effect on `next build` or `next start`.

---

## D-021 - `scrollbar-gutter: stable` on `html`

Status: Accepted
Stage: 03

### Decision
The scrollbar gutter is reserved permanently.

### Reason
The compact menu locks body scroll. Without a reserved gutter, removing the
scrollbar widens the layout and everything jumps sideways. Verified: layout width
unchanged at 768, 390 and 360 when the panel opens.

### Note
It costs 15px of layout width in desktop-style browsers, which is why the
constellation measures 335px at a 390px viewport rather than 350px. Real touch
devices use overlay scrollbars and are unaffected.

---

## D-022 - QA tooling is retained in the repository

Status: Accepted
Stage: 01 onward

### Decision
`playwright` and `pngjs` stay as devDependencies, and `qa/` keeps its scripts and
screenshot baselines.

### Reason
Every visual claim in this project is measured rather than asserted. The harness
is how a future session verifies that a frozen stage has not regressed, without
rebuilding the measurement apparatus from scratch.

### Future modification condition
Do not remove. Screenshot baselines may be regenerated, but keep the scripts.

---

## D-023 - Typography specimen moved to `/specimen`

Status: Accepted
Stage: 03

### Decision
The Stage 02 specimen lives at `/specimen`; `/` became the navigation and hero
page.

### Reason
Deleting the specimen would have removed the only place the full type scale is
rendered, breaking the Stage 02 regression tests. Moving it keeps the scale
verifiable. It is not linked from the site.

---

## D-024 - No paid AI runtime, no backend, no contact information

Status: Accepted
Stage: project-wide

### Decision
The portfolio ships with no AI provider, no API key, no backend, no database and
no contact route of any kind.

### Reason
Standing product constraints set by the user. AI demonstrations must be
deterministic local simulations, static JSON, scripted sequences or client-side
interaction. The site must function fully with no AI account.

### Future modification condition
Only an explicit user instruction can change these. Until then, treat any request
that implies them as a conflict and report it. See
`docs/PRIVACY_AND_SECURITY.md`.

---

## D-025 - The systems section is one architecture lab, not a feature grid

Status: Accepted
Stage: 05

### Decision
`#systems` is a single interactive System Architecture Lab with four switchable
topologies, plus an execution trace and a four-item principles strip.

### Reason
A capability list or six feature cards proves familiarity with words. A working
topology (input, orchestration, capabilities, validation, human control,
output) shows that the whole system is understood. The brief for this section
was explicitly that a technical client should conclude the developer
understands how complete intelligent systems operate.

### Alternatives rejected
Skill checklist, technology-logo wall, six feature cards, an embedded code
editor.

---

## D-026 - Architecture modes are data, not four JSX trees

Status: Accepted
Stage: 05

### Decision
`architecture-data.ts` declares each mode's nodes, connections, trace and
accessible summary. Components are presentational.

### Reason
Four near-identical hand-built trees would drift apart the first time anything
changed. Positions are fixed percentages and there is no `Math.random()`
anywhere, so screenshots and client experiences are identical every time.

### Future modification condition
Adding a mode means adding a data entry, not a component.

---

## D-027 - Connection gradients use userSpaceOnUse

Status: Accepted
Stage: 05

### Decision
The flow gradient is declared with `gradientUnits="userSpaceOnUse"` spanning
the viewBox.

### Reason
Measured bug. With the default `objectBoundingBox`, a purely horizontal path
has a zero-height bounding box, the gradient degenerates and the connection
renders all but invisible. It showed up as missing links in CRM / ERP
(`Lead / Order -> Normalize`, `Validation -> Notification`) and in Agent
Workflow (`Request -> Intent Router`).

### Future modification condition
Never revert to the default units on a diagram containing axis-aligned paths.

---

## D-028 - Connections are drawn above the spec's opacity range

Status: Accepted
Stage: 05

### Decision
Base connections are `rgba(81,86,102,0.28)` at 1.25px, above the 0.13–0.20
range the Stage 05 brief suggested.

### Reason
Visual inspection. At 0.16 and 1px the routing was effectively invisible, and
the routing is the entire point of the diagram: without it the panel reads as
scattered cards, which is the stated failure condition for this section. The
lines remain far quieter than the node surfaces.

---

## D-029 - The trace drops below the canvas at 1149px, not 999px

Status: Accepted
Stage: 05

### Decision
The side trace column collapses beneath the architecture at 1149px.

### Reason
Measured. With the 280px trace still beside it, a 1024px viewport left the
canvas about 563px wide and Automation's four-node band overlapped
(Queue/Transform and Transform/Condition). Giving the canvas full width at
these sizes removes the overlap; verified at 1024, 1100, 1200 and 768.

### Future modification condition
If node widths or band membership change, re-run the overlap check across
1024–1200 before narrowing this breakpoint again.

---

## D-030 - Production serves alternating release directories, never `.next`

Status: Accepted
Stage: infrastructure hardening (after Stage 05)

### Decision
Production runs from one of two release slots, `.next-release-a` or
`.next-release-b`, selected by `PORTFOLIO_DIST_DIR`. The default `.next` stays
the development and local-build output and is never served in production.
Deployment is `npm run deploy:safe`, which always builds the *inactive* slot.

### Reason
During Stage 05 the live site broke twice: `next build` rewrote the same `.next`
directory the running production process was reading, so the served page
referenced chunks that had just been replaced and the site returned 500s until
PM2 was restarted. Documentation had already warned about this and it happened
anyway. The guarantee had to become structural.

Measured after the change: with production on `.next-release-a`, a plain
`npm run build` ran to completion while the public site was polled continuously.
255 of 255 requests returned 200 across page, CSS chunk and JS chunk. During a
real `deploy:safe` build of the inactive slot, 327 of 327 requests returned 200.

### Alternatives rejected
- Documentation alone: already tried, and it failed.
- A pre-build guard that refuses to build: it would break ordinary local
  builds, which developers legitimately need.
- Copying a built app to a separate production directory: more moving parts,
  and the copy step becomes the new race.

### Consequences
`PORTFOLIO_DIST_DIR` is validated against an allow-list in both
`next.config.ts` and the PM2 process file; an absolute path or a traversal is
rejected. The PM2 file additionally refuses `.next`, so production cannot be
started on the development output even by hand. Both slots are retained after a
deployment so rollback is immediate.

### Future modification condition
Do not point production at `.next`. If a third slot is ever wanted, add it to
both allow-lists and to the alternation logic together.

---

## D-031 - PM2 introspection goes through a Node helper

Status: Accepted
Stage: infrastructure hardening

### Decision
`deploy/safe-deploy.ps1` reads PM2 state via `deploy/pm2-status.mjs` rather than
parsing `pm2 jlist` in PowerShell.

### Reason
PowerShell 5.1's `ConvertFrom-Json` treats object keys case-insensitively and
throws `duplicated keys 'username' and 'USERNAME'` on any Windows process
environment. The deployment script read this as "PM2 process not found" and
aborted. Node's `JSON.parse` handles it, and the helper prints only the fields
the script needs, never an environment value.

---

## D-032 - The deployment strips tooling variables before touching PM2

Status: Accepted
Stage: infrastructure hardening

### Decision
`safe-deploy.ps1` removes `CLAUDE*` variables from its own environment before
any `pm2` invocation, and the PM2 process file declares an explicit `env` block.

### Reason
`pm2 --update-env` re-reads the invoking shell's environment into the managed
process. The first production deployment leaked a tooling token into a
long-lived process that way. The production environment is now two variables:
`NODE_ENV` and `PORTFOLIO_DIST_DIR`.

---

## D-033 - Product surfaces are authored, never screenshotted

Status: Accepted
Stage: 6

### Decision
Every frame in the Product Engineering Studio (the web application window, the
phone, the assist panel) is built from HTML and CSS in this repository. No
screenshot, no device-mockup package, no vendor browser chrome, no notch clone.
The phone carries a neutral sensor capsule and nothing else.

### Reason
The section's claim is that this is our product design. A screenshot of someone
else's interface, or a stock device frame, would demonstrate the opposite. It
also keeps the section at zero external image requests and lets all three
scenarios share one renderer driven by `product-scenarios.ts`.

---

## D-034 - One block renderer per surface, driven by scenario data

Status: Accepted
Stage: 6

### Decision
`WebProductSurface` and `MobileProductSurface` switch over a typed block union
(`tiles`, `chart`, `rows`, `cards`, `timeline`, `map`; `cards`, `progress`,
`checklist`, `suggestion`). Scenarios declare block lists; there is no
hand-built JSX per scenario.

### Reason
The same rule as `architecture-data.ts` in Stage 05. Three near-duplicate
screen implementations would drift, and adding a scenario would mean writing
markup rather than data. The union keeps every scenario type-checked against
the renderers it actually uses.

---

## D-035 - The product flow is a local interval, torn down on every exit

Status: Accepted
Stage: 6

### Decision
`ProductStudio` holds `flowState` and `stepIndex` in React state and advances
them with a single `setInterval`, keyed on the flow state and the scenario. The
effect's cleanup clears the interval, so changing scenario, restarting the flow
or unmounting all abandon the run. No state-management library was introduced.

### Reason
Seven ordered steps do not justify a reducer library. The real risk is a
timer outliving its scenario and writing into the wrong one, so the teardown is
the load-bearing part: measured at zero stale state after abandoning a run
mid-flight. The flow performs no network request of any kind: 0 requests
across 15 runs and 30 scenario changes.

### Consequence
`setStepIndex(0)` happens in the click handler, not the effect body: calling
setState synchronously inside an effect triggers cascading renders and is a
lint error under `react-hooks/set-state-in-effect`.

---

## D-036 - The AI surface is provider-neutral and has no input

Status: Accepted
Stage: 6

### Decision
`AiAssistSurface` renders a heading, a one-line brief and a next action, badged
`AI ASSIST` / `LOCAL SIMULATION`. It has no text input, no transcript, no model
and no network call. The flow's completion swaps the brief for its resolved
form; that is the whole behaviour.

### Reason
The project forbids any paid AI runtime, and a chat box would imply one. What a
product actually needs from an assistive surface is context, a summary and a
next action, which is demonstrable deterministically. Naming a provider would
also date the work and imply a dependency that does not exist.

---

## D-037 - Release slots are ignored by ESLint for the same reason `.next` is

Status: Accepted
Stage: 6

### Decision
`eslint.config.mjs` ignores `.next-release-a/**` and `.next-release-b/**`
alongside `.next/**`.

### Reason
The A/B hardening introduced two more directories holding generated build
output, but the ignore list inherited from `eslint-config-next` only covers
`.next`. Linting them reported 174 errors in code we did not write, and
`safe-deploy.ps1` runs ESLint in its validate phase, so this would have
blocked every deployment from Stage 06 onward.

---

## D-038 - QA harnesses take a base URL, and frozen stages are re-verified against production

Status: Accepted
Stage: 6

### Decision
Every script in `qa/` reads `QA_BASE`, defaulting to `http://127.0.0.1:3000`.
Stage 06 and the Stages 01-05 regression were both measured against the running
production build on `http://127.0.0.1:3100`, not only against `next dev`.

### Reason
Development and production builds differ in ways that matter to what these
harnesses measure: React's development double-render dominates long-task
totals, and dev-only DOM such as `<nextjs-portal>` paints over the page. A
regression suite that can only run against `next dev` cannot answer whether the
thing actually serving the public is correct.

### Consequence
`stage03-desktop.mjs` compared the desktop bar's centre against
`documentElement.clientWidth`. That is right for a classic scrollbar but not for
the overlay scrollbars headless Chromium uses, where `clientWidth` equals
`innerWidth` while `scrollbar-gutter: stable` still reserves 15px. It reported
`centred=FAIL` for a bar centred to 0.00px. The reference is now the content
frame, which is the criterion `QA_BASELINE.md` already documented. The
navigation itself was not touched.

---

## D-039 - The smoke gate asserts every built section, not just the first

Status: Accepted
Stage: 6 (post-stage hardening)

### Decision
`deploy/safe-deploy.ps1` asserts the markup of every built section in the smoke
server's rendered HTML before switching production. Each stage that fills a
placeholder adds its own id and, more importantly, its heading. As of Stage 08
that is seven assertions: the ids `#systems`, `#products`, `#ai-learning` and
`#lab`, plus the Stage 06, 07 and 08 headings.

### Reason
The gate previously checked `#systems` alone, so a build that compiled but
rendered any later section as an empty placeholder would have deployed clean.

The heading is the load-bearing assertion, not decoration. `src/app/page.tsx`
renders every navigation id that is not yet built as a placeholder section, so
`id="products"` was already present in pre-Stage-06 output. Measured against
real build directories, a pre-Stage-06 build is rejected with "Stage 06 heading
missing from HTML" while its `id="products"` assertion passes. An id-only check
would have let that build through. The same held at each later stage: the
Stage 07 build is rejected by the Stage 08 heading assertion and passes every
id.

### Consequence
Changing the `#products` heading copy aborts deployment at phase 7 until the
script is updated to match. That coupling is intentional. It is recorded here
and in `QA_BASELINE.md` so a later session does not read the abort as a bug in
the deployment script.

---

## D-040 - Stage 06 lists stay semantic; the marker is removed locally

Status: Accepted
Stage: 6 (post-stage hardening)

### Decision
The six Stage 06 lists remain real `<ul>`/`<ol>` elements. `products.css`
declares `margin: 0; padding: 0; list-style: none` on six component-local
selectors rather than swapping the elements for `<div>`s or resetting every
`ul`/`ol` in the application from a section stylesheet.

### Reason
The global reset in `globals.css` zeroes margin but not padding or
`list-style`, so the browser's marker box survived: measured at a 40px
inline-start inset on all six lists, pushing rows, timeline, step list,
checklist, event rail and capability rail away from their panel edges.

Replacing the elements with `<div>`s would have removed the marker too, at the
cost of the list semantics screen readers rely on. Resetting bare `ul`/`ol`
from `products.css` would have reached outside the section.

### Consequence
Keep the reset block where it is. `.pweb__timeline` re-declares
`padding: 13px 14px` later in the same file and wins on source order at equal
specificity; that 14px is the timeline panel's design inset, not leftover
marker indentation. Moving the reset later, or raising its specificity, would
silently collapse that panel. `qa/stage06-listreset.mjs` measures all six lists
with the reset neutralised and in force, and encodes the 14px expectation.

---

## D-041 - One renderer draws all three learning visuals

Status: Accepted
Stage: 7

### Decision
A knowledge map, an evaluation graph and a path roadmap are all drawn by
`KnowledgeMap.tsx` from the same `{nodes, links, highlight}` structure in a
shared 520x340 viewBox. Scenarios differ only in data.

### Reason
The three scenarios look like different diagrams but are the same object: a set
of concepts, the dependencies between them, and a route through. Writing three
canvases would have meant three sets of label-collision bugs and three places
to fix a state colour. The single renderer also made the phone treatment a
one-line change rather than three.

### Consequence
A scenario's `highlight` must name nodes that are actually joined by links. The
path builder originally highlighted `validation -> testing -> persistence`, an
edge that does not exist, and the map silently drew one signal instead of two.
The interaction harness now asserts the signal count.

---

## D-042 - The adapt sequence is a reducer with two timers, both torn down

Status: Accepted
Stage: 7

### Decision
`LearningLab` holds scenario, variant index and sequence position in a
`useReducer`. `Adapt` runs a five-stage interval, then a second timer holds
"Path updated" before the control returns to "Adapt again". Both timers live in
effects keyed on the scenario and are cleared by effect cleanup.

### Reason
This is the first sequence in the project that has to move four surfaces
together - map states, highlighted route, journey position and tutor brief. A
reducer keeps that transition in one readable function and makes the illegal
states unreachable: a queued tick cannot advance a finished sequence, and
selecting the current scenario is a no-op rather than a reset.

The teardown is the load-bearing part, as in D-035. Measured: switching
scenario mid-sequence leaves no stale label, no stale announcement and no stale
journey step, and unmounting the section mid-sequence raises no error.

### Consequence
`ARCHITECTURE.md` previously stated an absolute "no `setInterval`" principle
while its own Client/Server Boundary section described the Stage 06 interval.
That contradiction has been resolved in favour of the narrower rule the project
actually follows: nothing runs on a timer at rest, and a user-triggered
sequence may use one interval provided it is torn down on every exit.

---

## D-043 - Map type is sized in viewBox units, so the phone view sheds labels

Status: Accepted
Stage: 7

### Decision
Below 700px the knowledge map raises its label size and hides the prerequisite
labels and the in-node codes. The circles, their states and the highlighted
route all remain.

### Reason
SVG text inside a fixed viewBox scales with the container. At 360px wide the
520-unit box is drawn at 0.52, so a 10px label renders at 5.2px. Raising the
size alone is not enough: bigger labels are proportionally wider, and fifteen
of them collide. Measured before choosing - `qa/stage07-maptype.mjs` reports
rendered size and label-to-label collisions at all eight viewports.

A phone does not need the name of every prerequisite node; it needs to see that
prerequisites exist, what state they are in, and where the route goes. The
accessible summary carries the naming at every width.

### Consequence
Rendered floor is 9.38px at 360px, 10.4px at 390px and 9.69px at desktop, with
zero collisions and zero spill outside the map box in all three scenarios. If
a node is ever added, re-run that harness rather than eyeballing the result.

---

## D-044 - Every experiment is a precomputed frame list

Status: Accepted
Stage: 8

### Decision
Each Engineering Lab experiment declares a list of frames in
`lab-experiments.ts`. A frame carries the complete state the UI needs: the
active flow stage, the observation state and event, and a typed view model.
Running an experiment is an index walking forward on one interval, and the
render is a pure function of that index. There is no `Math.random` and no
generated timing anywhere in the section.

### Reason
Five experiments that each own their own ad-hoc state would have been five
places to leak a timer and five different ideas of what "reset" means. A frame
list makes the whole sequence inspectable, makes Reset a single assignment back
to the initial view, and makes the end state assertable: twenty runs of an
experiment must produce exactly one end state, which the harness checks.

It also keeps the screenshots reproducible, which the specification required.
Variable timing or a random failure would have made every capture a different
picture and every regression ambiguous.

### Consequence
Adding an experiment means writing frames and one view renderer, not a new
component tree. The typed view union is what lets `LabExperimentView` switch
over five visuals while the workspace shell, flow, observation and controls are
written once.

---

## D-045 - The lab shows a TIME field, and never a fabricated one

Status: Accepted
Stage: 8

### Decision
Where an experiment would normally display a latency, it displays a sequence
position instead, labelled as one: "simulated step 6 of 6", "T+2", "retry
delay, widening", "simulated delay". The rate limiter's window is a parameter,
not an elapsed measurement.

### Reason
An API inspector with no timing field looks incomplete, but a fabricated
"42ms" would be a false claim about a system that does not exist. The project
forbids invented metrics outright. Naming the sequence position keeps the
field, keeps it honest, and still communicates that stages happen in order.

### Consequence
If real measurements ever back these surfaces, the labels change from sequence
positions to measurements and the wording must change with them. Until then,
no number in this section may be read as performance.

---

## D-046 - "No database" means no server database; browser-local synthetic storage is permitted

Status: Accepted
Stage: 9A

### Decision
D-024 records the project-wide rule as "no AI provider, no API key, no backend,
no database and no contact route". That entry governs server infrastructure.
The demo platform stores synthetic demo data in the visitor's own browser
through IndexedDB, and this is not a departure from D-024.

### Reason
The Stage 09A specification requires IndexedDB as the primary persistence and,
in the same document, forbids a database server, an API route, a server action,
Redis, a WebSocket server, Firebase, Supabase and any external persistence
service. So the user's explicit instruction both permits browser storage and
restates the prohibition D-024 was written to express.

D-024's own future-modification condition asks that any request implying a
change be reported rather than absorbed silently, which is why this entry
exists instead of a quiet reinterpretation. The distinction is real: a server
database is a request-handling attack surface, an operational dependency and a
running cost. `indexedDB` in the visitor's browser is none of those. Nothing
leaves the machine, nothing is served, and `docs/PRIVACY_AND_SECURITY.md`
already describes the constraint in server terms: "no database connection, so
there is no request-handling attack surface".

### Consequence
D-024 stands unchanged for servers. Browser storage is permitted for synthetic
demo data only, and never for a secret, token, API key or private material.
Anyone reading "no database" in D-024 should read this entry beside it.

---

## D-047 - Native IndexedDB with a memory fallback, and no library

Status: Accepted
Stage: 9A

### Decision
`src/demo-runtime/persistence/` implements the `DemoPersistenceAdapter`
contract twice: over native IndexedDB, and over memory. No Dexie, no idb, no
localForage. Domain services depend on the interface and never on IndexedDB.

### Reason
The required surface is four stores, five indexes, one transaction shape and
one upgrade path. That is less code than the adapter that would wrap a
dependency, and the project already refuses a UI kit, an icon package and an
animation library for the same reason.

The interface is what earns its keep. It makes the memory fallback possible, so
a private window with storage disabled gets a working demo instead of a crash,
and it keeps the runtime's dependency direction pointing one way.

Parity between the two is a requirement, not an aspiration. The memory adapter
structurally clones on read and write, because IndexedDB serialises and a
caller must not be able to reach back into storage through a retained
reference; and it stages writes into copies so a commit is all-or-nothing. A
simplified stand-in would hide exactly the bugs it exists to survive.

### Consequence
Two implementations must be changed together, and the QA harness runs the same
assertions against both. Adding a store means editing `upgrade()` and bumping
`RUNTIME_SCHEMA_VERSION`; it must never mean deleting the database.

---

## D-048 - Deterministic ids, a logical clock, and plans computed before they are written

Status: Accepted
Stage: 9A

### Decision
Entity ids are a monotonic counter per demo and collection, formatted
`customer_0001`. Timestamps come from a logical clock (a seed instant plus a
tick per mutation), never from `Date.now()`. Domain services compute a complete
mutation plan first; the runtime then commits every operation in one
transaction, allocating ids and time against a scratch copy of the demo's
metadata.

### Reason
D-026 and D-044 already establish that this project does not use `Math.random`,
because reproducible screenshots and assertable end states depend on it. Stored
data raises the stakes: a random id or a wall-clock timestamp would mean the
same reset produces a different dataset, so "Reset demo data" would not restore
the state it claims to, a documented example id would be a lie, and no harness
could assert anything about a specific record.

Computing before writing is a correctness requirement rather than a
preference. An IndexedDB transaction commits as soon as control returns to the
event loop with no request outstanding, so a transaction that pauses to compute
has already ended and the rest of its writes land outside it.

The scratch copy is what keeps a failure clean: a builder that throws, or a
write persistence rejects, leaves counters and clock untouched and burns no id.

### Consequence
`crypto.randomUUID()` is not used for canonical entities. Seed data must be
plain data (no generated values, nothing derived from the wall clock) because
reset replays it verbatim and two resets have to produce identical state. The
QA harness asserts that the same reset yields the same dataset, clock and
counters.

---

## D-049 - The runtime knows records; it never knows leads, vehicles or lessons

Status: Accepted
Stage: 9A

### Decision
`src/demo-runtime/` may know records, collections, events, jobs, audit, roles, a
clock and persistence. It may not know any product entity. Each demo's domain
layer sits on top and owns its own vocabulary. The dependency direction is
types → persistence/clock/ids/events → repository → runtime → React → domain →
UI, and nothing flows back.

### Reason
Three unrelated products (an operations SaaS, a field service tool and a
learning platform) can share one runtime only if the runtime has no opinion
about what they store. The moment it learns what a lead is, the second demo
starts working around it and the third rewrites it.

It also keeps the honest claim available. A generic record store with a
deterministic clock is the reusable engineering; the products are what it is
demonstrated with.

### Consequence
Business seeds belong to each product specification, not to Stage 09A. The
runtime QA harness supplies its own generic fixtures ("alpha", "beta") rather
than importing anything from `src/`, so it cannot drift into asserting product
behaviour.

---

## D-050 - Three verified demos are required before `#work` is integrated

Status: Accepted
Stage: 9A

### Decision
`demo-registry.ts` gives every demo a status of `planned`, `building` or
`verified`. The Work launcher may expose only `verified` demos, and
`workSectionIsPublishable()` returns false until all three are. Until then the
`#work` placeholder stays live and `currentStage` stays at 8.

### Reason
The same gate the case-study framework uses, for the same reason: a launcher
that advertises applications which are not finished is a promise the site
cannot keep, and a visitor who follows a link into a half-built demo learns the
opposite of what the section is for.

`building` exists so a demo under construction can be reachable during
development without becoming publishable by accident.

### Consequence
Stage 09 completes only when all three demos are verified and `#work` has been
integrated and QA'd. Until that point no demo route is created at all: an
unfinished product must not be reachable, so a demo becomes a route only when
it is finished.

---

## D-051 - Demo 01 is a rental operations product, specified before it is built

Status: Accepted
Stage: 9B

### Decision
Demo 01's domain is motorcycle and light-vehicle rental operations, published
as "Rental Operations Platform" with the in-app identity "Operations Console".
Its complete product contract (eleven modules, four roles and their permission
matrix, thirteen domain entities, five automation rules, six acceptance
workflows, every seed count and distribution) is frozen in
`docs/DEMO_OPERATIONS_SPEC.md` before any of it is implemented.

### Reason
Rental operations is the one scenario that exercises every capability the demo
has to prove (CRM, fleet, contracts, payments, maintenance, conversations,
automation and reporting) while staying a coherent business rather than a
tour of unrelated screens. A generic "admin dashboard" would demonstrate
layout; this demonstrates a domain.

Specifying first is what makes the derived-state rules possible to honour. The
counts are not decoration: seven Active contracts must be the seven Rented
vehicles, four Confirmed reservations the four Reserved ones, three open work
orders the three in Maintenance. Those identities are cheap to hold if they are
written down before the seed exists and nearly impossible to retrofit once
screens are reading the data.

No brand is invented. "Operations Console" is descriptive rather than a coined
company name, which keeps the demo clear of anyone's trademark, and every
vehicle model is fictional for the same reason.

### Consequence
`qa/stage09b-operations-spec.mjs` asserts the contract in 93 checks, so a
compressed session cannot quietly change a seed count or grow a Settings
module. Stage 09C builds against the document; a genuine blocker is reported
rather than absorbed by editing the specification to match the code.

---

## D-052 - The seed carries audit history, which the runtime must be extended to allow

Status: Accepted
Stage: 9B

### Decision
Demo 01 seeds 63 audit entries, one per state transition its seeded history
implies. Stage 09A's `ResetPayload` carries only `records` and `meta`, so
Stage 09C must extend it with an optional `audit` array and write those rows in
the same transaction as the purge and reseed, in both adapters.

### Reason
Auditability is one of the capabilities Demo 01 exists to demonstrate, and a
Customer or Contract whose Activity panel is empty on first launch demonstrates
the opposite. Every other seeded collection, including automation runs and
notifications, is ordinary records and needs nothing; audit is the one store
the reset payload cannot currently reach.

The alternative was to let audit accumulate only from the visitor's own
actions. That was judged worse: a visitor who has not yet changed anything sees
a product that appears not to record anything.

Recording it here rather than making the change quietly matters because Stage
09A is frozen and tagged `portfolio-demo-runtime-v1`. The extension is small
and preserves every existing guarantee (one transaction, demo isolation, and
identical semantics between the IndexedDB and memory adapters), but it is still
a change to frozen code and should arrive as a decision, not a surprise.

### Consequence
`meta.auditSequence` after seeding is 63 and `revision` stays 0, because
seeding is not a mutation. Both adapters must be changed together, and the
existing parity assertions in `qa/stage09a-runtime.mjs` must be extended to
cover seeded audit before the change is considered done.

---

## D-053 - Overdue is derived, money is integer cents, and the follow-up offset is two days

Status: Accepted
Stage: 9C1

### Decision
Three amendments to the Stage 09B Operations contract, made before any of it
was implemented:

1. A Payment's stored `status` is `Pending | Paid`. `Overdue` exists only as an
   effective value derived from `dueAt` against the logical clock.
2. Every monetary amount (`dailyRate`, `totalAmount`, `paidAmount` and a
   payment's `amount`) is an integer number of cents.
3. Rule 02 sets `nextFollowUpAt` to the qualifying instant plus exactly two
   days.

### Reason
Each closes a gap the Stage 09C1 specification asked to be resolved rather than
chosen silently in code.

The first was a real contradiction. Stage 09B stored all three payment statuses
"so the collection stays queryable" while also deriving the effective value,
which is precisely the stale second source of truth the derived-state rules
exist to prevent. The moment the logical clock passes a due date the stored
value is wrong, and a payments list that disagrees with the demo's own clock
undermines the one claim the section is making. Deriving it costs a comparison
per row on a collection of twenty-six.

The second prevents a class of bug rather than a specific one. A contract
balance is a running subtraction across several payments, and floating-point
dollars accumulate drift through exactly that pattern; integer cents cannot.
The frozen USD 18–46 band is unchanged, expressed as 1800–4600 cents.

The third was simply missing: Stage 09B wrote "a deterministic offset" and gave
no figure. Two days puts the follow-up inside the demo's visible window rather
than beyond every date filter, and it is written down so the next session
cannot quietly make it one.

### Consequence
`qa/stage09b-operations-spec.mjs` asserts all three, so they cannot drift back.
Formatting cents into "USD 24.00" is a presentation concern and belongs at the
UI edge, not in the domain. No stored field anywhere in Operations may carry a
value the clock can invalidate.

---

## D-054 - The approved logo is canonical, and the old design-language name is retired

Status: Accepted
Stage: 9C2

### Decision
`logo.png` at the repository root is the canonical approved portfolio logo,
supplied by the user. It is source artwork: never overwritten, recompressed,
cropped, recoloured or served. Deployable assets are derived from it by
`qa/brand-derive.mjs`.

The design language's previous name is retired. Neutral terminology is the
"Intelligent Systems visual language" or simply the portfolio visual system;
the site identity is "Intelligent Systems Lab", matching the production
domain. The palette, tokens and every visual rule are unchanged.

### Reason
Both are explicit user instructions, and the second is deliberately narrow: a
terminology change, not a redesign. CSS token names were left alone: renaming
`--aurora-lavender` to satisfy a wording change would risk a regression across
eight frozen stages for no gain.

The logo replaces the Stage 03 four-node SVG mark, which is an approved
exception to that stage's freeze. It suits the palette it is joining: a navy
isometric core with sky, mint and lavender orbits, already the project's
colours.

Deriving rather than shipping the master matters. The master is 1254px and
844 KB; the navigation needs 28px and the tab needs 256. `icon.png` is 256
rather than the more usual 512 because the mark is a soft gradient that PNG
compresses poorly (512 costs 164 KB against 55 KB) and a 164 KB tab icon
would be out of proportion in a project whose previous mark was 890 bytes.

At 16px the fine detail dissolves and what survives is the silhouette and the
colour identity; at 20px and above the mark is clearly itself. That is the
stated objective and it was measured rather than assumed.

### Consequence
`qa/stage09c2-operations-ui.mjs` asserts the master's byte size, the presence
of every derivative, that no `favicon.ico` shadows the new icon, that the
retired name appears nowhere in the working tree, and that the old mark has no
remaining references. The old mark file is deleted and the deployment smoke
gate now asserts the new asset instead: a smoke test should check what the
site actually serves.

---

## D-055 - The action queue leads with what is most urgent

Status: Accepted
Stage: 9C2

### Decision
The Overview action queue is ordered overdue payments, then open high-priority
maintenance, then high-priority leads whose follow-up is due, then unread
notifications. Within a category the oldest relevant timestamp comes first,
with the entity id as a tie-break.

### Reason
Stage 09B froze the reverse of this, leading with unread notifications, and
09C2 froze the order above. The two contradicted each other and the
contradiction was visible the moment the screen rendered: the queue opened with
six identical "Lead assigned" rows and the three overdue payments were pushed
off the six-item list entirely. An action list whose first job is to bury the
most urgent item is not doing its job.

The within-category tie-break exists because a list that reshuffles between
renders cannot be acted on, and because it makes the order assertable.

### Consequence
The queue labels carry the data that distinguishes their rows (an amount and
a due date, a customer name) rather than a category that repeats. Raw entity
ids stay in the model for the later stages that will link these rows to their
records, and are not displayed: they are internal plumbing, not product
content.

---

## D-056 - The Overview's composition is one table derived from the permission matrix

Status: Accepted
Stage: 9C2.1

### Decision
`src/demos/operations/ui/overview-policy.ts` maps every Overview surface (each
KPI, each panel, each action-queue category, each notification category) to
the module whose data it summarises, and asks `permissions.ts` whether the role
can open that module. The screen renders what the policy returns and decides
nothing itself.

### Reason
09C2 filtered the KPI cards by role and left everything else alone, so the rule
was half applied. A panel is a module's data in summary form: leaving the Lead
funnel on screen for a role that cannot open Leads makes the Overview a hole in
the policy it is supposed to demonstrate. The same was true one level down:
the action queue and the notification list are built from records belonging to
modules, and both leaked.

The leak was not theoretical. As Finance Analyst the notification badge read
**8** while the panel it labelled held **3**, because the badge counted the
unfiltered set. A visitor comparing the two would have caught it.

Deriving the table from `permissions.ts` rather than restating the matrix is
what stops the two drifting: there is no second place to update when a role
changes.

### Consequence
Panel and KPI composition per role is now:

```
Admin              4 KPIs   Lead funnel · Fleet status · Upcoming · Queue
Sales Agent        2 KPIs   Lead funnel · Upcoming · Queue
Fleet Coordinator  2 KPIs   Fleet status · Upcoming · Queue
Finance Analyst    1 KPI    Payment status · Contract status · Queue
```

Payment Status and Contract Status appear only where a role has no richer
operational panel, so Finance is not left with a single card and a list.
`qa/stage09c21-operations-hardening.mjs` asserts the matrix, asserts that no
role sees a surface from a module it cannot open, and asserts containment: no
role sees anything Admin cannot, and each sees strictly less.

This is still an interaction simulation, not a security boundary: every record
remains readable in browser storage whatever role is selected. What it
demonstrates is that one table governs the whole screen.

---

## D-057 - A KPI states its breakdown, not a progress bar

Status: Accepted
Stage: 9C2.1

### Decision
KPI cards carry either a derived breakdown that sums to the headline, or a
derived note giving the headline its denominator. They carry no progress bars.

### Reason
The bars had no denominator. "38 open leads" is not 38% of anything, so the
fill was chosen to look plausible, a decoration drawn in the visual language
of a measurement, which is the same failure as a fabricated metric even though
no number was invented.

A breakdown does the job the bar was pretending to do. It is checkable on
sight: the parts are counts from the same collections the panels below render,
and they add up to the number above them.

```
OPEN LEADS      38    12 New · 10 Contacted · 9 Qualified · 7 Proposal
PAYMENTS         8    5 pending · 3 overdue
RESERVATIONS     4    4 vehicles currently held
VEHICLES        10    of 24 fleet assets
```

### Consequence
Every KPI is falsifiable from the rest of the screen. The harness asserts the
sums rather than the pixels, and asserts that no comparison language ("vs last
month", "+12%", "trending") appears anywhere: there is no previous period in
this demo, so any comparison would be invented.

---

## D-058 - A revalidating query keeps its previous answer

Status: Accepted
Stage: 9C2.1

### Decision
`useDemoQuery` distinguishes a query's **identity** (status plus declared deps)
from its **trigger** (identity plus revision and nonce). A new revision re-asks
the same question, so the previous answer is kept while the re-read runs and
`loading` reports the refresh. Changed deps ask a different question, so the
previous answer is dropped. A failed read also drops it.

### Reason
Discarding the data on every revalidation made the interface state things that
were not true. Marking eight notifications read issues eight writes; each one
bumped the revision and blanked the query, and `NotificationCenter` renders
`data ?? []`. The result was a badge that vanished and a list that read "No
notifications" while six of the eight writes were still outstanding, and
because a reload then restored the six, the demo appeared to lose data it had
in fact never saved.

The QA harness caught it as an intermittent failure. Measuring the store
directly showed the truth: at the moment the badge cleared, IndexedDB still
held six or seven unread. The persistence layer was correct throughout: the
adapter awaits `tx.oncomplete`, so a resolved commit is durable. What was wrong
was a screen that reported completion before the work was done.

Identity is what decides this, not the trigger. Keeping stale data across a
**dep** change would have been a different bug of the same family: switching
role would show the previous role's records for a frame, which is exactly the
leak D-056 closes.

### Consequence
`OperationsOverview` no longer falls back to its skeleton on every mutation
(the skeleton is for having nothing to show, not for refreshing what is already
on screen), so a change updates the figures in place. Callers that branch on
`loading` behave exactly as before. The shared runtime keeps its rule that
nothing polls and no timer runs at rest.

---

## D-059 - The mark is derived tight, not square

Status: Accepted
Stage: 9C2.1

### Decision
`public/brand/mark-120.png` is trimmed to the artwork's own bounds plus a 5%
margin, keeping its 1077×1231 aspect, and is rendered 30px tall in the site
navigation and 22px tall in the demo bar. The square derivatives remain for the
favicon and app icons, where a square frame is required.

### Reason
The master centres a 965×1119 mark inside a 1254 square, so roughly 11% of each
side is transparent padding. Rendered at 28px square that left about 25px of
visible mark, reading small beside 12px type. The padding was measured, not
assumed: alpha bounds at both `>1` and `>128` give the same figure, which is
what proves the horizontal margin is genuinely empty rather than faint glow.

Trimming to a square would have recovered only about 2%: the artwork is taller
than it is wide, so a square trim is bounded by its height. Preserving the
aspect is what recovers the rest.

### Consequence
The master `logo.png` is untouched, and the harness asserts its byte count and
dimensions on every run. The derived mark keeps a safety margin so the soft
outer glow is not shaved, and its corners stay fully transparent so no plate is
drawn behind it on any surface.

---

## D-060 - The shared bar stands down where the product names itself

Status: Accepted
Stage: 9C2.1

### Decision
`DemoShell`'s `title` is optional and the Operations demo passes none. A demo
that names itself inside its own interface is not named again by the shared
chrome. The filler that holds the bar's row open is hidden once the bar wraps.

### Reason
The bar read "Operations Console" directly above a product whose sidebar and
route heading already said so: the same words three times in the top 120px.
Naming is the product's job; the shared bar's job is the disclosure, the way
back, and the reset.

The filler had to stand down with it. It carries no `order`, so in the wrapped
layout it sorted ahead of the back link and claimed a whole row, pushing "←
Portfolio" to the right-hand edge of a phone screen. `margin-left: auto` on the
controls does the same work without occupying a row.

### Consequence
On a phone the bar is three honest rows (back, then role and reset, then the
disclosure) with every item on screen and no empty row. The disclosure text is
unchanged and remains mandatory on every demo route.

---

## D-061 - Demo 01 is deployed for external review before its remaining modules are built

Status: Accepted
Stage: 9C2.1

### Decision
`/demos/operations` ships to production carrying the shell and the Overview,
with its other ten modules rendering as non-interactive labels. The registry
keeps `operations = building`, `#work` is untouched and still renders its Stage
03 placeholder, and Stage 09C3 does not begin until the deployed build has been
reviewed live.

### Reason
The four defects this stage fixed (a decorative progress bar, a half-applied
role rule, a notification panel that overflowed a phone, a mark too small to
read) were all found by looking at rendered pixels, and three of them survived
a QA suite that passed. A local production build answers whether the code
works; it does not answer whether the product reads well on a real screen at
arm's length. Deferring that judgement until all eleven modules exist would
mean discovering shell-level problems eleven times over.

Shipping it does not advertise it: the demo routes are `noindex, nofollow`,
nothing links to them from the site, and `currentStage` stays at 8.

### Consequence
The next task is blocked, deliberately, on a human looking at the live URL.
Deployment used `npm run deploy:safe` and the shared host's other application
was verified healthy afterwards.

---

## D-062 - Stage 09C3 is built one module at a time

Status: Accepted
Stage: 9C3.1

### Decision
The 09C3 umbrella (Leads, Customers and Inbox) is built as three stages:
09C3.1 Leads, 09C3.2 Customers, 09C3.3 Inbox and the integrated CRM workflow.
The scope of 09C3 is unchanged; only its sequencing is.

### Reason
Leads is the module that establishes the patterns the others reuse: a data
table, a mobile record list, search, filters, sort, pagination, a detail
drawer, forms, confirmations, URL-driven selection and mutation feedback.
Building three screens before any of those patterns had been reviewed would
mean discovering a problem in the pattern three times over, the same argument
D-061 makes about the shell, one level down.

### Consequence
Each sub-stage ends the way 09C2.1 did: local QA, a safe deployment, and a stop
for external review before the next begins. `docs/NEXT_STAGE.md` names 09C3.2
as the next task and records that it is blocked until Leads has been reviewed.

---

## D-063 - Mutations wake the automation rules through a workflow layer

Status: Accepted
Stage: 9C3.1

### Decision
`src/demos/operations/services/lead-workflows.ts` runs a lead mutation, collects
the domain events it published on the runtime's event bus, and hands them to
`processEvents`. The Leads screen calls these workflows rather than the bare
services wherever a rule is meant to fire.

### Reason
The rules were not running at all.

The lead services build the correct domain events and hand them to
`runtime.commit`, which publishes them. `processEvents` in `automations.ts`
says of itself: *"Called by workflows after the mutation that produced the
events."* No workflow existed, `processEvents` had no caller outside its own
module, and the runtime's event bus, built for exactly this, had no
subscribers. So creating a website lead never assigned it, and qualifying a
lead never set a follow-up date, both of which the frozen 09B contract
requires.

The QA harness appeared to prove otherwise because it hand-wrote the events
itself, with invented ids (`"e1"`, `"e2"`), and called `processEvents`
directly. It was testing the rules, correctly, while the path production would
take did not exist.

Collecting from the bus rather than changing the services is what keeps the
change small: no service signature moves, no existing caller breaks, and the
rules stay entirely in `automations.ts`. A screen asks for "this mutation and
whatever it sets off" without knowing what that is.

### Consequence
Creating a Website lead now assigns it to a sales agent and raises a
notification; qualifying a lead sets the follow-up two logical days out and
raises another. Both are visible in the product immediately, and both appear in
the lead's activity.

The collector is unsubscribed before the rules run, so the rules' own commits
are not fed back in. The bus is per-runtime rather than per-caller, so two
mutations genuinely in flight together would each collect the other's events;
every caller is a control that disables itself while its own mutation is
pending, and the module says so rather than leaving it to be discovered.

---

## D-064 - The lead domain gained the guards the screen would otherwise have faked

Status: Accepted
Stage: 9C3.1

### Decision
`services/leads.ts` now refuses to edit, restage or reassign an archived lead,
refuses to restage a converted one, and records an audit entry when a lead is
edited. `UpdateLeadInput` accepts `source`. `services/context.ts` gained
`read.actors`.

### Reason
Four gaps, each of which would otherwise have been papered over by a hidden
button:

- **Archived leads were mutable.** Only conversion refused them. A screen that
  merely hides the controls is the pattern `permissions.ts` explicitly warns
  against: a rule enforced by a hidden button is not enforced.
- **A converted lead could be moved back down the pipeline.** `changeLeadStage`
  refused Won so that a Won lead always has a customer behind it, and then
  allowed the same contradiction from the other side: a Won lead with a live
  `convertedCustomerId` could be set back to New.
- **Editing was not audited**, while every other lead mutation was. The detail
  drawer's activity was silent about a change the visitor had just made and
  could see in the fields above it.
- **Source could not be corrected.** Recording where a lead came from is
  ordinary record-keeping.

### Consequence
The audit entry lists only the fields that actually moved, so resubmitting a
form unchanged does not add noise to the activity feed.

Making `source` editable does **not** re-run the website assignment rule, and
not because anything checks for it: the rule is triggered by
`lead.created.website`, and an edit emits no domain event at all. The guarantee
is structural rather than a condition someone has to remember to write.

---

## D-065 - A lead reaches Won by being converted, and the menu says so

Status: Accepted
Stage: 9C3.1

### Decision
The stage control offers New, Contacted, Qualified, Proposal and Lost. Won is
absent. A lead reaches Won through **Convert to customer**, which creates the
customer and closes the lead in one commit.

### Reason
The domain already refused Won as a manual stage change, so offering it would
have been a menu item that exists to fail. The rule behind that refusal is the
one worth stating: a Won lead with no customer behind it is a contradiction the
product would then have to explain.

This is product interaction policy, not a schema change. `LeadStage` still
contains Won, because that is what a converted lead is.

### Consequence
The Convert action is withdrawn once a lead is converted, and the drawer says
where the lead ended up instead. The domain still raises CONFLICT on a second
conversion, and the QA suite asserts both layers: the button that is not there
and the service that would refuse anyway.

---

## D-066 - The selected record lives in the URL; the list query does not

Status: Accepted
Stage: 9C3.1

### Decision
`?selected=lead_0007` is the whole of the selection contract. Search, filters,
sort, page and page size are local component state.

### Reason
Selection is the thing a visitor expects to be able to link to, and the thing
Back should undo. Holding it in React as well would create a second answer the
address bar could contradict.

The list query is deliberately not in the URL. Every keystroke in the search
box would become a history entry, and Back would then walk letter by letter out
of a search term instead of closing what the visitor opened, which is the one
job Back has on this screen.

### Consequence
Row click pushes, so Back closes the detail and Forward reopens it. A deep link
opens the record it names. An id that matches nothing renders a contained
"Lead unavailable" panel rather than an empty drawer or a crash.

Archiving **replaces** its history entry instead of pushing, so Back cannot
return to a record that no longer exists.

"Not in the list" and "not read yet" are different answers, and conflating them
was a real defect: creating a lead opens it immediately as confirmation, at
which point the list query has not revalidated, so the new record genuinely is
not in `data` yet. Reporting that as an unknown id told the visitor their new
lead did not exist, half a second after they made it. Absence only means
anything once the query has settled.

---

## D-067 - Leads is deployed for external review before Customers is built

Status: Accepted
Stage: 9C3.1

### Decision
`/demos/operations/leads` ships to production. The registry keeps
`operations = building`, `#work` is untouched, `currentStage` stays 8, and
Stage 09C3.2 does not begin until the deployed screen has been reviewed live.

### Reason
The same argument as D-061, now with evidence behind it. This stage's own
review found defects that the suite had passed over: lead names rendered in the
column-header face and sat ten pixels above the row they belonged to, because
`.ops-table th` out-specifies a row-header class; the last row carried a stub
of border under its name alone.

Leads is also the pattern every later module reuses. A shell-level problem
found after Customers, Reservations and Contracts exist is a problem fixed four
times.

### Consequence
The demo routes remain `noindex, nofollow` and nothing links to them. The next
task is blocked, deliberately, on a person looking at the live URL.

---

## D-068 - The source is published, and authorship was anonymised once to allow it

Status: Accepted
Stage: 9C3.1

### Decision
The repository is public at `https://github.com/Witcher-Geralt-of-Rivia/portfolio`
on branch `main`. Every verified commit and tag is pushed after its own stage's
QA (and after production deployment, where the stage requires one), and the
remote SHA is verified against the local one.

Before the first push, and only then, the author and committer email on all 25
commits and the tagger on all 13 tags were rewritten from a personal address to
the account's GitHub noreply address. History rewriting is prohibited again.

### Reason
Publishing the history publishes its metadata. Every commit carried a personal
Gmail address, and the GitHub account is pseudonymous, so pushing as-is would
have permanently linked the pseudonym to that address and put it in every
clone. The project already forbids an email address on every surface of the
product; git authorship is the one surface that rule had not reached.

The rewrite had to happen before the first push or not at all. Once a commit is
public it is cloned, forked and cached, and rewriting afterwards changes every
SHA without unpublishing anything.

Nothing else changed. The tree hash of the final commit is identical before and
after (`74c791f8`), and messages, timestamps, order, tag names and tag messages
were all preserved. Only the identity fields moved.

The prohibition is restored deliberately: a public history is a shared artefact,
and rewriting one after publication breaks every clone that has it.

### Consequence
Commit SHAs from before publication are obsolete; the one reference to an old
SHA in `docs/CHANGELOG.md` was updated with the rewrite.

`qa/public-repo-safety.mjs` runs before a publication push. It refuses tracked
`.env` files, private-key material, build output committed by accident and
recognisable credential prefixes, at HEAD and across the whole history. It is a
guard against known mistakes and not a proof of absence, and it says so when it
passes.

Publishing and deploying are now explicitly separate operations, recorded in
`docs/DEPLOYMENT.md`: a push changes nothing on the server, a deployment
publishes nothing, and a failed push never justifies rolling back a good
deployment.

---

## D-069 - A control states what it is, and a sort states which way

Status: Accepted
Stage: 9C3.1.1

### Decision
`ui/OpsSelect.tsx` is the Operations product's select: the contextual label
lives inside the control's border, the platform arrow is replaced by a locally
drawn chevron, and a non-default value is marked in ink rather than colour.
The Leads filters, the sort and the page size all use it, and later modules
reuse it rather than restyling their own.

Sort is one control. Each of the six fields appears with both of its
directions, worded for the field ("Last activity: newest",
"Lead name: A-Z"), and the separate direction button is gone.

### Reason
The first external review of Leads found four presentation faults, and three
of them were the same fault: a control that did not say what it was.

The filters were a small uppercase word beside a browser select. Two elements,
read as two things, repeated four times across a toolbar: the label was
detached from the value it labelled, and the select still wore the platform's
own arrow, so the row looked like a form someone had not finished styling.
Inside one border, `Stage · Qualified` is a single object whose current value
is part of its name.

Sort was worse, because it was two controls for one decision: a field in a
select, and beside it an unlabelled square carrying an arrow. That asked the
visitor to work out that the square belonged to the select, and then which way
the arrow meant. Twelve options that each name a field and a direction ask
nothing.

The page size was the same fault at its smallest: `10` behind the words "PER
PAGE", pinned to the far right of a bar whose other contents were a thousand
pixels away. `10 rows`, in the footer with the controls it belongs to.

A real `<select>` underneath all of it. `appearance: none` takes the platform's
arrow and nothing else: the keyboard behaviour, the screen-reader semantics and
the native option list on a phone all remain, and none of them would have been
free in a hand-built menu.

### Consequence
Width is left to the browser, which sizes a select to its widest option, so a
control does not resize when its value changes: choosing "Returning customer"
cannot reflow the toolbar under the pointer. The QA suite asserts that, along
with the geometry (40–42px filters, 38–40px page size, 11–12px radii), the
active marking, the accessible names and the absence of the old direction
button.

The marked state is border and ink, not a fifth accent colour: the stage pills
already carry four hues, and a saturated "this filter is set" would compete
with the data it is filtering.

Focus is drawn on the wrapper with `:focus-within` rather than
`:has(:focus-visible)`. The select's own outline is suppressed, so a browser
that did not understand the selector would leave the control with no visible
focus at all; a ring that also appears on click is the native behaviour of a
select anyway, and is the safe direction to be wrong in.

---

## D-070 - The provenance band takes the width, and gives it back on a phone

Status: Accepted
Stage: 9C3.1.1

### Decision
The demo chrome is three zones (identity, provenance, controls) with the
middle one `minmax(0, 1fr)`, so the disclosure band grows into whatever the two
ends leave. Below 861px the bar returns to wrapping flex and the band takes a
full-width row of its own.

The words are unchanged: `INTERACTIVE ENGINEERING DEMO` and
`SYNTHETIC DATA · FRONTEND ONLY`.

### Reason
The disclosure was a 469px capsule with 608px of nothing between it and the
role control. It read as a badge stuck onto the bar rather than the frame's own
statement about what is inside it, which is the one thing that bar exists to
say. Given the middle column it spans 1407px of the 1406px available at 1920,
and its text stays left-aligned so the words start where the eye already is.

The narrow layout is flex rather than grid, and that is measured rather than
preferred. A two-column grid puts the back link and the controls in one row
whether or not they fit, and at 360px they do not: the back link is 120px, the
role select's intrinsic width is 167px because "Fleet Coordinator" needs it,
and Reset is 59px: 363px of content in 321px of bar. The grid grew to hold
them and the band, spanning both columns, stretched to that overflowed width.
Wrapping flex lets the row break on its own terms, and `flex-basis: 100%` on
the band still forces it onto a row of its own.

### Consequence
At 430px and above the bar is two rows; below that it is three, which is what
it was before this stage. Nothing is clipped and nothing overflows at any
tested width. Making it two rows on a phone would mean either clipping a role
name or dropping the word "Portfolio" from the back link, and neither is worth
28 pixels.

---

## D-071 - The pagination footer is one bar

Status: Accepted
Stage: 9C3.1.1

### Decision
The range, the Previous/Next controls and the page size sit in one grid under a
rule: range left, controls centred, page size right. On a phone they stack
(range, page indicator, the two steps side by side, then the page size), and
nothing is pinned to an edge alone.

### Reason
They were three clusters spread across 1305px with no shared structure, so they
read as three unrelated fragments rather than one footer. Previous and Next
were quiet buttons indistinguishable from every other quiet button on the
screen, and the page size was a bare number under a label at the far right.

### Consequence
The steps are real `<button disabled>` on the first and last page, so the state
is announced rather than merely drawn, and they keep their size when disabled so
the row does not resize as the visitor pages through. The page indicator is a
polite live region: the number changing is the result of the visitor's own
click, not news to interrupt them with.

---

## D-072 - The product draws its own select menu

Status: Accepted
Stage: 9C3.1.2

### Decision
`src/components/demos/DemoSelect.tsx` is the demo platform's select: a
`role="combobox"` button that owns a `role="listbox"` the project draws itself.
Every select in the product uses it - the three Leads filters, the sort, the
page size, the demo role, and the create/edit form and detail controls.

### Reason
A native `<select>` can be styled shut but not open. The popup belongs to the
operating system, so however carefully the closed control is drawn, opening it
produced square corners, almost no option padding, a saturated system-blue
selection band and a border from Windows. The external review found the same
defect on six controls at once, and no amount of CSS on `<option>` addresses
it: the element is not ours to style.

So the menu is authored and the trigger keeps the design that was already
approved. Only the open state changed.

### Consequence
The pattern is WAI-ARIA's select-only combobox, and focus never leaves the
trigger: the active option is pointed at with `aria-activedescendant`. That is
what keeps Escape, Tab and outside-click simple, because there is only ever one
focused element to return to. Enter, Space, ArrowUp, ArrowDown, Home, End and a
600ms typeahead buffer all behave as the pattern specifies, and the menu opens
onto the current value rather than the first item.

The accessible name is `aria-labelledby` over the visible label and the current
value together, so a reader hears "Stage, All stages" once instead of a
decorative label read and then repeated.

The menu is portalled into the nearest `<dialog>` ancestor when there is one
and into `document.body` otherwise. A modal dialog sits in the browser's top
layer, above every z-index on the page, so a menu portalled to the body from
inside the filter sheet would have been painted behind the sheet that opened
it. Fixed positioning, measured from the trigger, keeps it clear of any
scrolling ancestor that would otherwise clip it, and it flips above the trigger
when there is not room below. Twelve sort options cap at 320px and scroll.

Stacking is stated rather than raced: 70 for these menus, above the
notification panel and mobile drawer at 60 and the chrome at 40.

One menu is open at a time, enforced by a module-level registry rather than by
hoping two never overlap.

There is no new dependency. The one timer is the typeahead buffer, cleared on
unmount.

---

## D-073 - No em dash in anything this project writes

Status: Accepted
Stage: 9C3.1.2

### Decision
The character U+2014 does not appear in project-authored content: UI copy,
documentation, source comments, QA messages, metadata or commit messages.
`npm run qa:style` enforces it over every tracked text file.

### Reason
The project owner rejects it. That is sufficient reason for a house style rule,
and house style is worth having written down rather than re-litigated.

The rule is not "replace it with a hyphen". An em dash does several different
jobs, and each wants its own punctuation: a colon where the second half
explains the first, a comma for a loose aside, a full stop where the halves are
really two sentences, parentheses around a bracketed clause that contains its
own commas, a hyphen in a heading or a label. Substituting one character
everywhere would have left 765 sentences that parse but do not read.

### Consequence
765 occurrences across 154 files were rewritten, each judged in context. The
Leads sort labels moved from "Last activity - newest" with an em dash to
"Last activity: newest", which is also a better label: the colon says the
direction belongs to the field.

The empty-value placeholder in the tables moved from an em dash to a hyphen.

`qa/copy-style.mjs` builds the banned character from its codepoint rather than
typing it, so the guard does not fail the rule it enforces. It reports file,
line and column, and prints the offending line with the character replaced so
its own output stays clean.

One caveat is recorded rather than hidden: `AGENTS.md` is regenerated by
`next dev`, and the two em dashes it writes will return if that command is run.
The guard catches it; the fix is to correct the file again before committing.

The en dash (U+2013) is a different character and is not covered by this rule.
A few remain in numeric ranges such as `40-42px` and in the pagination range.

## D-074 - A withheld surface is not defined, not blanked

Status: Accepted
Stage: 9C3.2

### Decision
When a role may not see something, the surface that would show it is not
composed at all. Customers derives both its table columns and its detail
sections from `permissions.ts`: `customerColumnsFor(role)` and
`relationSectionsFor(role)` filter through `canViewModule`, and the screen does
not read a collection the role cannot open.

A Finance Analyst therefore gets six columns rather than seven with the
Reservations column dashed out, and a drawer that opens with Contracts and
Payments rather than five groups with three of them empty.

### Reason
A column of dashes is not neutral. It tells the reader that a fact exists,
that it belongs to this record, and that the application is keeping it from
them, which is a worse answer than not offering the column.

Ordering carries the same information. Blanking sections in Admin's order
leaves a finance view shaped like a sales view with holes in it; putting
Contracts and Payments first makes it a finance view of the customer.

Deriving both from the matrix rather than restating it is what stops the two
from drifting. The alternative, a conditional at each render site, is the bug
D-058 guards against in a different costume: enforcement in one place, decided
once, is the property worth demonstrating.

### Consequence
`customers-view.ts` is the module's policy table and the only place that knows
which module owns which column or section. The screen and both list
presentations read from it, so the table and the mobile cards cannot disagree
about what a role may see.

The role-keyed query is the other half. `CustomersScreen` fetches contracts
only when the role can open Contracts, and `CustomerDetail` keys its relations
query on the role as well as the record, so a role change drops the previous
answer rather than showing it for a frame.

Origin stays for every role. That a customer was converted from a lead is the
customer's own fact; only the link through to the lead record depends on being
able to open Leads.

## D-075 - An Inbox assignee must be someone who can work the Inbox

Status: Accepted
Stage: 9C3.3

### Decision
`assignConversation` accepts null, or an actor who is active and whose role has
write access to Inbox. Anything else is refused with the typed error contract:
an unknown id is VALIDATION, an inactive or wrong-role actor is CONFLICT.

`inboxAssignees(ctx)` derives the same set from the same matrix and is what the
assignment control offers. In the canonical seed that is Morgan Reed and Avery
Chen.

### Reason
The service took any string. Nothing stopped a conversation being assigned to
the Fleet Coordinator, who cannot open the Inbox, or to an id belonging to no
one. The record would then name an owner who could never act on it, and the
list would show their name beside work they are unable to reach.

Filtering the option list is not a fix. An option list is a convenience; the
rule has to live where the write happens, or it holds only for as long as every
future screen remembers to filter. That is the same argument `permissions.ts`
makes for enforcing in the service rather than the sidebar, and this was the
one Inbox write that had escaped it.

The frozen contract does not define the assignable set. It lists `assign` among
the Inbox operations and declares `assignedActorId`, and says nothing more, so
this is a reconciliation rather than a change: the rule chosen is the one the
permission matrix already implies.

### Consequence
Four refusals the domain now makes that it did not: an unknown actor, an
inactive actor, an actor whose role cannot write Inbox, and a reassignment to
the value already stored. The last is a conflict for the same reason closing an
already-closed conversation is one.

The audit entry names people rather than ids, which is what D-076 settles.

---

## D-076 - What the Inbox audits, and what it does not

Status: Accepted
Stage: 9C3.3

### Decision
```
reply          audited   conversation.replied
assignment     audited   conversation.assigned
close, reopen  audited   conversation.closed / conversation.reopened
read, unread   not audited
```

The reply entry says `Reply added to conversation` and carries no part of the
message body. The assignment entry names both ends as people: `Conversation
assigned to Avery Chen`, or `Conversation unassigned`, with the change recorded
as display names rather than actor ids.

### Reason
The frozen contract says a reply "writes audit where appropriate" and never
says what is appropriate. Its general rule is the one that decides this:
meaningful business mutations are audited, and the things it lists as never
audited are search, filter, drawer opened, chart hovered, page navigated, sort
changed.

Read state belongs with that second group. Marking a thread unread to come back
to it is triage, not history: it records how someone is working their own list,
not something that happened to the customer. Auditing it would bury the entries
that matter under a stream of one person's housekeeping.

Assignment is the opposite. It changes who owns the work, which is exactly the
kind of thing someone asks about later, and it was writing nothing at all.

A reply is audited because a message is a business record, but the body is not
copied into the entry. The Message already holds the words; duplicating them
would put a visitor's own typing into a second store, and an audit summary is
meant to be read at a glance rather than to be a second transcript.

Names rather than ids for the same reason: an audit line nobody can read is a
line nobody reads.

### Consequence
Four `conversation.*` audit actions exist in code and none of them appear in
the frozen spec, which names only the `conversation.message_added` domain
event. The spec is amended to record the policy above rather than leaving four
undocumented strings in the vocabulary.

The seeded audit total stays 63. No seeded conversation carries an entry, so
the Inbox's Activity is empty until someone acts, which is correct: nothing has
happened to those threads yet.

---

## D-077 - The Inbox is a workspace, not a table

Status: Accepted
Stage: 9C3.3

### Decision
Inbox does not paginate, does not grow down the page, and does not reorder
itself when a thread is read.

- No pager. The canonical dataset is twenty conversations and the frozen
  contract asks for none.
- The module fills the height the shell leaves it, and the list, the transcript
  and the context each scroll on their own.
- The order is frozen: most recent message first, conversation id ascending to
  break a tie.
- The list preview is read from the latest Message, never stored on the
  Conversation.

### Reason
Leads and Customers are tables: a person filters them, opens a record, and the
page grows as the list does. An inbox is a list kept beside the thread being
read, so both have to be on screen at once and neither can push the other off.
That is a different layout problem, and solving it with the table pattern would
have produced a page that scrolls the list away from the transcript it belongs
to.

A pager under a list that never fills one page is furniture. It costs a control,
a row of chrome and a reader's attention, and it would never move.

Unread does not sort first because a list that reorders on read moves the row
out from under the person who just clicked it. Sorting by activity means the
order answers "what moved most recently", which is stable under triage.

The preview is derived rather than stored because a stored copy is a second
source of truth for the same sentence, and the two drift the first time a
message is added by a path that forgets to update it. Rule 03 is exactly such
a path.

### Consequence
`.demo-shell:has(.ops-inbox)` is pinned to `100dvh` so the leftover height is
definite. Every other module keeps `min-height` and grows as before; the rule
is scoped to the one module that needs it.

`selectInboxList` does its own filtering rather than using the shared
`queryList` matcher, because search spans message bodies and that matcher tests
fields of one record.

---

## D-078 - A lead brief only where one can honestly be composed

Status: Accepted
Stage: 9C3.3

### Decision
```
Lead conversation                    brief composed from that lead
Customer conversation, converted     brief composed from its source lead,
                                     titled "Lead origin brief"
Customer conversation, established   no brief, and the absence is explained
```

An established customer gets their own context instead: status, segment,
origin, and a line saying that they were not converted from a lead, so there is
no brief to compose.

### Reason
The frozen contract says the Inbox shows the Lead Brief "for lead and customer
conversations". That cannot be true of every customer. The brief is composed by
rule from a lead's stage, priority, vehicle interest, conversation state and
next follow-up, and twenty-six of the thirty-two seeded customers were never
leads. Seven of the nine seeded customer conversations reach no lead at all.

There were three options. Compose a different brief for a customer, which the
contract does not define and which would need a second rule set nobody asked
for. Show a blank panel, which reads as something that failed to load. Or
invent a stage and a vehicle interest for someone who never had either.

The third is fabrication, and it is the specific kind this portfolio refuses:
a synthetic demonstration may use synthetic data, but it must not present a
derived claim it cannot derive. So the panel says nothing, and says why.

### Consequence
The frozen wording is amended rather than quietly reinterpreted.

The brief recomputes from current records on every read, and the conversations
it considers are the lead's own threads plus the thread being read. That second
clause is what `getLeadBrief` cannot express and what a customer conversation
needs: without it, replying in a converted customer's thread would leave the
recommended action unchanged, which the frozen W5 workflow explicitly requires
it not to do.

Two threads can therefore describe the same lead: a converted customer's, and
the lead's own. They read the same lead and differ only in which conversation
each includes, which is correct rather than a collision.

---

## D-079 - Unread is said three ways

Status: Accepted
Stage: 9C3.3

### Decision
An unread conversation row carries heavier subject text, a small indicator dot,
and the word "unread" in its accessible name. Status is a pill carrying its own
label rather than a colour.

### Reason
Unread is the single most consequential piece of state in the list: it is what
decides where someone looks first. A cue only one kind of reader receives is a
cue the others work without.

Weight survives greyscale, a dot survives a colour vision difference, and the
word survives having no visual channel at all. None of the three is decorative
and none is sufficient alone.

### Consequence
The list stays quiet: no accent colour, no badge, no count bubble. The dot is
7px and the weight step is one, which is enough to scan and not enough to shout.

Closed threads are marked the same restrained way and stay in the list. Hiding
them by default would make the status filter's Closed option look broken and
would lose a thread the moment someone finished with it.

---

## D-080 - The composer is a work surface, not a messenger

Status: Accepted
Stage: 9C3.3

### Decision
A labelled textarea and a Send reply button. Enter inserts a newline. There is
no recipient field, no channel address, no attachment, no formatting, no emoji
picker and no send-on-Enter shortcut. The textarea grows to a bounded maximum.

### Reason
Every one of those omissions is the same omission. A reply appends a record to
a local store; nothing leaves the browser, so a recipient field would be asking
for something the product has no use for, and an address field would be a
contact route, which this portfolio does not have anywhere.

Enter sends is a messenger convention that suits a fast back-and-forth. This is
a work surface where an operational reply is composed, read back and then sent,
and a reply dispatched by a stray Return keypress cannot be recalled. The
explicit button is the whole affordance; a documented Ctrl+Enter would be one
more thing to explain for no gain.

The growth cap exists because a long reply on a phone would otherwise push Send
below the fold, leaving the visitor with typing they cannot submit.

### Consequence
The draft is cleared when the selected conversation changes, so words typed for
one thread do not follow the visitor into the next.

The button says "Send reply" and nothing afterwards claims delivery. No sent
receipt, no delivered marker, no provider status: none of them would be true.

---

## D-081 - The transcript is a record, not a feed

Status: Accepted
Stage: 9C3.3

### Decision
The message history is an ordered list, not a live region. A reply is announced
once through the module's single polite status line. Every message names a
person: a Customer message speaks as the conversation's subject, a Staff
message resolves its actor id to that actor's name, and a System message is a
neutral centred note with no author at all. The history is scrolled to the
newest message outright, with no animation.

### Reason
Marking the transcript live would re-read the entire history to a screen reader
every time anything in it changed, which is unusable the moment a thread has
more than a few messages. One short announcement says what happened; the
transcript stays a document the reader can navigate at their own pace.

Displaying a raw `actor_0002` at a person is a storage detail leaking into the
interface. Resolving it costs one lookup the selector already performs.

A System message is not a participant. Rules are how the application works, and
dressing one as a chat partner would misrepresent both the message and the
system that wrote it. It gets a dashed neutral note instead of a bubble.

The scroll is set rather than animated because a scroll that has to be told to
respect reduced motion is a scroll that never needed to move smoothly.

### Consequence
Message bodies render as plain text with line breaks preserved. Nothing is
linkified, no markup is interpreted, and `dangerouslySetInnerHTML` appears
nowhere: what someone typed is displayed as typed, which is both the safe
behaviour and the honest one.

---

## D-082 - The three-panel width, measured

Status: Accepted
Stage: 9C3.3

### Decision
Three panels from 1400px. Between 1180 and 1399, and on a tablet, the layout is
the list and the thread with the context one tap away behind a disclosure.

### Reason
A 1180 viewport does not give a three-panel inbox 1180 pixels. The sidebar
appears at exactly that width and takes 240 of them, the content padding takes
40 more and the scrollbar another 15, so the module is handed 885. Measured, the
transcript came out 221 pixels wide: narrower than a single message in it.

The guidance for this stage named 1180 and said to tune from measured
rendering. This is that tuning. The thread only clears 440 pixels once the
sidebar is paid for, which happens at 1400.

The context becomes a disclosure rather than a fourth overlay because the page
already stacks a notification panel, a mobile navigation drawer, the filter
sheet and the select menus. One more layer is one more stacking order to get
wrong, and a disclosure needs none.

### Consequence
Measured at every viewport from 1920 down to 360, the transcript is the widest
panel wherever it is on screen, and no viewport overflows horizontally.

Below 900px the list gives ground first, dropping to 240-272px, because a
preview line tolerates being short and a message does not.

---

## D-083 - On a phone the Inbox shows one thing at a time

Status: Accepted
Stage: 9C3.3

### Decision
Below 768px the conversation list is the whole screen. Selecting a conversation
replaces it with the thread; there is no empty thread panel underneath the list
and no third column. The selection lives in the URL, so browser Back closes the
thread before it leaves the module.

### Reason
Three columns at 360px would be three unusable columns. A list and a thread
side by side would be two.

Putting the state in the URL rather than in a component means the platform's own
Back gesture does the obvious thing without the module implementing a history
stack, and it is the same contract Leads and Customers already use for their
drawers. The on-screen Back control and the browser's agree because both go
through the same navigation.

### Consequence
The thread carries its own Back control on a phone and none on a desktop, where
the list never went away.

The actions recompose into stacked rows rather than one horizontal strip, and
the assignment menu keeps the approved portal behaviour, so it stays on screen
inside a 360px thread.

---

## D-084 - The CRM modules link to each other

Status: Accepted
Stage: 9C3.3

### Decision
With Leads, Customers and Inbox all built, every relationship the domain holds
is navigable:

```
Inbox thread        Open lead / Open customer      by subject type
Lead brief          Open conversation              when the lead has a thread
Lead overview       Open customer                  when the lead was converted
Customer drawer     Open conversation              one row per thread
Customer drawer     Open lead                      the origin, from 09C3.2
Inbox context       Open lead                      a converted customer's origin
```

Each link is gated on the role being able to open the target module.

### Reason
Three modules that each know about the other two, and no way to walk between
them, is three lists rather than a product. The relationships were already
derived and displayed as counts and names; what was missing was the last step
from naming a record to opening it.

The additions are deliberately small and go where the relationship is already
mentioned. The lead brief already talks about the conversation, so the link to
it belongs there rather than in a new section. The customer drawer already
counts conversations, so each counted thread becomes a row that opens.
Neither approved drawer is redesigned.

`Open customer` in the lead drawer replaces a bare id that carried a comment
saying Customers did not exist yet. It does now, and the comment was the only
thing keeping the id unlinked.

### Consequence
Every link is checked twice: the module must be built, and the role must be
able to view it. A Fleet Coordinator reading a lead sees no way into a
conversation, because they cannot open one.

Links to unbuilt modules still do not exist. Reservations, Contracts, Fleet,
Maintenance, Payments and Reports are named where they are relevant and are not
clickable until their own stages build them.

---

## D-085 - A notification opens its source where the module exists

Status: Accepted
Stage: 9C3.3

### Decision
A notification carrying a `sourceEntityType` of `lead`, `customer` or
`conversation` renders a link to that record, provided the current role can
open the owning module. Every other source type renders as it did: named, not
linked.

### Reason
The notification centre has stored a correct `sourceEntityId` since 09C2 and
has never used it, because the modules those ids pointed at did not exist and a
link to a 404 is worse than no link. Three of them exist now.

The table is keyed by the type the services already store, so a type's absence
from it is not a bug: it means that module is unbuilt, and adding the row is
part of building it.

The role check is made at the link rather than trusted from upstream. A role
that cannot see a category never receives its notifications at all, so the
check is redundant today; it is made anyway, because a link is a way in and a
way in is the thing worth checking twice.

### Consequence
Six seeded CRM notifications point at leads and become navigable. The
Reservation, Finance, Maintenance and Automation notifications stay unlinked,
which is sixteen of the twenty-two, and each becomes navigable as its own stage
lands.

---

## D-086 - A box that clips its overflow is also a containing block

Status: Accepted
Stage: 9C3.3.1

### Decision
Every box in the Inbox that clips its own overflow carries `position: relative`:
the three panels, the conversation list, the transcript, the context column and
the content wrapper. The module's QA measures the rendered document and a
full-page capture, not a CSS string.

### Reason
The first external review of the Inbox rejected it: the application sat at the
top of the page with a very large band of portfolio background beneath it. The
suspected cause was `height: 100dvh` on the demo shell, added so the Inbox could
scroll internally.

Measurement cleared that rule. At an 800px viewport the shell was 800 tall with
a `scrollHeight` of 800, and every box beneath it was correctly contained: demo
surface 765, content 699 clipped, inbox 657. The break was one level higher,
between `.demo-shell` at 800 and `.site-main` at 2751, its only child.

`overflow` clips a descendant only when that descendant's containing block is
inside the clipping box. `.visually-hidden` is `position: absolute`. Nothing
between a conversation row and `.site-main` was positioned, so all twenty-four
of those spans, including the `", unread"` and `", read"` text that gives the
list its non-colour unread cue, resolved their containing block to `.site-main`
and escaped every clip between. They laid out at their static offsets, the last
at y=2750, which gave `body` 2751px of overflow the application never had.

Nothing was visible there. The document did not scroll: `window.scrollTo(0,
5000)` left `scrollY` at zero, and every row was clipped. That is exactly why
nine hundred passing checks missed it. A full-page capture honours that
overflow, so the review's screenshot was 1430x2751 with 1951 rows of flat
`--background-base` under the product.

Proven in the live DOM in both directions: setting `position: relative` on the
scrolling list took `body.scrollHeight` from 2751 to 800, and reverting it put
2751 back.

### Consequence
The fix is `position: relative` on five boxes. It costs no layout and no
repaint; it makes the clip mean what it says.

The Inbox suite now measures `body.scrollHeight` against
`documentElement.clientHeight`, asserts a full-page capture equals the viewport,
samples the bottom of that capture for backdrop pixels, and asserts that no
absolutely positioned descendant of the module resolves its containing block
outside it. That last one states the rule rather than the symptom, so a future
escape fails on the cause.

One regression came with the correction and was caught by the mobile section:
making the transcript a positioned box put it above the context toggle, which
is a static later sibling, and the button stopped taking clicks on a phone.
Positioning the toggle as well restores DOM order as the tiebreak.

The approved modules keep growing down the page. The correction is scoped by
`:has(.ops-inbox)` to the one module that clips, and Overview, Leads and
Customers were measured unchanged.

The wider lesson is worth stating: a visually hidden element is still a laid-out
box. The technique this project uses parks it one pixel wide at an absolute
position, and an absolute position is only harmless while something nearby is
its containing block.

---

## D-087 - A message keeps its own send time, and the specification says so

Status: Accepted
Stage: 9C3.3.2

### Decision
`Message` keeps `sentAt` in its data payload. The frozen specification, which
gave the payload a `createdAt` instead, is corrected to match the domain 09C1
built.

```
DemoRecord.createdAt   when the runtime wrote the record
DemoRecord.updatedAt   when the runtime last rewrote it
Message.sentAt         when the message belongs in the conversation
```

No code changed. No seed changed. No runtime changed. No migration is required
or possible: nothing was ever stored the other way.

### Reason
The drift was found while building the Inbox and reported rather than fixed,
because a stage that discovers a contract conflict should not also decide it.
This is that decision, taken separately.

The code is right and the specification was wrong. The two timestamps answer
different questions, and the Inbox is the surface where the difference shows:

The seeded transcript is written in one pass, so all sixty-four messages share
a `createdAt` within milliseconds of each other, while their `sentAt` values
spread across two weeks. Ordering a thread by `createdAt` would produce
insertion order, which is meaningless to a reader; ordering by `sentAt`
produces the conversation.

A rule that appends messages inside a single commit gives them one `createdAt`
between them, because that is one write. Each still needs its own position in
the timeline.

And a record can be rewritten. Marking a conversation read rewrites it and
moves `updatedAt`; nothing about that should be able to move when a message was
sent.

Every other entity in the contract takes its times from the wrapper alone,
which is why `Message` is the one that has to say otherwise explicitly.

### Consequence
The specification's Message block now lists the full record wrapper alongside
the payload, and states that `sentAt` is domain data rather than a copy of
runtime bookkeeping.

`groupMessages` in `selectors/inbox-list.ts` already sorts by `sentAt` with an
id tie-break, and the Inbox suite already asserts that a thread's times never
go backwards. Both were written against the built model, so both continue to
hold; this decision records why they are correct rather than incidental.

The wider rule this settles for later modules: a domain timestamp that a person
would recognise belongs in the payload, and the wrapper's times stay what they
are, a record of when the store was touched.
