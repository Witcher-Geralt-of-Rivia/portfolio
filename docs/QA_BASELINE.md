<!-- PROJECT_STAGE: 8 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# QA Baseline

The last known-good technical baseline. Every number below was measured against
a production build. Nothing here is estimated - where a value could not be
measured reliably it says so.

## Stage Status

```
Stage 01   PASS
Stage 02   PASS
Stage 03   PASS
Stage 04   PASS
Stage 05   PASS
Stage 06   PASS
Stage 07   PASS
Stage 08   PASS
Stage 09A  PASS   demo platform foundation
Stage 09    IN PROGRESS   0 of 3 demos built; #work not integrated
```

## Validated Viewports

| Viewport | Stages validated |
|---|---|
| 1920x1080 | 01, 02, 03, 04 |
| 1440x900 | 01, 02, 03, 04 |
| 1366x768 | 01, 02, 03, 04 |
| 1024x768 | 04 |
| 768x1024 | 01, 02, 03, 04 |
| 430x932 | 04 |
| 390x844 | 01, 02, 03, 04 |
| 360x800 | 01, 02, 03, 04 |

1024x768 and 430x932 were added in Stage 04 for hero composition coverage.

## Invariants

These must hold after every future change:

```
CLS                        0 at every tested viewport
Third-party requests       0 (fonts, icons, images, analytics, AI)
Horizontal overflow        0px at every tested viewport
Console errors             0
Failed resource requests   0
Meaningful text contrast   >= 4.5:1   Large text >= 3:1
```

## Stage 01 - Background

- 8 animations running: 6 aurora fields + 2 prism beams
- Field 1 `blur(140px)` opacity 0.55; field 6 opacity 0.38
- Grain opacity 0.024, `mix-blend-mode: multiply`, 256px tile
- Prism beams 58s / 68s, beam B `soft-light`
- Surfaces: milk `rgba(255,255,255,0.68)`, frost `rgba(248,249,253,0.46)`,
  prism `rgba(255,255,255,0.60)`
- Reduced motion: 0 running animations, 0 drift over 4s, composition complete
- Near-white pixels at most 0.46 percent; 10-12 distinct hue families per viewport
- Animation is compositor-only: 0-1 layouts and about 0ms style recalc over 6s

## Stage 02 - Typography

- Font resources, and only these two:
  `/_next/static/media/Geist_Variable-*.woff2` (69,652 bytes)
  `/_next/static/media/GeistMono_Variable-*.woff2` (71,368 bytes)
- Zero requests to Google Fonts, Adobe, or any CDN
- Sans resolves for body/headings/display; Mono for eyebrow/technical/code
- Variable weight axis proven real: 7 distinct rendered widths across weights
  400-700, so no synthetic bolding
- CLS 0.0000 at all six then-tested viewports after the em-measure correction
- Display measures render at exactly 13 and 16 characters per line

Contrast, measured against backdrop-only frames at three aurora positions:

```
text-primary      13.8 - 16.1 : 1     PASS
text-secondary     6.8 -  7.2 : 1     PASS
text-annotation    5.2 -  6.4 : 1     PASS
text-muted              3.15 : 1      below AA - used nowhere
```

## Stage 03 - Navigation

- Desktop bar 1060x64 at top 18px, radius 20px, z-index 100, centred on the
  content frame to within 0.00px
- Side clearance at least 24px at 1920 / 1440 / 1366; no link wrapping
- Compact bar 56px tall inset 12px; panel at (12, 78) with a 12px bottom gap,
  28px radius; items exactly 74px; all five links inside the panel
- Menu trigger 40x40; every focused control shows a 2px or larger ring
- Escape closes; focus returns to the trigger; panel is `inert` when closed
- Tab is confined to trigger plus panel links, wrapping both directions
- Wheel gesture blocked while open; scrolling restored on close; layout width
  unchanged at 768 / 390 / 360
- Active section sequence Systems, Products, AI Learning, Lab, Work - never
  simultaneous, exactly one transition per boundary (no flicker)
- Navigation contrast: wordmark 15.4:1, active link 15.4:1, inactive link 6.6:1,
  panel labels 15.7:1, panel numbers 5.96:1

## Stage 04 - Hero

- CLS 0 at all eight viewports, including 1024x768 and 430x932
- Zero external requests; zero console errors; zero failed resources
- Idle after entrance: script +0.013s, layouts +1, style recalcs +1 over 6s
- Hero DOM 130 elements; constellation 38 SVG shape elements
- Constellation 613px at 1920 and 1440; 372px at 430; 335px at 390; 305px at 360
- Connections crossing a label: none at 1920/1440; max pixel bleed over label
  text 1/255 at 390 and 360
