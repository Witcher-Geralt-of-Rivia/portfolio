<!-- PROJECT_STAGE: 6 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Decisions

An ADR-lite log. Each entry records what was decided and, more importantly, the
evidence behind it — so a later session does not "fix" something that was
deliberate.

Status values: `Accepted`, `Superseded`, `Reversed`.

---

## D-001 — Milky Intelligence visual identity

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

## D-002 — Persistent aurora rather than a static background

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

## D-003 — Grain opacity is 0.024, not the lower figure first sketched

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

## D-004 — Three surfaces only: Milk, Frost, Prism

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

## D-005 — Geist Sans + Geist Mono, self-hosted

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

## D-006 — Display measures in calibrated `em`, not `ch`

Status: Accepted
Stage: 02

### Decision
`--measure-display-1: 8.62em` and `--measure-display-2: 10.6em`. Prose measures
stay in `ch`.

### Reason
This is the single most counter-intuitive decision in the project. `ch` resolves
against the *currently rendered* font's "0" advance. Measured: Geist Sans "0" is
0.662em, the next/font metric-adjusted fallback is 0.555em — a 19% gap. So `13ch`
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

## D-007 — `--text-annotation` added; `--text-muted` restricted

Status: Accepted
Stage: 02

### Decision
`--text-annotation: #595e6c` is the accessible small-technical role.
`--text-muted: #7c8190` is decorative only.

### Reason
Measured against the live moving background, muted lands near 3.2:1 — below AA
for any meaningful text. Annotation measures 5.2–6.4:1 everywhere it is used.
The Stage 01 muted token was left unchanged rather than altered, so the original
palette is intact and the accessible role is additive.

### Future modification condition
Never use muted for body copy, captions, control labels or technical labels.

---

## D-008 — Five navigation destinations, nothing else

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
destination is forbidden outright — see `docs/PRIVACY_AND_SECURITY.md`.

---

## D-009 — Compact navigation below 900px

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

## D-010 — Custom SVG system mark, one canonical source

Status: Accepted
Stage: 03

### Decision
`public/marks/system-mark.svg` — 890 bytes, viewBox `0 0 28 28`, four connected
nodes plus a central hub. Referenced through a thin `SystemMarkImage` component
using a plain `<img>`.

### Reason
No logo may be downloaded, and no third-party company mark may appear. Keeping
the SVG in one file rather than duplicating it into JSX avoids two sources of
truth. `next/image` would add a wrapper and a loader path for an 890-byte vector
without shrinking anything, so a plain `<img>` with explicit width and height is
correct here — and it keeps the mark shift-free.

### Future modification condition
If the mark becomes interactive or needs per-instance theming, inlining it may be
reconsidered — but then the public file should be removed, not kept alongside.

---

## D-011 — Intelligence Constellation in CSS and SVG, not WebGL

Status: Accepted
Stage: 04

### Decision
The hero artwork is an SVG connection layer plus HTML chips, animated with CSS.
No Canvas, no WebGL, no Three.js.

### Reason
The composition needs about 38 SVG shapes and eight labels. WebGL would add a
large dependency, a canvas that cannot be styled by the design system, text that
does not inherit the font stack, and no accessibility story — to draw something
CSS renders on the compositor for free.

### Alternatives rejected
Three.js / React Three Fiber, Canvas 2D, an animated raster or video.

### Future modification condition
Only if a future stage genuinely needs real-time 3D, and then only for that
component.

---

## D-012 — Constellation node chips are HTML over SVG, not SVG text

Status: Accepted
Stage: 04

### Decision
The eight capability chips and the orchestrator core are HTML positioned in
percentages over the SVG. Only connections, backplate, grid, relays and signals
are SVG.

### Reason
SVG `<text>` scales with the artboard. At the mobile artboard width (335px) a
13px label would render near 7px — unreadable. As HTML the labels stay at real
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

## D-013 — No `backdrop-filter` on the drifting chips

Status: Accepted
Stage: 04

### Decision
Constellation chips use a translucent fill, border and shadow — the Frost
language minus the blur.

### Reason
Eight chips drift continuously. A live backdrop filter would be re-computed every
frame for each of them. Over the smooth Stage 01 gradient the visual difference
is not perceptible, so the cost buys nothing.

### Future modification condition
Only if the chips stop moving.

---

## D-014 — Cross-link routing bows asymmetrically

Status: Accepted
Stage: 04

### Decision
`crossCurve()` picks whichever side keeps each arc inside the composition while
still clearing the orchestrator by 82 units, with per-link bend values so no two
arcs run parallel. Ring links use flat alternating chords.

### Reason
The first implementation bowed every ring and cross link outward with a uniform
curvature. Visual inspection showed the result read as a wireframe **sphere** —
meridian lines around an orb, which is an explicit design failure condition.
Asymmetric interior routing restores the network reading.

### Alternatives rejected
Uniform outward bows (the orb); straight chords (cut through the core).

### Future modification condition
After any routing change, inspect a zoomed capture of the constellation for the
orb failure mode. Numbers alone will not catch it.

---

## D-015 — Connections terminate at node edges, never centres

Status: Accepted
Stage: 04

### Decision
Every connection endpoint is computed on the chip's edge (plus a small gap) or
the orchestrator's rim.

### Reason
A line drawn to a node centre passes under its label. Terminating at edges means
a line is always either outside a chip or hidden behind it. Verified: maximum
pixel bleed over label text is 1/255 at 390px and 360px — below the grain
dither's own amplitude. Mobile chip fill is 0.82 alpha rather than 0.72
specifically to keep it there.

### Future modification condition
Re-verify with `qa/stage04-occlusion.mjs` after any geometry change.