- Chip padding at least 10px each side at every breakpoint
- Motion over 30 seconds: 0 node pairs in lockstep, mean frame delta 1.7-2.3/255
  with no outlier (no loop reset), 1.3-1.6 percent of area changing per 3s sample
  (no strobe)

Hero contrast, worst-case backdrop, at 1440 and 390:

```
eyebrow 5.25   heading 13.87   supporting copy 5.93
primary button 13.39   secondary button 5.51
capability index 5.48   capability label 6.07
constellation labels 15.93 - 16.71   ORCHESTRATOR 5.54   annotations 5.26
```

Payload on `/` (production): JS 131.6 KB, CSS 8.9 KB, fonts 137.7 KB,
HTML 7.5 KB, SVG 1.5 KB. The hero adds no client JavaScript.

### UNVERIFIED

**LCP timing.** The LCP element resolves to the hero heading (`hero__title`) -
text, with no hero image. The timing could not be measured reliably: this
headless environment does not paint until a frame is forced, so two of three
clean runs reported nothing and the third reported 4716ms against a 257ms
DOMContentLoaded. No LCP figure is recorded rather than an invented one.

## Known QA Environment Artefacts

Headless Chromium does not produce frames while idle. Anything driven by the
frame lifecycle is deferred and reads stale:

- `requestAnimationFrame` callbacks do not fire
- IntersectionObserver callbacks are not delivered
- CSS transitions do not advance (an element mid-transition reports its start
  geometry - a panel measured 0.985x scaled)
- `getComputedStyle` returns pre-recalc values after `addStyleTag`
- a compositing layer of its own (anything with `backdrop-filter`) can still
  hold pre-override pixels after `addStyleTag`, long after the rest repaints

**Mitigation:** force a frame with a throwaway
`page.screenshot({ type: "jpeg", quality: 20 })` before measuring, and launch
with `--disable-backgrounding-occluded-windows`,
`--disable-renderer-backgrounding`, `--disable-background-timer-throttling`.
Several apparent bugs during Stages 03 and 04 were this artefact, not the app.

Stage 06 added four more, all harness faults rather than application faults:

- **Screenshots are slow enough to swallow what they measure.** A full-page or
  large-element capture costs over a second. A 2.2s flow measured with frame
  forcing between the click and the read appeared to complete instantly. Assert
  DOM state directly during interaction and take no screenshots mid-run; React
  updates the DOM whether or not the page paints.
- **`waitForFunction` polls on rAF by default.** A page that is not painting
  starves rAF, which both delays detection and lets throttled `setInterval`
  callbacks fire in a burst afterwards, collapsing a timed sequence. Pass
  `{ polling: 120 }` for anything timing-sensitive.
- **Fixed and injected overlays land in full-page captures.** The site
  navigation is `position: fixed`, so scrolling a section into view parks its
  dark text over that section in a full-page screenshot — sampled as if it were
  the section's background, which read 1.00:1. `<nextjs-portal>`, the dev-tools
  indicator, does the same and exists only under `next dev`. Remove both for
  capture with `display: none` — `visibility: hidden` is not enough, because
  nav children re-assert `visibility: visible`.
- **Page-wide assertions rot as the page grows.** `stage05-a11y.mjs` counted
  every `[role="tab"]` in the document and asserted exactly one was tabbable.
  That was right while Stage 05 owned the only tablist and wrong from Stage 06
  onward: roving tabindex is a property of each tablist, so three tablists
  correctly yield three tabbable tabs. It reported 2/7 on the Stage 06 build
  and 3/10 on Stage 07 - a false failure both times, and one that went unseen
  in Stage 06 because only the tail of that harness's output was read. The
  assertion is now one tabbable tab per tablist. When a harness starts failing
  as a new section lands, check whether it was scoped to the page or to the
  component before touching the application.
- **`document.getAnimations()` counts transitions.** A snapshot taken just
  after an interaction is full of 180-260ms colour transitions at
  `currentTime: 0`. To ask "does this section animate at rest", filter to
  `animationName` set, `iterations === Infinity`, and target within the
  section.
- **`elementHandle.screenshot()` waits for the element to be stable.** On a
  section that animates it can time out outright, and it can never capture a
  transient state: the wait guarantees the state is gone. Use
  `page.screenshot({ clip })` with the clip resolved from
  `getBoundingClientRect()` plus scroll offsets.
- **Overlay scrollbars defeat the usual scrollbar correction.** Headless
  Chromium reports `documentElement.clientWidth === window.innerWidth` while
  `scrollbar-gutter: stable` still reserves 15px, so anything centred on the
  content frame measures 7.5px off against either width. Measure against the
  content frame itself. This produced a false `centred=FAIL` in
  `stage03-desktop.mjs` for a bar that is centred to 0.00px, exactly as this
  document already recorded.

**No mid-flow screenshot exists for Stage 06, deliberately.** A clip large
enough to show the event rail composites slowly enough that the 2.2s flow
settles during the capture, yielding a frame with a lit stage beside a
"Run again" button - a state the application never renders. Publishing that
would misrepresent the product. The running state is verified by assertion in
`stage06-interaction.mjs` instead: label `Running...`, button disabled, exactly
one rail node lit, on 15 of 15 runs.

## Stage 05 - Intelligent Systems

Measured against a production build.

```
mode content       agent 10 nodes / 11 links   automation 10 / 12
                   crm 9 / 10                  saas 10 / 12    (8 trace rows each)
panel height       621px, spread 0px across all four modes
20 mode switches   no node residue, no stale trace, exactly one tab selected,
                   CLS 0, zero console warnings
idle 6s in view    script +0.010s, layouts +2, style recalcs +2, no continuous JS
section DOM        222 elements
external requests  0
```

Responsive, all PASS - no overflow, no clipped labels, CLS 0 at every size:

```
1920x1080  topology       panel 1200x621
1440x900   topology       panel 1200x621
1366x768   topology       panel 1200x621
1024x768   topology       trace below, canvas 864px
768x1024   topology       trace below, canvas 642px
430x932    vertical flow  panel 372x1170
390x844    vertical flow  panel 335x1170
360x800    vertical flow  panel 305x1196
```

Node overlap checked across all four modes at 1920, 1440, 1366, 1200, 1100,
1024 and 768: none.

Accessibility:

```
tablist        ArrowLeft/Right wrap, Home, End, roving tabindex 1 of 4
node focus     <button>, aria-describedby the detail strip, 2px focus ring
tab order      Request -> Intent Router -> Planner -> Context -> Retrieval
diagram        one visually hidden aria-live summary per mode
reduced motion 0 running animations, packets parked at 50%, everything visible,
               mode switching still works
```

Contrast, all 18 roles PASS over live surfaces at 1440x900:

```
eyebrow 6.06   heading 16.06   supporting copy 6.84   capability line 6.06
lab title 16.37   lab subtitle 6.97   mode active 14.05   mode inactive 7.07
node label 17.03   node technical 6.42   trace title 6.20   trace badge 5.34
trace time 6.20   trace row 6.95   detail strip 6.32
principle index 6.06   principle title 16.06   micro label 5.60
```

Scripts: `qa/stage05-shots.mjs`, `stage05-interaction.mjs`, `stage05-a11y.mjs`,
`stage05-responsive.mjs`, `stage05-contrast.mjs`, `stage05-public.mjs`.
Screenshots in `qa/shots/stage05/`.

## Stage 06 - Product Engineering

Measured against a production build. 1440x900 unless stated. Harness:
`qa/stage06-*.mjs`.

| Check | Result |
|---|---|
| Contrast, 50 text roles, 3 scenarios, flow complete | all PASS, worst 5.01:1 |
| CLS at load | 0.00000 |
| CLS after 3 scenario changes + 3 flows | 0.00000 |
| Scenario changes | 30/30 clean |
| Flow runs | 15/15 clean |
| Network requests during those 45 interactions | 0 |
| Console errors and warnings | 0 |
| Viewports without overflow or surface collision | 8/8 |
| Flow duration, 7 steps, measured in-page | 2183-2210ms |
| Infinite animations at rest, scoped to `#products` | 0 |
| Reduced motion: keyframe animations during a flow | 0 |
| Reduced motion: content still changes | PASS |
| DOM nodes in `#products` | 205 |

Worst contrast is the `LOCAL / DETERMINISTIC` micro label at 5.01:1 against the
capability rail; every other role clears 5.3:1. No role uses `--text-muted`.

Semantic list marker inset, measured by `qa/stage06-listreset.mjs` with the
component-local reset neutralised and then in force:

| List | Element | Marker inset without the reset | With the reset |
|---|---|---|---|
| capability rail | `ul` | 40px | 0px |
| web rows | `ul` | 40px | 0px |
| event rail | `ol` | 40px | 0px |
| web timeline | `ol` | 40px | 14px, its own panel inset |
| phone step list | `ol` | 40px | 0px |
| phone checklist | `ul` | 40px | 0px |

All six stay real `<ul>`/`<ol>` elements. The timeline's 14px is a deliberate
panel padding re-declared later in `products.css`, not leftover marker
indentation - it wins over the reset on source order at equal specificity, so
the reset block must not be moved or given higher specificity.