---

## D-016 — Mobile capability rail drops its vertical dividers

Status: Accepted
Stage: 04

### Decision
Below 700px the hero capability rail becomes a grid (two-up, then one column
below 380px) with no left borders.

### Reason
Once items wrap, a left border lands at the *start* of a row, where it reads as a
stray mark rather than a separator. It also left the first item un-indented while
the rest were indented — visible as a bug in the first 360px capture. Spacing
carries the separation instead.

### Future modification condition
If the rail returns to a single row on small screens, the dividers can return
with it.

---

## D-017 — `.site-main:has(.hero)` zeroes the shell's top padding

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

## D-018 — No scroll cue, and no forced line break in the hero heading

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
Only if a tested width produces genuinely inferior wrapping — and then record the
width here.

---

## D-019 — No navigation item is active while the hero owns the viewport

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

## D-020 — `allowedDevOrigins` must list the VPS IP, localhost and 127.0.0.1

Status: Accepted
Stage: remote preview

### Decision
`next.config.ts` sets
`allowedDevOrigins: ["108.186.112.75", "localhost", "127.0.0.1"]`.

### Reason
Next 16 blocks `/_next/*` dev resources from origins it does not recognise. A
real browser on the public IP got a 403 on a chunk and a dead HMR socket while
`curl` still returned 200 — so a naive smoke test passes while the preview is
broken. `127.0.0.1` is listed explicitly because Next's default allowance covers
the hostname `localhost` but not the literal loopback address, which the QA
harness uses.

### Note
Dev-only. It has no effect on `next build` or `next start`.

---

## D-021 — `scrollbar-gutter: stable` on `html`

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

## D-022 — QA tooling is retained in the repository

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

## D-023 — Typography specimen moved to `/specimen`

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

## D-024 — No paid AI runtime, no backend, no contact information

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

## D-025 — The systems section is one architecture lab, not a feature grid

Status: Accepted
Stage: 05

### Decision
`#systems` is a single interactive System Architecture Lab with four switchable
topologies, plus an execution trace and a four-item principles strip.

### Reason
A capability list or six feature cards proves familiarity with words. A working
topology — input, orchestration, capabilities, validation, human control,
output — shows that the whole system is understood. The brief for this section
was explicitly that a technical client should conclude the developer
understands how complete intelligent systems operate.

### Alternatives rejected
Skill checklist, technology-logo wall, six feature cards, an embedded code
editor.

---

## D-026 — Architecture modes are data, not four JSX trees

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

## D-027 — Connection gradients use userSpaceOnUse

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

## D-028 — Connections are drawn above the spec's opacity range

Status: Accepted
Stage: 05

### Decision
Base connections are `rgba(81,86,102,0.28)` at 1.25px, above the 0.13–0.20
range the Stage 05 brief suggested.

### Reason
Visual inspection. At 0.16 and 1px the routing was effectively invisible, and
the routing is the entire point of the diagram — without it the panel reads as
scattered cards, which is the stated failure condition for this section. The
lines remain far quieter than the node surfaces.

---

## D-029 — The trace drops below the canvas at 1149px, not 999px

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

## D-030 — Production serves alternating release directories, never `.next`

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
anyway — the guarantee had to become structural.

Measured after the change: with production on `.next-release-a`, a plain
`npm run build` ran to completion while the public site was polled continuously.
255 of 255 requests returned 200 across page, CSS chunk and JS chunk. During a
real `deploy:safe` build of the inactive slot, 327 of 327 requests returned 200.

### Alternatives rejected
- Documentation alone — already tried, and it failed.
- A pre-build guard that refuses to build — would break ordinary local builds,
  which developers legitimately need.
- Copying a built app to a separate production directory — more moving parts,
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

## D-031 — PM2 introspection goes through a Node helper

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
the script needs — never an environment value.

---

## D-032 — The deployment strips tooling variables before touching PM2

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

## D-033 — Product surfaces are authored, never screenshotted

Status: Accepted
Stage: 6

### Decision
Every frame in the Product Engineering Studio — the web application window, the
phone, the assist panel — is built from HTML and CSS in this repository. No
screenshot, no device-mockup package, no vendor browser chrome, no notch clone.
The phone carries a neutral sensor capsule and nothing else.

### Reason
The section's claim is that this is our product design. A screenshot of someone
else's interface, or a stock device frame, would demonstrate the opposite. It
also keeps the section at zero external image requests and lets all three
scenarios share one renderer driven by `product-scenarios.ts`.

---

## D-034 — One block renderer per surface, driven by scenario data

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

## D-035 — The product flow is a local interval, torn down on every exit

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
mid-flight. The flow performs no network request of any kind — 0 requests
across 15 runs and 30 scenario changes.

### Consequence
`setStepIndex(0)` happens in the click handler, not the effect body: calling
setState synchronously inside an effect triggers cascading renders and is a
lint error under `react-hooks/set-state-in-effect`.

---

## D-036 — The AI surface is provider-neutral and has no input

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
next action — which is demonstrable deterministically. Naming a provider would
also date the work and imply a dependency that does not exist.

---

## D-037 — Release slots are ignored by ESLint for the same reason `.next` is

Status: Accepted
Stage: 6

### Decision
`eslint.config.mjs` ignores `.next-release-a/**` and `.next-release-b/**`
alongside `.next/**`.

### Reason
The A/B hardening introduced two more directories holding generated build
output, but the ignore list inherited from `eslint-config-next` only covers
`.next`. Linting them reported 174 errors in code we did not write, and
`safe-deploy.ps1` runs ESLint in its validate phase — so this would have
blocked every deployment from Stage 06 onward.