Keyboard: ArrowRight/ArrowLeft/Home/End all move selection and focus together
across the scenario tablist. Abandoning a run mid-flight by switching scenario
leaves no active stage, no passed stages, an empty live region and the button
back to `Run product flow`.

Surface stability across scenarios: the phone holds 367px at every viewport and
every frame keeps its position; only the web frame's height follows its content
(566-682px at desktop).

## Stage 07 - AI Learning Systems

Harness: `qa/stage07-*.mjs`. 1440x900 unless stated.

| Check | Result |
|---|---|
| Contrast, 40 text roles, 3 scenarios, after adaptation | all PASS, worst 4.85:1 |
| CLS at load | 0.00000 |
| CLS after 3 scenario changes + 3 adaptations | 0.00027 |
| Scenario changes | 30/30 clean |
| Adapt runs | 20/20 clean |
| Network requests during those 50 interactions | 0 |
| Console errors and warnings | 0 |
| Viewports without overflow, overlap or escape | 8/8 |
| Adapt sequence, 5 stages | 340ms per stage, 1.70s |
| Idle long-task time over 6s with the section on screen | 0-77ms |
| Standing animations owned by Stage 07 | 2 route signals, capped |
| Reduced motion: keyframe animations during a run | 0 |
| DOM nodes in `#ai-learning` | 210 |

Worst contrast is a map node label at 4.85:1 against the map's own panel;
every other role clears 5.9:1. No role uses `--text-muted`.

Map type, measured by `qa/stage07-maptype.mjs` as rendered CSS pixels rather
than viewBox units:

| Viewport | Map box | Scale | Smallest label | Collisions |
|---|---|---|---|---|
| 1440x900 | 560x367 | 1.077 | 9.69px | 0 |
| 1024x768 | 640x419 | 1.231 | 11.08px | 0 |
| 768x1024 | 642x421 | 1.235 | 11.12px | 0 |
| 390x844 | 301x336 | 0.579 | 10.42px | 0 |
| 360x800 | 271x336 | 0.521 | 9.38px | 0 |

Cancellation: switching scenario mid-sequence leaves the control at its idle
label, an empty live region and the new scenario's own journey step. Removing
the section from the document mid-sequence raises no error. The button is
disabled while running, so a second sequence cannot start.

**No mid-sequence screenshot exists, deliberately.** Even a small clip of the
journey and footer takes longer to composite than the 1.7s sequence lasts: the
DOM already reads "Adapt again" by the time the shutter fires, measured on
three consecutive attempts. `learning-adapt-active-1440x900.png` therefore
shows the state the adapt action produces. The running state is verified by
assertion instead - label "Adapting...", button disabled, journey tagged
STATE / ADAPTING, on 20 of 20 runs.

## Stage 08 - Engineering Lab

Harness: `qa/stage08-*.mjs`. 1440x900 unless stated.

| Check | Result |
|---|---|
| Contrast, 67 text roles, 5 experiments, after a run | all PASS, worst 6.13:1 |
| CLS at load | 0.00000 |
| CLS after 5 experiments + 5 runs | 0.00053 |
| Experiment switches, 17 of them mid-execution | 50/50 clean |
| Executions (20 per experiment) | 100/100 clean |
| Run/reset cycles (20 per experiment) | 100/100 restored exactly |
| Network requests during 100 runs + 50 switches | 0 |
| Console errors, warnings, failed resources | 0 |
| Viewports x experiments without overflow or overlap | 8 x 5 |
| Idle long-task time over 6s | 0ms |
| Execution long-task time across 5 runs | 759ms |
| Standing animations owned by Stage 08 | 0 |
| Reduced motion: keyframe animations during a run | 0 |
| DOM nodes in `#lab` | 160 |

Determinism is asserted, not assumed: twenty runs of each experiment must end
in exactly one state, and the harness fails if an experiment produces two.
The five end states are 200 OK; five admitted and two refused with a 429;
delivery acknowledged; JOB-108 in the dead-letter queue; and two requests
producing one action.

Reset is checked against the recorded initial state rather than against
"looks idle": label, observation state, observation event, live region, lit
stages and the disabled state of Reset itself must all match what the
experiment showed before its first run.

**Measure the measurement.** The first execution-cost run reported 16.4s of
long tasks. The cost was the instrument: an in-page sampler polling
`document.getAnimations()` every 30ms to record which animations ran. Cost and
animation sampling are now separate passes, and the figure fell to 759ms. If a
performance number moves by an order of magnitude after adding a probe, suspect
the probe.

## Deployment Safety (A/B release slots)

Production serves `.next-release-a` or `.next-release-b`, never `.next`. These
are the measurements that prove a build can no longer disturb the live site.

**Accidental plain build** — production on `.next-release-a`, ran
`npm run build` (writes `.next`) while polling the public site:

```
page       85 requests   85x 200   0 non-200   0 connection failures
CSS chunk  85 requests   85x 200   0 non-200   0 connection failures
JS chunk   85 requests   85x 200   0 non-200   0 connection failures
.next BUILD_ID rewritten; .next-release-a BUILD_ID untouched
```

**Safe deployment, inactive-slot build window** — `deploy:safe` building
`.next-release-b` while production served `.next-release-a`:

```
327 requests during the build window, 327x 200, 0 failures
```

**Switch window** is the only interruption: PM2 stops the old process and the
new one boots. Measured 12.6s, 13.8s and 58.8s across three switches; the 58.8s
run had the development server competing for RAM. The public monitor recorded
502s for ~46s during that worst case. This is a real availability gap, not zero
downtime, and it is the PM2 restart — not the build.

**Rollback drill** — `deploy:safe -FailAfterSwitchForTest`, health check forced
to fail after switching:

```
switched to .next-release-a, forced failure, rolled back to .next-release-b
public site healthy after rollback (page + CSS + JS all 200)
pm2 save persisted the RESTORED slot
exit code 1 (a successful rollback is still a failed deployment)
1083 requests during the drill's build and smoke phases: 1083x 200
```

**Production process environment** after migration: 2 variables
(`NODE_ENV`, `PORTFOLIO_DIST_DIR`), down from 69. No tooling or credential
variable names present.

**Smoke gate coverage.** Before the switch, the loopback smoke server must
serve the page, the CSS and JS chunks, both WOFF2 fonts and both SVG assets,
and its HTML must contain the id of every built section - `id="systems"`,
`id="products"`, `id="ai-learning"`, `id="lab"` - plus the Stage 06, 07 and 08
headings. A release that compiles but renders a section-less page cannot reach
production.

The heading assertion is the load-bearing one and must not be dropped as
redundant: before Stage 06 the navigation placeholder emitted `id="products"`
too, so the id alone does not distinguish a built section from a placeholder.
Measured against real build output - `.next-release-a` (Stage 06) passes all
three; `.next-release-b` (pre-Stage-06) is rejected with "Stage 06 heading
missing from HTML".

Consequence: changing the `#products` heading copy will abort a deployment at
phase 7 until `deploy/safe-deploy.ps1` is updated to match. That is the gate
working, not a script bug.

**Public origin check.** `qa/public-browser-check.mjs` drives Chromium against
`https://intelligent-systems-lab.duckdns.org` at 1440x900 and 390x844,
exercising all three scenarios and a full flow. Console, failed requests and
mixed content are origin-sensitive, so they are only meaningful measured over
real HTTPS rather than a loopback dev server. Measured: 0 console errors, 0
console warnings, 0 failed requests, 0 plaintext subresources, 13 requests per
page load, no horizontal overflow.

Scripts: `qa/deploy-continuity.mjs` (run with `MSYS_NO_PATHCONV=1` under Git
Bash, or a leading-slash asset path is rewritten to a Windows path before Node
sees it), `qa/deploy-continuity-report.mjs`.

## Production HTTPS Verification

Verified against the live public URL `https://intelligent-systems-lab.duckdns.org`
with a real Chromium browser and strict TLS.

```
HTTP status               200
protocol / host           https: intelligent-systems-lab.duckdns.org
HTTP -> HTTPS             308 Permanent Redirect
TLS verify result         0 (trusted)
certificate               CN=intelligent-systems-lab.duckdns.org
issuer                    Let's Encrypt YE1
chain                     ISRG Root X2 -> Root YE -> YE1 -> leaf, Verification OK
console errors            0
failed requests           0
mixed content             0 (no http:// subresources)
third-party requests      0
horizontal overflow       none
```

Stage integrity confirmed through the public URL:

```
Stage 01   6 aurora fields, 2 prism beams, grain present, 25 animations running
Stage 02   GeistSans + GeistMono loaded, body font resolves to GeistSans
Stage 03   5 navigation links
Stage 04   hero title correct, 8 constellation nodes, 21 links, 5 signals
```

Static resources over public HTTPS, all 200: `/marks/system-mark.svg`,
`/textures/micro-grain.svg`, `/specimen`, the CSS chunk, the JS chunk and both
WOFF2 fonts.

Security, all returning 404 over the public URL: `/.env`, `/.env.local`,
`/.git/config`, `/package.json`, `/next.config.ts`, `/src/app/page.tsx`,
`/docs/CLAUDE_HANDOFF.md`, `/docs/project-state.json`,
`/deploy/pm2.portfolio.config.js`, `/qa/report.json`. Directory paths
(`/docs/`, `/src/`, `/qa/`, `/public/`, `/deploy/`) all resolve to 404 - Caddy is
a reverse proxy only and no `file_server` is configured.

Contact-information and AI-credential scans of the live markup: clean.

Screenshot: `qa/shots/production-https-1440x900.png`.
Script: `qa/production-check.mjs`.

### Existing-domain regression (mandatory)

The other production domain on this host was captured before the Caddy change
and re-verified after. Identical in every respect:

```
                     pre-change          post-change
HTTP                 308 -> HTTPS        308 -> HTTPS
HTTPS status/size    200 / 8382 bytes    200 / 8382 bytes
title                Clube da Economia   Clube da Economia
certificate          LE YE2, Aug 26 -> Nov 24 2026   unchanged
strict TLS           verify 0            verify 0
backend 127.0.0.1:3200   200             200
```

Caddy PID was unchanged across the reload (graceful, no process interruption),
and PM2 restart counters for all three processes remained 0.

## Reading Two QA Outputs Correctly

Two results look like failures and are not. Both were re-verified after the
documentation work.

**`stage04-geometry.mjs` reports geometric overlap below 700px.** At mobile
widths the chips grow relative to the artboard, so a spoke computed against
desktop chip sizes legitimately ends *behind* a chip. Chips paint above the SVG,
so nothing is visible. The authoritative check is `stage04-occlusion.mjs`, which
measures actual visible bleed over label text: **1/255** at both 390 and 360,
below the grain dither's own amplitude. The geometry script now labels this
explicitly. Do not change constellation geometry on the strength of that line.

**CLS at 390x844 can read a small non-zero when the full suite runs.** One
observation of 0.0057 was recorded while eight viewports plus a 30-second motion
sampler ran back to back. Three isolated re-runs at that viewport all read
**0**. Product code was byte-identical to the tagged Stage 04 checkpoint at the
time, so this is measurement contention in the headless environment rather than
a layout shift. Re-measure in isolation before treating a small mobile CLS
reading as real.

## Artefact Locations

```
qa/shots/               Stage 01 baselines (10 PNG)
qa/shots/stage02/       Stage 02 baselines (12 PNG)
qa/shots/stage03/       Stage 03 baselines (15 PNG)
qa/shots/stage04/       Stage 04 baselines (14 PNG)
qa/shots/stage06/       Stage 06 baselines (6 PNG, captured from production)
qa/shots/stage07/       Stage 07 baselines (5 PNG, captured from production)
qa/shots/stage08/       Stage 08 baselines (5 PNG, captured from production)
qa/report.json          Stage 01 machine-readable results
qa/stage02-report.json  Stage 02 machine-readable results
qa/stage02-measurements.txt
```

## Principal QA Scripts

```
qa/visual-qa.mjs            Stage 01 atmosphere, surfaces, reduced motion
qa/chroma.mjs               colour/chroma distribution of a capture
qa/texture.mjs              grain dither and gradient banding
qa/font-qa.mjs              font origins, resolution, third-party check
qa/stage02-type.mjs         type-role contrast over the live backdrop
qa/stage02-shots.mjs        Stage 02 screenshots + computed type metrics
qa/stage03-desktop.mjs      desktop nav geometry, keyboard order, ARIA
qa/stage03-mobile.mjs       compact bar and panel geometry
qa/stage03-interaction.mjs  Escape, focus trap, scroll lock, close paths
qa/nav-active.mjs           active-section sequence and boundary stability
qa/stage03-perf-motion.mjs  reduced motion, CLS, network, idle cost
qa/stage04-geometry.mjs     line/label collisions, chip padding, artboard bounds
qa/stage04-occlusion.mjs    measured line bleed over label text
qa/stage04-contrast.mjs     hero contrast over worst-case backdrop
qa/stage04-perf.mjs         CLS, network, console, idle, 30s motion stability
qa/stage04-shots.mjs        Stage 04 screenshot set
qa/stage06-responsive.mjs   8 viewports: surfaces present, overflow, collision
qa/stage06-interaction.mjs  30 scenario changes, 15 flow runs, keyboard, network
qa/stage06-contrast.mjs     50 text roles across all three scenarios
qa/stage06-perf.mjs         CLS, animation cost at rest, reduced-motion contract
qa/stage06-timing.mjs       in-page flow timing (no screenshots during the run)
qa/stage06-listreset.mjs    semantic list marker inset, reset on vs neutralised
qa/public-browser-check.mjs console, failed requests and mixed content over
                            real HTTPS against the public origin
qa/stage07-responsive.mjs   8 viewports: surfaces, overflow, overlap, order
qa/stage07-interaction.mjs  30 scenario changes, 20 adapt runs, cleanup, keys
qa/stage07-contrast.mjs     40 text roles across all three scenarios
qa/stage07-perf.mjs         CLS, idle cost, animation cost, reduced motion
qa/stage07-maptype.mjs      rendered map type size and label collisions
qa/stage07-shots.mjs        Stage 07 screenshot set
qa/stage08-responsive.mjs   8 viewports x 5 experiments: overflow, overlap,
                            tiny text, touch targets, phone order
qa/stage08-interaction.mjs  50 switches, 100 runs, 100 run/reset cycles
qa/stage08-contrast.mjs     67 text roles across all five experiments
qa/stage08-perf.mjs         CLS, idle and execution cost, reduced motion
qa/stage08-shots.mjs        Stage 08 screenshot set
qa/stage06-shots.mjs        Stage 06 screenshot set
qa/project-memory-check.mjs canonical documentation consistency
```

Every script now honours `QA_BASE`, defaulting to `http://127.0.0.1:3000`. Set
`QA_BASE=http://127.0.0.1:3100` to run the same checks against the running
production build - which is how the Stage 06 results above and the Stage 01-05
regression were measured. Stage 01 and Stage 02 scripts target `/specimen`,
where the surfaces and type roles live.

## Regression Rule

Every future stage must verify that previously frozen stages have not materially
regressed. At minimum re-check:

```
visual atmosphere      fonts        navigation      hero
responsive overflow    console      network         accessibility contrast
CLS
```

Because the atmosphere animates continuously, screenshots will not be
pixel-identical between runs. Compare structural geometry and QA metrics instead.
Never "fix" the animation to make screenshots match.

---

## Stage 09A - Demo Platform Foundation

PASS. Harnesses: `qa/stage09a-runtime.mjs` (76 checks) and
`qa/stage09a-shell.mjs` (85 checks). Both honour `QA_BASE`.

### How the browser integration was performed

The demo runtime is browser code — IndexedDB, a memory fallback, cross-tab
invalidation — and cannot be exercised in Node. Two temporary routes were
created for the run and **deleted before commit**:

```
qa/fixtures/demos-qa-probe.page.tsx -> src/app/demos/qa-probe/page.tsx
qa/fixtures/demos-qa-shell.page.tsx -> src/app/demos/qa-shell/page.tsx
```

The fixture sources are kept under `qa/fixtures/`, where they create no route.
Each was copied into the route tree for the run and removed afterwards.

Playwright loaded them and ran every assertion inside `page.evaluate`, so each
test executed the same compiled modules a demo would. No QA route exists in the
committed tree or in production. Each harness header carries the procedure for
recreating its fixture; note that a folder beginning with `_` is a Next.js
private folder and produces no route.

### Runtime — 76 checks

```
persistence mode     IndexedDB selected in a normal browser
seed / CRUD          canonical dataset loads; create, update (version 1 -> 2)
                     and delete all persist; revision 0 when freshly seeded
atomicity            a builder that throws writes nothing and burns no id -
                     the next create still takes alpha_0005
typed failures       NOT_FOUND for a missing record and a missing job,
                     VALIDATION for an unknown role, FORBIDDEN for a
                     cross-demo write; an unknown collection reads as empty;
                     a duplicate id overwrites rather than duplicating
isolation            three demos seeded and mutated; resetting Operations
                     left Field and Learning records, audit and revisions
                     untouched
determinism          two churn-and-reset cycles produced identical ids,
                     timestamps, clock, counters, revision 0, empty audit and
                     empty job queue
query                filter, case-insensitive search, ascending and descending
                     sort, pagination totals and page counts, out-of-range
                     page clamped to the last
seed version         a compatible version preserved demo state; an
                     incompatible one reset that demo to canonical data
reload               a record, audit entry and revision written before reload
                     were all present after it, still on IndexedDB
fallback             with indexedDB.open forced to fail, the runtime fell back
                     to memory, reached ready, and seeded, mutated, audited
                     and reset correctly
cross-tab            a mutation in one tab notified the other, which picked up
                     the new revision and re-read the record. The message
                     carried exactly demoId, revision and reason - no record
                     data crossed the channel
network              0 external requests, 0 /api/ calls, 0 console errors
```

### Scale — 500 generic records

A sanity check on this runtime in this browser, not a benchmark, and not a
statement about production capacity. Three runs:

```
seed 500 records          223 / 227 / 296 ms
list 500 records           39 /  32 /  58 ms
filter+search+sort+page    29 /  71 ms (two runs recorded)
insert one                  3 /  25 /   4 ms
reset                     598 / 425 / 345 ms
```

Reset was 1444ms before the cursor-purge bug was fixed; the keyed range delete
that replaced it is also what made it correct.

### Shell — 85 checks

```
geometry     1920/1440/1366  36px    1024  37px    768  37px
             430/390/360     87px (two rows)
             zero horizontal overflow and nothing clipped at all eight
             viewports; the disclosure keeps both halves everywhere; Back and
             Reset render at every width; the site navigation is removed
contrast     six text roles, worst 6.06:1 against the live aurora
dialog       opens modal, labelled by its title, focus moves inside and stays
             inside across six Tab presses, Escape closes it, confirming
             closes it, no console errors
idle         0 intervals, 0 requestAnimationFrame, 0 timer churn over three
             seconds; CLS 0.00025
```

### Not covered

No demo exists, so nothing was measured about product behaviour, derived
dashboard values, or the offline queue. Those become QA contracts for 09B
onward and are listed in `docs/DEMO_PLATFORM.md`.

---

## Stage 09C1 - Operations Domain

PASS. Harness: `qa/stage09c1-operations.mjs` (211 checks). Honours `QA_BASE`.

Browser integration uses `qa/fixtures/demos-operations-probe.page.tsx`, copied
to `src/app/demos/qa-operations/page.tsx` for the run and removed afterwards.
No QA route exists in the committed tree or in production.

### Coverage

```
dependency boundary  the runtime imports nothing from src/demos; no Operations
                     entity name appears in runtime code once comments are
                     stripped; no any, ts-ignore, Math.random, randomUUID or
                     Date.now anywhere in the domain's 21 modules
seed integrity       every count and distribution; the four relationship
                     identities; referential integrity across nine collections;
                     message ordering within each thread; audit entities and
                     actors resolve and no audit entry is in the future
business suite       run twice, once per adapter, results identical
demo isolation       Field and Learning records, audit and revisions untouched
                     by an Operations mutation and reset; a seed carrying no
                     audit still resets to zero audit
content safety       2184 seeded strings, 363 of them timestamps, scanned for
                     emails, telephones, URLs, mailto/tel, messaging links,
                     social handles and real manufacturer names - all zero
refresh persistence  a lead, a payment and a read notification survive reload
memory fallback      forced IndexedDB failure seeds 48 leads and 63 audit
                     entries, completes a conversion, serves the Overview
                     selector and resets
network              0 external requests, 0 /api/ calls, 0 console errors
```

### Measured values

```
counts        actors 4, leads 48, customers 32, vehicles 24, reservations 18,
              contracts 14, payments 26, maintenance 10, conversations 20,
              messages 64, rules 5, runs 18, notifications 22, audit 63
lead stage    New 12  Contacted 10  Qualified 9  Proposal 7  Won 6  Lost 4
vehicle       Available 10  Reserved 4  Rented 7  Maintenance 3
reservation   Draft 4  Confirmed 4  Converted 7  Cancelled 3
contract      Pending 3  Active 7  Completed 3  Cancelled 1
payment       Paid 18  Pending 5  Overdue 3     (effective, from the clock)
maintenance   Open 2  In Progress 1  Completed 6  Cancelled 1
Overview      open leads 38, confirmed reservations 4, vehicles available 10,
              payments requiring attention 8, unread notifications 8
clock         2026-09-01T09:00:00.000Z, revision 0 when freshly seeded
```

### Workflow results

```
W1  lead to customer     website lead assigned to actor_0002, follow-up set
                         two days out, converted with both pointers set, and a
                         second conversion refused as CONFLICT
W2  reservation to rental  eligible vehicles offered, confirming a free vehicle
                         reserves it, activating rents it, total equals rate x
                         billable days. A currently-rented vehicle is still
                         bookable for a later window and still reads Rented
W3  payment              paidAmount rises, balance falls, overpayment CONFLICT,
                         zero amount VALIDATION
W4  maintenance          starting takes the vehicle off the fleet, completing
                         returns it, notification raised, and starting work on
                         a rented vehicle is a CONFLICT
W5  inbox and assist     brief composed deterministically, staff reply marks
                         the thread read, recommended action from the fixed set
W6  automation control   disabled rule records Skipped, re-enabled rule runs
                         Success and the run is persisted
```

### Performance sanity

Not a benchmark, and never published as one. Two runs:

```
seed initialization    210 / 185 ms
Overview selector       31 /  26 ms
lead list query          6 /   7 ms
reset                  207 / 203 ms
```

### Stage 09A regression

`qa/stage09a-runtime.mjs` 76/76 and `qa/stage09a-shell.mjs` 85/85 after the
audit extension. The optional field changed nothing for the demos that do not
use it.
