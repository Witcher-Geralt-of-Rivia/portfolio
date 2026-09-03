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
  dark text over that section in a full-page screenshot, sampled as if it were
  the section's background, which read 1.00:1. `<nextjs-portal>`, the dev-tools
  indicator, does the same and exists only under `next dev`. Remove both for
  capture with `display: none`. `visibility: hidden` is not enough, because
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

**Accidental plain build.** Production on `.next-release-a`, ran
`npm run build` (writes `.next`) while polling the public site:

```
page       85 requests   85x 200   0 non-200   0 connection failures
CSS chunk  85 requests   85x 200   0 non-200   0 connection failures
JS chunk   85 requests   85x 200   0 non-200   0 connection failures
.next BUILD_ID rewritten; .next-release-a BUILD_ID untouched
```

**Safe deployment, inactive-slot build window.** `deploy:safe` building
`.next-release-b` while production served `.next-release-a`:

```
327 requests during the build window, 327x 200, 0 failures
```

**Switch window** is the only interruption: PM2 stops the old process and the
new one boots. Measured 12.6s, 13.8s and 58.8s across three switches; the 58.8s
run had the development server competing for RAM. The public monitor recorded
502s for ~46s during that worst case. This is a real availability gap, not zero
downtime, and it is the PM2 restart, not the build.

**Rollback drill.** `deploy:safe -FailAfterSwitchForTest`, health check forced
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

Static resources over public HTTPS, all 200: the portfolio mark,
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

The demo runtime is browser code (IndexedDB, a memory fallback, cross-tab
invalidation) and cannot be exercised in Node. Two temporary routes were
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

### Runtime - 76 checks

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

### Scale - 500 generic records

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

### Shell - 85 checks

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

---

## Stage 09C2 - Operations Shell, Overview and Branding

PASS. Harness: `qa/stage09c2-operations-ui.mjs` (140 checks).

Run against a **local production build**, not the dev server:

```
npm run build
npx next start --hostname 127.0.0.1 --port 3001
node qa/stage09c2-operations-ui.mjs
```

Port 3001, not 3200: 3200 belongs to the other application on this host, and
3100 is this portfolio's live production.

### Branding

```
master            logo.png, 1254x1254, 844406 bytes, unmodified
transparency      64.0% fully transparent, 35.7% partial, 0.3% opaque
                  corners rgba(0,0,0,0) - measured, not inferred
derived           src/app/icon.png 256px 54.7 KB
                  src/app/apple-icon.png 180px 31.8 KB
                  public/brand/logo-192.png 35.0 KB, logo-96.png 11.9 KB
favicon           <link rel="icon"> resolves to /icon.png, served 256x256
                  image/png, byte-identical to src/app/icon.png (0 diff)
old favicon.ico   none exists, so nothing shadows the new icon
old system mark   deleted; 404 from the local build; 0 active references
retired name      0 occurrences in the working tree
navigation mark   28px from a 96px source
demo bar mark     20px, square, undistorted
small sizes       32px clearly the mark; 16px keeps silhouette and colour,
                  loses node dots and cube facets
```

### Overview, as rendered

```
open leads                    38
confirmed reservations         4
vehicles available            10
payments requiring attention   8
unread notifications           8
lead funnel                   New 12  Contacted 10  Qualified 9
                              Proposal 7  Won 6   (4 lost, shown separately)
fleet                         Available 10  Reserved 4  Rented 7  Maintenance 3
upcoming reservations         4 rows
action queue                  6 of 11, led by the three overdue payments
```

### Role matrix, as rendered

```
Admin              Morgan Reed    11 modules   4 KPIs
Sales Agent        Avery Chen      6 modules   2 KPIs  (leads, reservations)
Fleet Coordinator  Jordan Blake    5 modules   2 KPIs  (reservations, fleet)
Finance Analyst    Taylor Quinn    5 modules   1 KPI   (payments)
```

Only Overview is interactive in this build; the other ten render as
non-interactive labels rather than links to a 404.

### Interaction

```
role switch, all four            PASS, persists across reload
notification open / read / all   PASS, badge 8 -> 7 -> none
Escape closes, focus returns     PASS
action queue drops read items    PASS
read state survives reload       PASS
reset                            PASS, restores 38/4/10/8, 8 unread, Admin
memory fallback                  PASS, renders, mutates and resets
```

### Responsive

All PASS at 1920x1080, 1440x900, 1366x768, 1180x820, 1024x768, 768x1024,
430x932, 390x844 and 360x800: no horizontal overflow, no clipped text, exactly
one navigation presentation at every width, and the role control inside the
bar. KPI columns are intrinsic on phones: two at 430 (188px) and 390 (168px),
one at 360 (321px).

### Accessibility and contrast

```
26 text roles meet WCAG AA, worst 4.55:1 (sidebar tagline)
one main landmark, route h1 inside it
sidebar is nav[aria-label="Operations"], active item aria-current="page"
notification trigger carries aria-expanded and aria-controls
role control labelled "Demo role"; one polite status region
data SVG aria-hidden with every value written in text beside it
reservations table has four scope="col" headers
```

### Performance

Measured inside the page. Driving these through Playwright reports seconds,
because its default rAF polling starves against an application that schedules
no frames at rest: the delay is in the harness, not the product.

```
role switch                 9-34 ms
notification panel open    13-14 ms
mark all read (8 rows)     74-82 ms
CLS after initialization    0.00000
intervals while idle        0
animation frames while idle 0
```

QA SANITY MEASUREMENT - NOT A PRODUCTION BENCHMARK.

### Network

0 external requests, 0 `/api/` calls, logo served locally. Two Next.js preload
hints for a route stylesheet appear in the console; they are framework asset
hints, not errors, hydration warnings or failed resources, and are reported
rather than suppressed.

### Screenshots

`qa/shots/stage09c2/`: overview at 1440x900, 1024x768 and 390x844, the
Finance Analyst role at 1440x900, and the notification panel at 390x844.

### Regression

```
stage09a-runtime   76/76
stage09a-shell     85/85   (after raising the chrome wrap breakpoint to 860px,
                            which the added mark made necessary)
stage09b-spec      96/96
stage09c1-domain   211/211
qa:memory          18/18
```

---

## Stage 09C2.1 - Operations Shell Hardening

PASS. Harness: `qa/stage09c21-operations-hardening.mjs` (111 checks), plus the
full regression below.

Run against a **local production build**, never the dev server:

```
npm run build
npx next start --hostname 127.0.0.1 --port 3001
node qa/stage09c21-operations-hardening.mjs
```

Port 3001. Port 3200 belongs to the other application on this host and is not
touched; 3100 is this portfolio's live production.

### What this stage asked

09C2 asked whether the shell rendered. This asked whether what it renders is
honest.

```
KPI semantics       no progress bars; every breakdown sums to its headline;
                    no comparison language anywhere
role composition    KPI, panel, action-queue and notification sets per role,
                    each derived from permissions.ts
role containment    no role sees a surface from a module it cannot open;
                    no role sees anything Admin cannot; each sees less
mobile sheet        390px and 360px: inside the viewport, below its bar,
                    scrim, close control, page scroll locked, last row
                    reachable, focus returned
logo                master byte-identical; derived mark tighter than the
                    master, same aspect, margin intact, corners transparent
identity            the product names itself exactly once at every width
reset               returns to Admin, 38/4/10/8, 8 unread
```

### Defects found and fixed

```
KPI progress bars     a bar with no denominator, drawn in the visual language
                      of a measurement            -> derived breakdowns (D-057)
role rule half done   panels, queue and notifications ignored the matrix; the
                      Finance badge read 8 over a list of 3   -> D-056
notification popover  anchored to a 24px bell, overflowed a phone
                      -> full-width sheet with scrim and close control
mark too small        11% transparent padding on each side of the master
                      -> tight derivative, 25px visible becomes 30px (D-059)
bar duplicated name   "Operations Console" three times in the top 120px
                      -> the shared bar's title stands down (D-060)
query blanked on      the badge cleared and the list emptied while six of
  every revalidation   eight writes were still outstanding      -> D-058
KPI breakdown clipped  each part is nowrap and nothing sat between two of
                       them, so the line had no break opportunity and the
                       fourth part was cut off from 1180px to 1440px
                       -> a wrapping flex gap replaces the middle dot
```

The last one was found by reading a production screenshot after deployment,
which is the review workflow this stage exists to establish (D-061) doing its
job on the first pass. The harness now asserts the fit, not only the sums.

The last one was found by the harness as an intermittent failure and confirmed
by reading IndexedDB directly at the moment the badge cleared: the store still
held six or seven unread. The persistence layer was correct throughout. Three
consecutive clean runs of each UI harness confirm the fix.

### Role composition, as rendered

```
                   KPIs  panels                                    badge  queue
Admin                 4  Lead funnel · Fleet · Upcoming · Queue        8      6
Sales Agent           2  Lead funnel · Upcoming · Queue                8      6
Fleet Coordinator     2  Fleet · Upcoming · Queue                      2      2
Finance Analyst       1  Payment status · Contract status · Queue      0      3
```

Finance's badge is 0 because its own notifications are all read in the seed,
which is the point: the badge now counts the list it labels. Every badge equals
the unread rows in that role's own panel.

### Mobile notification sheet

```
                         390px            360px
panel width              92% of viewport  91% of viewport
top                      189 (bar ends 181)
bottom                   836 of 844
horizontal overflow      none             none
scrim / close control    present          present
page scroll locked       yes              yes
last row reachable       yes (22 rows)    yes (22 rows)
focus returned on close  yes              yes
shared bar               3 rows, every item on screen, no empty filler
```

### Logo

```
master        logo.png 1254x1254, 844406 bytes - read, never written
artwork       965x1119 at x144 y67, so 68.7% of the master frame
derived mark  public/brand/mark-120.png, 105x120, 17.3 KB
              fills 88% of its frame, aspect within 2% of the master,
              margin intact, all four corners fully transparent
rendered      30px tall in site navigation, 22px in the demo bar
```

### Screenshots

`qa/shots/stage09c21/`, captured from **production over HTTPS**, not from a
local build: the Overview at 1440x900, 1024x768 and 390x844, the notification
sheet at 390x844, and the Finance Analyst role at 1440x900.

### Public verification

Run with `QA_BASE=https://intelligent-systems-lab.duckdns.org`, after
`npm run deploy:safe`.

```
09C2 suite / 09C2.1 suite    140/140 and 111/111 against production
routes                       / 200, /demos/operations 200, /demos 404,
                             /specimen 200, icons and mark 200
mark served                  byte-identical to public/brand/mark-120.png
robots                       <meta name="robots" content="noindex, nofollow">
                             on the demo route
role persistence             survives closing and reopening the page in the
                             same browsing context
demo isolation               a fresh context sees the pristine seed, not the
                             first context's state
reset                        restores Admin, 38/4/10/8 and 8 unread
shared host                  appclubedaeconomia.com.br still 200 afterwards
```

### Regression

All run against the same local production build.

```
stage09a-runtime                76/76
stage09a-shell                  85/85
stage09b-operations-spec        96/96
stage09c1-operations          211/211
stage09c2-operations-ui       140/140
stage09c21-hardening          111/111
qa:memory                       18/18
tsc --noEmit                    clean
eslint                          0 errors (1 pre-existing warning in qa/texture.mjs)
                              ------
                              719 checks
```

Two assertions in the 09C2 harness were updated rather than removed: the demo
bar mark is no longer square, and the queue's re-render is now waited for as a
condition instead of a fixed 150ms sleep. A wait that never resolves still
fails its check.

---

## Stage 09C3.1 - Operations Leads

PASS. Harness: `qa/stage09c31-leads.mjs`.

```
281 checks   with the domain probe fixture in place
252 checks   without it - the domain section skips itself when the probe
             route is absent, which is what happens against production
```

Run against a **local production build**, never the dev server, and never on
port 3200 (the other application on this host):

```
cp qa/fixtures/demos-operations-probe.page.tsx src/app/demos/qa-operations/page.tsx
npm run build
npx next start --hostname 127.0.0.1 --port 3001
node qa/stage09c31-leads.mjs
rm -r src/app/demos/qa-operations
```

### Two layers

The suite drives the domain through the probe and the product through the
browser, because this stage's rules have to hold whether or not a screen
remembers to ask.

```
domain    Rule 01 and Rule 02 firing, the follow-up offset measured against
          the automation's own clock, the archived/converted guards, the
          audited edit, the role matrix, the list selector's ordering
product   the list, search, filters, sorts, paging, URL selection, deep
          links, the detail, create, edit, stage, assignment, conversion,
          archive, roles, Overview regression, persistence, reset
```

### Measured through the product

```
initial list          48 leads, 10 rows, page 1 of 5, last activity desc
stage distribution    New 12  Contacted 10  Qualified 9  Proposal 7
                      Won 6  Lost 4        - each asserted by filtering
owners offered        Unassigned, Avery Chen        - derived, not listed
search "  ALINA  "    3 leads (trimmed, case-insensitive; the name pool
                      repeats every twenty leads, so three match)
paging                all 48 rows visited across five pages, none repeated
create Website        owner becomes Avery Chen, badge +1, two audit entries
create Walk-in        owner stays Unassigned, no rule wakes
qualify               follow-up "In 2 days", badge +1, audit entry
convert               stage Won, customer created, both links set, the
                      Convert action withdrawn, second attempt CONFLICT
archive               48 -> 47, row gone, URL cleared, focus recovered
Overview regression   create +1 open, qualify +0, Lost -1
```

### Automations

The finding of the stage: they were not running at all outside the QA harness.

```
before   processEvents had no caller outside automations.ts;
         the runtime event bus had no subscribers
after    services/lead-workflows.ts joins them (D-063)
Rule 01  website lead -> assigned to actor_0002, CRM notification, run
Rule 02  qualified -> follow-up exactly FOLLOW_UP_OFFSET_MS out, notification
```

The follow-up assertion is anchored on the AutomationRun record and expects the
offset **minus one clock tick**, computed from the domain's own constants: the
run is written by a second commit, and every commit advances the logical clock.

### Accessibility and contrast

```
semantic table with scope=col headers and scope=row row headers
aria-sort on the sorted column only; five sortable headings are buttons
a lead opens from the keyboard; Escape closes the drawer
focus returns to the row that opened the detail
focus moves to the region heading when archiving removes that row
labels on search, all three filters, page size and every form field
one polite live region; the result count is announced
contrast, every stage and priority tone measured over its composited
background: 4.55:1 worst, 17.36:1 best - all pass AA
```

Measuring a translucent pill against its own tint rather than the tint over
the surface beneath it understates contrast badly; the harness composites
every layer, as the browser does.

### Responsive

PASS at 1920x1080, 1440x900, 1366x768, 1180x820, 1024x768, 768x1024, 430x932,
390x844 and 360x800: no horizontal overflow, exactly one list presentation and
one filter presentation at every width, ten records listed.

```
>= 1180px   eight columns
<  1180px   Source hidden; it is stated again in the detail
<  768px    record cards; filters move into a sheet; the detail becomes a
            full surface rather than a 460px drawer inside a 390px screen
```

### Overlays

One `<dialog>` with `showModal()` in three geometries, so modality, focus
trapping, inertness and Escape are the platform's rather than reimplemented.
Page scrolling is held by a counted lock, so whichever overlay closes first
cannot restore scrolling underneath one that is still open. The notification
sheet's scrim covers the module beneath it, so a second overlay cannot be
reached while it is open.

### Network and cost

```
0 external requests, 0 /api calls, 0 console errors
0 animation frames and 0 intervals while idle
search 34 ms, clear 17 ms, filter 21 ms   (QA SANITY, NOT A BENCHMARK)
CLS 0.00000
no email, telephone, handle or manufacturer brand anywhere in the module
```

### Defects found by looking, after the suite passed

```
lead names rendered in the column-header face and sat ten pixels above
  their row: `.ops-table th` out-specifies a row-header class
a stub of border under the last row's name: `tr:last-child td` does not
  reach a `th`
a just-created lead was reported as an unknown id for half a second,
  because "not in the list" and "not read yet" were the same branch
```

### Public verification

Run with `QA_BASE=https://intelligent-systems-lab.duckdns.org` after
`npm run deploy:safe`.

```
suites            09C2 140/140, 09C2.1 111/111, 09C3.1 252/252
routes            / 200, /demos/operations 200,
                  /demos/operations/leads 200, /demos 404,
                  /demos/qa-operations 404 (no QA route in production)
robots            <meta name="robots" content="noindex, nofollow">
disclosure        INTERACTIVE ENGINEERING DEMO / SYNTHETIC DATA present
#work             still the Stage 03 placeholder
CRUD over HTTPS   create Website lead -> assigned to Avery Chen, 49 leads;
                  edit; qualify -> follow-up "In 2 days", badge 8 -> 10;
                  reload -> state survives; convert -> Won, action withdrawn;
                  reset -> 48 leads, Admin, badge 8
roles             Admin and Sales Agent see 10 records and may create;
                  Fleet and Finance see none, get the unavailable state,
                  no navigation entry, no lead id anywhere in the page
direct load       a barred role loading the URL gets the contained state,
                  not a redirect
responsive        1440, 1024, 390, 360 - no horizontal overflow
network           0 external, 0 /api, 0 console errors
shared host       appclubedaeconomia.com.br still 200 afterwards
```

Screenshots: `qa/shots/stage09c31/` from a local build (list, detail, create,
empty, confirmation, tablet, mobile list, mobile filters, mobile detail) and
`qa/shots/stage09c31/public/` from production over HTTPS.

### Regression

```
stage09a-runtime                76/76
stage09a-shell                  85/85
stage09b-operations-spec        96/96
stage09c1-operations          211/211
stage09c2-operations-ui       140/140
stage09c21-hardening          111/111
stage09c31-leads              281/281
qa:memory                       18/18
tsc --noEmit                    clean
eslint                          0 errors (1 pre-existing warning in qa/texture.mjs)
                              ------
                             1000 checks
```

One 09C2 assertion moved rather than being removed: it asserted that Overview
alone was interactive, which was temporary build state this stage changes.

---

## Stage 09C3.1.1 - Leads Control Presentation

PASS. Harness: `qa/stage09c31-leads.mjs`, grown from 281 to **398 checks**
(369 without the domain probe, which is what runs against production).

Three sections were added for this stage: control geometry and semantics, the
pagination composition, and the provenance band measured at six widths.

### What the external review found

Four presentation faults, none of which the suite had an opinion about.

```
filters      a detached uppercase label beside a browser select, four times
sort         a field select plus an unlabelled square carrying an arrow
page size    a bare "10" behind the words PER PAGE, pinned to the far right
pagination   three clusters spread across 1305px with no shared structure
provenance   a 469px capsule with 608px of empty bar beside it
```

### Controls, as measured

```
filters        40px tall, 11px radius, 13.5px value text, 12px padding
page size      38px tall, 99px wide, 11px radius, 14px padding
appearance     none - the platform arrow is replaced by a drawn chevron,
               which is aria-hidden; the element is still a <select>
accessible     Stage / Source / Owner / "Sort leads" / "Rows per page"
active state   border and ink, no fifth accent colour
stability      163/230/171/256px at default, 166/238/176/256 with every
               filter set - the control does not resize with its value
longest value  "Returning customer" clips nothing and does not rewrap the row
focus          2px ring on the wrapper via :focus-within
```

### Sort

One control, twelve options, no direction button. Each option names its field
and its direction: `Last activity: newest`, `Next follow-up: soonest`,
`Lead name: A–Z`, `Stage: early first`, `Priority: high first`,
`Created: oldest`. The semantics are the frozen ones (six fields, both
directions) expressed as one choice instead of two.

### Provenance band

Measured against the space actually available, which is the bar minus the two
intrinsic ends, their gaps and the bar's padding.

```
1920   1407px of 1406px available     1440   927px of 926px
1024    511px of  510px available      768   full-width row of its own
 390   full-width row of its own       360   full-width row of its own
```

Content stays left-aligned inside the band at every width, and the words are
unchanged.

Below 861px the bar is wrapping flex rather than grid, and that is measured:
at 360px the back link (120px), the role select (167px intrinsic - "Fleet
Coordinator" needs it) and Reset (59px) are 363px of content in a 321px bar. A
two-column grid grew to hold them and the band, spanning both columns,
stretched to that overflowed width. Two rows at 430px and above, three below,
which is what it was before this stage.

### Pagination

```
desktop   one grid under a rule: range left, Previous/Page/Next centred,
          "10 rows" right, all on one baseline
mobile    stacked and centred - range, page indicator, the two steps
          sharing the width, then the page size
steps     real <button disabled> on the first and last page, so the state
          is announced; they keep their size when disabled
20 rows   Page 1 of 3, range 1-20 of 48; the page clamps on the way back
```

### Viewports

No horizontal overflow and nothing clipped at 1920x1080, 1600x900, 1440x900,
1366x768, 1180x820, 1024x768, 768x1024, 430x932, 390x844, 375x812 and 360x800.

The `visually-hidden` labels report as clipped by any naive scrollWidth check:
they are 1px-clipped by design. The suite excludes them, as it has since 09C2.

### Regression

```
stage09a-runtime                76/76
stage09a-shell                  85/85
stage09b-operations-spec        96/96
stage09c1-operations          211/211
stage09c2-operations-ui       140/140
stage09c21-hardening          111/111
stage09c31-leads              398/398
public-repo-safety              17/17  (19 with --history)
qa:memory                       18/18
tsc --noEmit                    clean
eslint                          0 errors (1 pre-existing warning in qa/texture.mjs)
                              ------
                             1152 checks
```

One pre-existing harness weakness was fixed rather than worked around: the
responsive section waited for the result-count element, which renders a blank
placeholder before the query settles, so it could measure an empty table. It
waits for a record now.

---

## Stage 09C3.1.2 - Custom Select System

PASS. Harness: `qa/stage09c31-leads.mjs`, grown from 398 to **407 checks**
(378 without the domain probe, which is what runs against production), plus
the new `npm run qa:style` guard.

### What the external review found

Six dropdowns whose closed control looked right and whose open menu did not.
The popup belongs to the operating system, so it arrived with square corners,
almost no option padding, a saturated system-blue selection band and a border
from Windows. No CSS on `<option>` reaches any of it.

### The menu, as measured

Identical across all six controls, and across the five that were converted
alongside them:

```
menu radius        12px          menu padding      6px
option padding     9px / 12px    option radius     8px
option text        13.5px        selected          soft sky, with a tick
stacking           z-index 70    position          fixed, measured
native selects     0 on the page (6 role=combobox triggers)
```

### The six controls

```
Stage    7 options    Source   6 options    Owner   3 options
Sort    12 options    Rows     2 options    Role    4 options
```

Every one: rounded menu, padded rounded options, soft sky selected state with
a tick, keyboard operable, within the viewport, no clipping.

### Behaviour

```
open          Enter, Space, ArrowDown or ArrowUp, onto the CURRENT value
navigate      ArrowUp/ArrowDown, Home, End
choose        Enter, or click
Escape        closes, value unchanged, focus stays on the trigger
Tab           closes and moves on
typeahead     "q" reaches Qualified; 600ms buffer, cleared on unmount
outside click closes, value unchanged
exclusivity   opening one menu closes any other
placement     below when there is room, above when there is not
              (page size at 1366x768 opens upward and stays in view)
height        12 sort options cap at 320px and scroll internally
width         grows past the trigger for "Returning customer" without clipping
              and never crosses the viewport edge
```

### Accessibility

`role="combobox"` with `aria-haspopup="listbox"`, `aria-expanded`,
`aria-controls` and `aria-activedescendant`; the menu is `role="listbox"` and
options are `role="option"` with `aria-selected`. Focus never leaves the
trigger, which is what makes Escape, Tab and outside-click behave.

The accessible name is `aria-labelledby` over the visible label and the current
value, so a reader hears "Stage, All stages" once rather than a decorative
label read and then repeated. The chevron and the tick are `aria-hidden`.

Focus ring measured at 2px solid with `:focus-visible` true after tabbing to
the control (programmatic focus does not match `:focus-visible`, so the check
tabs).

### Inside a dialog

A menu opened from the phone filter sheet is portalled into that `<dialog>`
rather than into `document.body`. A modal dialog is in the browser's top layer,
above every z-index, so a body-portalled menu would have been painted behind
the sheet that opened it. Verified at 390 and 360: `parentTag: DIALOG`, menu
on top, within the viewport, 12 sort options scrolling at 320px.

### Em dash removal

```
before      791 occurrences in 161 tracked files
after         0
guard       npm run qa:style, reports file, line and column
canonical   CLAUDE.md "Writing style", D-073
```

Each was judged in context rather than substituted: a colon where the second
half explains, a comma for an aside, a full stop between two sentences,
parentheses around a bracketed clause that contains its own commas, a hyphen in
a heading. The sort labels moved to `Last activity: newest`, and the tables'
empty-value placeholder to a hyphen.

`AGENTS.md` is regenerated by `next dev` and will reintroduce two occurrences
if that command is run. The guard catches it.

### Regression

```
stage09a-runtime                76/76
stage09a-shell                  85/85
stage09b-operations-spec        96/96
stage09c1-operations          211/211
stage09c2-operations-ui       141/141
stage09c21-hardening          111/111
stage09c31-leads              407/407
public-repo-safety              19/19  (with --history)
copy-style                        1/1
qa:memory                       18/18
tsc --noEmit                    clean
eslint                          0 errors (1 pre-existing warning in qa/texture.mjs)
                              ------
                             1165 checks
```

The suites that drive the role control were updated: it is a listbox now, so
`selectOption` was replaced by opening the menu and clicking an option.

One assertion changed meaning rather than form. The 09C3.1 role-leak test drove
the role while a lead detail was open, which `selectOption` allowed because it
does not hit-test. The detail is a modal `<dialog>`, so the chrome behind it is
genuinely inert and a visitor cannot reach the role control at all. The suite
now asserts that inertness, then closes the detail and checks the leak
protection as before.

---

## Stage 09C3.2 - Operations Customers

PASS. Harness: `qa/stage09c32-customers.mjs`, **174 checks** with the domain
probe in place and 130 without it, which is what runs against production: the
domain section skips itself, and so do the three checks that drive the archive
refusal, because they need the probe to name a customer the rule blocks.

### What it covers

```
domain        the seeded 32 customers and their 6 conversions, create with a
              trimmed name and a defaulted status, the blank-name refusal,
              the write matrix for all four roles, the audit diff over all
              four fields, the unchanged-resubmit silence, both archive
              guards and their exact wording, the double-archive conflict
list          search over name and notes, both filters, eight sorts, the
              page clamp, page sizes, the archived exclusion
product       the count, the columns, the ten rows, the pager range and page
              label, Next and Previous, the disabled edge, 20 rows
drawer        selection, the URL contract, deep links valid and invalid,
              focus return to the row that opened it, the five fact rows,
              the relationship groups, the activity feed
mutations     create through the form and the record it opens on, edit into
              an open drawer and the activity entry it writes, cancel, the
              archive that succeeds, the archive that is refused in the
              service's own words with the dialog left open to be read
roles         Admin 7 columns / 5 groups, Sales 7 / 4, Finance 6 / 2 and no
              write action, Fleet the closed-module panel and no data at all
mobile        390 wide: cards replace the table, the filter sheet, the drawer
              width, no overflow at 360 / 414 / 768 / 1024 / 1440
presentation  composited contrast on every tone, focus rings, no native
              select, the keyboard path through the custom listbox, and the
              standing content rules read off the rendered page
```

### What it found

The audit gap §64 asked about was real: `updateCustomer` recorded status and
segment only, so a rename or a notes rewrite wrote nothing and the Activity
panel stayed silent about a change the visitor had just made. Fixed to diff all
four fields, with the unchanged-resubmit silence kept.

Two harness corrections, both mine rather than the product's: the domain error
code is `VALIDATION` rather than `INVALID`, and the page-size options are 10
and 20 rather than 10 and 25.

### Regression

```
stage09a-runtime                76/76
stage09a-shell                  85/85
stage09b-operations-spec        96/96
stage09c1-operations          211/211
stage09c2-operations-ui       141/141
stage09c21-hardening          111/111
stage09c31-leads              407/407
stage09c32-customers          174/174
public-repo-safety              19/19  (with --history)
copy-style                        1/1
qa:memory                       18/18
tsc --noEmit                    clean
eslint                          0 errors (1 pre-existing warning in qa/texture.mjs)
                              ------
                             1339 checks
```

One 09C2 assertion changed value rather than meaning. It lists the modules
whose sidebar entries are interactive, which moves each time a module is built:
`["Overview","Leads"]` became `["Overview","Leads","Customers"]`. That check and
the `implemented` flag behind it are deleted once all eleven modules exist.

---

## Stage 09C3.3 - Operations Inbox and CRM Workflow

PASS. Harness: `qa/stage09c33-inbox.mjs`, **367 checks** with the domain probe
in place and 274 against production, where the two domain sections skip
themselves because the fixture route is not deployed.

### What it covers

```
domain        the seeded distribution measured rather than asserted from
              constants: 20 conversations, 64 messages, 11 lead and 9 customer
              subjects, 12 Web chat and 8 In-app, 13 Open and 7 Closed, 6
              unread, sixteen threads of three and four of four
integrity     every conversation resolves its subject, every assignee is a real
              actor or null, every thread holds at least two messages, every
              message belongs to a conversation and names a resolvable actor,
              and no thread's timestamps go backwards
reply         trimmed body, Staff author, the current actor as author (Morgan
              for Admin, Avery for Sales), the thread marked read, one audit
              entry saying a reply was added, and the body absent from it
refusals      a blank reply, a closed thread, Finance and Fleet
triage        read and unread write no audit at all
assignment    the assignable set derived from the matrix, the audit entry
              naming both ends as people, and four refusals: a Fleet
              Coordinator, a Finance Analyst, an unknown id, and a
              reassignment to the value already stored
lifecycle     close, reopen, and the double-close conflict
rule 03       a reservation confirmed through the real service, its event
              processed by the real engine, a System message appended to the
              customer's conversation, the thread marked unread, a run
              recorded
selectors     three filters, their combination, search over subject names and
              message bodies, trimming and case, the frozen order, and that
              marking a thread read does not move it
assist        a brief for a lead thread, one from the source lead for a
              converted customer, none for an established one, and no
              fabricated lead field anywhere near them
reset         20 conversations, 64 messages, 6 unread, 13 open, 7 closed and
              the canonical assignee, after four mutations
product       the list and its three unread cues, closed threads still listed,
              every filter and the clear, search, the empty state, the thread
              header, the transcript, message authorship, URL selection with
              Back and Forward, deep links valid and invalid
W5            the whole workflow: an unread qualified lead thread, its brief,
              a reply, the read state, the preview and count following, the
              brief and recommended action both recomputing, and all of it
              surviving a reload
actions       read and unread with the count and filter following, assignment
              with the list row following, close removing the composer, and
              reopen restoring it
roles         Admin and Sales both work the Inbox and reply as themselves;
              Finance and Fleet get the contained unavailable state with no
              thread, no message body, no composer and no list; returning to
              Admin restores the URL-selected conversation
crm           Inbox to lead, Inbox to customer, lead brief to conversation,
              customer to conversation, customer to origin lead, lead to
              customer, and a notification to its source
mobile        390 and 360: the list alone, the thread alone once selected, the
              filter sheet, the context disclosure, the assignment menu inside
              a narrow thread, Back, and no overflow
responsive    thirteen viewports from 1920 to 360, no horizontal overflow, and
              the transcript the widest panel wherever it is shown
a11y          rows as real buttons, Enter to open, focus to the thread heading,
              a labelled composer, Enter inserting a newline rather than
              sending, the assignment menu's ARIA, and one polite live region
content       no email, telephone, messenger channel, delivery claim or em dash
              on the rendered page, and no external or API request during a
              reply
```

### What it found

Two domain gaps, both fixed before any UI was written: `assignConversation`
accepted an arbitrary actor id, and neither assignment nor replies wrote audit.
See D-075 and D-076.

One specification clause that could not be satisfied: the Lead Brief on every
customer conversation. Seven of the nine seeded customer threads reach no lead.
See D-078.

One layout figure that did not survive measurement: three panels at 1180px gave
the transcript 221 pixels, because the sidebar appears at exactly that width
and takes 240. See D-082.

One piece of dead code with a comment claiming otherwise: `addSystemMessage`,
documented as used by Rule 03 and called from nowhere.

### Regression

```
stage09a-runtime                76/76
stage09a-shell                  85/85
stage09b-operations-spec        96/96
stage09c1-operations          211/211
stage09c2-operations-ui       141/141
stage09c21-hardening          111/111
stage09c31-leads              407/407
stage09c32-customers          174/174
stage09c33-inbox              367/367
public-repo-safety              19/19  (with --history)
copy-style                        1/1
qa:memory                       18/18
tsc --noEmit                    clean
eslint                          0 errors (1 pre-existing warning in qa/texture.mjs)
                              ------
                             1706 checks
```

The 09C2 interactive-module assertion changed value again, as it does each time
a module is built: `["Overview","Leads","Customers"]` became
`["Overview","Leads","Customers","Inbox"]`. That check and the `implemented`
flag behind it are deleted once all eleven modules exist.

---

## Stage 09C3.3.1 - Inbox Viewport Containment

PASS. Harness: `qa/stage09c33-inbox.mjs`, extended with a CONTAINMENT section:
**422 checks** with the domain probe in place and 329 against production.

### What the external review caught that the suite did not

The Inbox rendered at the top of a 2751px document with 1951px of portfolio
background beneath it. Every existing check passed while it did, because the
document never scrolled and nothing was visible in that band: the suite had no
assertion that measured the height of the document itself, and captured only
viewport screenshots, which by definition cannot show a region below the
viewport.

### Root cause

Not the suspected `height: 100dvh` on the demo shell. Measured, the shell was
800 tall with a scrollHeight of 800 at an 800px viewport, and everything under
it was contained. The break was between `.demo-shell` (800) and `.site-main`
(2751), its only child.

`overflow` clips a descendant only when the descendant's containing block is
inside the clipping box. The twenty-four `position: absolute` `.visually-hidden`
spans in the module resolved their containing block to `.site-main` and escaped
every clip, laying out at their static offsets down to y=2750. See D-086.

### New assertions

```
document        body.scrollHeight equals documentElement.clientHeight within 2px
frame           site-main.scrollHeight equals it too
application     the demo shell's bottom edge reaches the viewport bottom
capture         a full-page screenshot equals the viewport, at eight viewports
pixels          the bottom of that capture holds no run of backdrop colour
scrolling       the conversation list still scrolls internally, so containment
                was not bought by clipping the list
rule            no absolutely positioned descendant of the Inbox resolves its
                containing block outside the module
states          no selection, lead thread, customer thread, closed thread
scoping         Leads and Customers still grow with their content
```

Measured at 1920x1080, 1430x800, 1440x900, 1366x768, 1024x768, 768x1024,
390x844 and 360x800.

### What the correction itself broke, and the suite caught

Making the transcript a positioned box put it above the context toggle, a
static later sibling, and the button stopped accepting clicks at 390px. The
mobile section failed on it. Positioning the toggle restores DOM order as the
tiebreak.

### Document metrics

```
                         before        after
body.scrollHeight        2751          800
documentElement.client    800          800
overflow below viewport  1951            0
full-page capture    1430x2751    1430x800
backdrop pixels below     1951px         0px
list height / content   414 / 2500   414 / 2500
```

---

## Stage 09C4.0 - Rental Operations core readiness

PASS. Harness: `qa/stage09c40-core-readiness.mjs`, **62 checks**, domain only.

### The assertion that matters

A world invariant, not an expected string. After every mutation the suite walks
every vehicle in the store and compares its persisted `status`,
`currentContractId`, `currentReservationId` and `activeMaintenanceId` against
`deriveVehicleStatus` and `deriveVehicleLinks` computed over the world that
mutation left behind. A failure names the vehicle and both sides.

That is what found the two omissions this stage fixed. An expected-string check
would only have caught the vehicle someone thought to look at.

### What it covers

```
seed            every seeded vehicle already matches its derivation
Rule 03         confirming through the workflow appends a System message,
                marks the conversation unread and records one run, with no
                manual processEvents anywhere; and the bare service still
                wakes nothing, which is what proves the workflow closed it
Rules 01/02     unchanged by moving the mechanism to a neutral module
sequence        draft, confirm, convert, activate, complete, with the fleet
                invariant asserted at each of the five steps
maintenance     create, start, complete, invariant at each step
payments        integer cents, balance arithmetic, one audit entry,
                overpayment, zero, fractional cent and cancelled contract
                all refused
drafts          a named vehicle must exist and match the class; naming none
                stays legal
reset           24 vehicles at 10/4/7/3, ten work orders, invariant intact
```

### Regression

```
stage09a-runtime                76/76
stage09a-shell                  85/85
stage09b-operations-spec        96/96
stage09c1-operations          211/211
stage09c2-operations-ui       141/141
stage09c21-hardening          111/111
stage09c31-leads              407/407
stage09c32-customers          174/174
stage09c33-inbox              422/422
stage09c40-readiness            62/62
render safety                   pass
public-repo-safety              19/19  (with --history)
copy-style, qa:memory           pass
tsc, eslint                     clean
```

**No existing assertion was changed or weakened.** The behaviour changes are
additive in the sense that matters: they make stored state agree with a
derivation the suites already trusted, so nothing that passed before stopped
passing. In particular `stage09c1-operations` passes 211/211 untouched,
including its W2 and W4 vehicle-status assertions and its "maintenance on a
rented vehicle is a CONFLICT" case, which still holds because the conflict
lives at start.

---

## Stage 09C4.1 - Operations Reservations

PASS. Harness: `qa/stage09c41-reservations.mjs`.

### The assertion this module exists to make

Confirming through the product runs Rule 03. 09C4.0 proved the bare service
wakes nothing and the workflow wakes the rule; this proves the screen uses the
workflow, and it proves it the only way that cannot be faked: by opening a
second page on the domain probe in the same browser context, building a runtime
on the same IndexedDB the screen persists to, and reading what one click left
behind.

```
AutomationRun        18 to 19, Rule 03 count 4 to 5, status Success
System message        0 to 1, body "Reservation confirmed. Vehicle assigned."
unread conversations  6 to 7
messages             64 to 65
fleet invariant      every vehicle still equals its derivation
```

No hand-written events, no manual `processEvents`, no second control in the
interface.

### What else it covers

```
seed          18 reservations measured from the store: 4 Draft, 4 Confirmed,
              7 Converted, 3 Cancelled, 14 holding a vehicle and 4 not, and
              no draft holding one, which is D-091 already true in the seed
list          six columns, both filters, eight sorts, search over customer,
              vehicle, notes and id, pagination at 10 and 20, empty states
detail        selection, the URL contract, Back and Forward, deep links valid
              and invalid, focus return, the four sections
lifecycle     create through the five-field form, the end-before-start guard,
              edit with the customer shown as a fact, confirm, convert
confirm       the eligible set, the disabled action until a choice is made,
              the operational identity on each option
zero          a whole class taken into the workshop through the real service,
              then: no choice offered, the state explained, confirmation
              impossible, no override, and the reservation left untouched
cancel        the dialog, backing out, the transition, and a converted
              reservation offering no actions at all
roles         Admin, Sales and Fleet all work the module; the Fleet
              Coordinator sees the customer's name with no link into Customers
              and none into the Inbox; Finance gets the contained state with no
              data behind it, including by direct link
mobile        390 and 360: cards, the filter sheet, the drawer, browser Back,
              and the confirmation sheet fitting with its action reachable
containment   eight viewports, full-page captures, zero backdrop pixels, and
              no absolute descendant escaping the module
content       no contact data, no payment or document fields, no booking CTA,
              no em dash, and no request leaving the origin
reset         18 reservations, 14 contracts, 24 vehicles, 20 conversations,
              64 messages, 18 automation runs and 6 unread all return, with
              the fleet invariant intact
```

### What it found

One latent hazard in the product, and two faults of my own in the harness.

The product one is the rule that D-086 came out of, stated rather than tested
by symptom: five `.visually-hidden` elements in this module are
`position: absolute`, and with no positioned ancestor inside the module they
were resolving their containing block against `.site-main`. Nothing clips here,
so nothing escaped anywhere visible and every capture was clean. But that was a
property of this layout rather than of the markup, and it is the exact
arrangement that put the Inbox above 1951 pixels of portfolio background.
`position: relative` on `.ops-reservations` makes it a rule instead of a
coincidence.

The two of mine: the role section tried to switch roles with the detail drawer
open, which a visitor cannot do because the drawer is a modal dialog and the
chrome behind it is inert, so the section now closes it first and asserts that
inertness. And the containment section asserted that the document ends near its
content, which is wrong on a tall viewport with a short list: the shell keeps
`min-height: 100dvh`, so app surface legitimately fills the rest. The assertion
now says what it means, and the capture check is what proves no portfolio
background appears there.

### Regression

```
stage09-render-safety           pass
stage09a-runtime                76/76
stage09a-shell                  85/85
stage09b-operations-spec        96/96
stage09c1-operations          211/211
stage09c2-operations-ui       141/141
stage09c21-hardening          111/111
stage09c31-leads              407/407
stage09c32-customers          174/174
stage09c33-inbox              422/422
stage09c40-readiness            62/62
stage09c41-reservations       218/218
public-repo-safety              19/19  (with --history)
copy-style, qa:memory           pass
tsc, eslint                     clean
```

One assertion moved, by design. `stage09c2-operations-ui` carries a check
called "only the built modules are interactive" whose expected list is the
build state itself, and whose comment says so: it moved when Leads, Customers
and Inbox were built, and it moves here to
`["Overview","Leads","Customers","Reservations","Inbox"]`. Nothing was
weakened; the list is one longer because one more module is real. Every other
assertion in every suite passed unchanged.

The regression was then re-run for every suite that opens a sheet, after
D-093 changed `.ops-overlay--sheet` to `height: fit-content`:
`stage09c2` 141/141, `stage09c21` 111/111, `stage09c31` 407/407, `stage09c32`
174/174, `stage09c33` 422/422, `stage09c40` 62/62 and `stage09c41` 218/218, all
unchanged, including every mobile sheet-geometry assertion.

The two 09A suites need their fixture routes installed before they will run
(`qa/fixtures/demos-qa-probe.page.tsx` and `demos-qa-shell.page.tsx`), and both
routes were removed again afterwards. A QA route must not exist in production.

### Public production review pass

Run against `https://intelligent-systems-lab.duckdns.org` after deployment, so
there is no probe route and everything below is observed through the interface.
49 checks, all passing.

```
routes        all five demo routes and /specimen answer 200; the three QA
              fixture routes 404; the neighbouring domain still answers 200;
              http still 308s to https
visual        1920x1080, 1440x900, 1366x768, 1024x768, 768x1024, 430x932 and
              390x844, viewport and full-page captures at each, zero pixels of
              portfolio background below the product in any of them
sheets        Leads, Customers and Reservations forms each sized to their
              content, 0px of dead panel (D-093)
sequence      create, confirm from four eligible vehicles, the Inbox showing
              7 unread where the seed has 6, convert to contract_0015 as a
              fact rather than a link, then Reset returning 18 reservations
              and 6 unread
content       no contact data of any kind, no booking CTA, no em dash
console       no error on a plain visit and none through the sequence
```

Three browser warnings appear during the sequence, all the same Chrome preload
resource hint: this script moves between routes with full page loads rather
than through the in-app links a visitor uses. They are reported rather than
asserted on, and a plain visit raises none.

---

## Stage 09C4.A - Contracts, Fleet and Maintenance

PASS. Three harnesses:

```
qa/stage09c4a-core.mjs               domain, 112 checks
qa/stage09c42-contracts.mjs          the Contracts module
qa/stage09c43-fleet-maintenance.mjs  Fleet and Maintenance together
```

Fleet and Maintenance share one suite because the interesting assertions cross
between them: opening a work order changes what the fleet register says about a
vehicle, and completing one is what raises the notification.

### The two assertions this batch exists to make

**An asset code is issued, not typed.** The canonical seed ends at `MTR-024`,
the first vehicle a visitor creates is `MTR-025` and the second `MTR-026`, and
the domain suite also drives the pure allocator over four worlds the seed cannot
produce:

```
empty fleet                      MTR-001
a gap in the middle              MTR-010, not MTR-003
a deleted top record             MTR-025, the suffix is not reissued
a padded twin, MTR-0025          MTR-026, the collision guard earns its keep
an unparseable code alongside    ignored, not crashed on
```

**Rule 05 runs because the screen calls the workflow.** Both paths are driven,
in the same suite, against the same seed:

```
completeMaintenance          0 automation runs, 0 notifications
completeMaintenanceWorkflow  1 run (automation_rule_0005, Success),
                             1 notification (Maintenance, Fleet Coordinator,
                             pointing at the work order)
```

and the UI suite then does it again through the product, reading the store from
a probe page in the same browser context, so what is measured is what one click
left behind.

### The capacity ladder, stated

The domain suite walks one booking the whole way and asserts the four records at
every step. The part worth writing down is what holds a vehicle:

```
Draft reservation      holds nothing
Confirmed reservation  holds it                    Reserved
Converted reservation  releases it
Pending contract       holds nothing               Available
Active contract        holds it                    Rented
Open or In Progress
work order             outranks everything above   Maintenance
```

A pending contract holding nothing is deliberate, and is the same rule D-091
gave for drafts: capacity is taken by the deliberate act.

### The frozen tension, asserted rather than resolved

A work order opened on a rented vehicle leaves the vehicle reading Maintenance
while its contract stays Active, and both pointers are set, because only
`status` is a precedence and `deriveVehicleLinks` fills the three
independently. Starting the work is refused with the service's own sentence.
The suites assert all of that, from the domain and from the screen, and nothing
about it was changed.

### What else the three suites cover

```
contracts     14 records, six columns, live status counts, both filters, ten
              sort choices, search over customer, asset code and contract id,
              pagination, the money grammar (every Total and Balance reads
              USD n.nn and the balance is the domain's own subtraction),
              activate, complete and cancel through the product, and the
              vehicle following each transition read from the store
fleet         24 vehicles, the derived status shown and never written, the
              assignment sentence, create (MTR-025 then MTR-026), edit, the
              class/model re-homing, and the three odometer refusals
maintenance   10 work orders, the priority chip carrying its own word with no
              saturated red and no alarm vocabulary anywhere on the page,
              create, start, complete, cancel, and the active-rental refusal
              shown in the dialog rather than hidden
roles         Contracts opens for all four and mutates for one, with the
              read-only note naming the role; Fleet and Maintenance are closed
              to Sales and Finance with no data left behind; and every
              cross-link appears only where the role can follow it
mobile        390 and 360 for all three: cards, filter sheets, drawers,
              browser Back, and the create sheet reachable
containment   eight viewports each, full-page captures, zero backdrop below the
              product, and no absolute descendant escaping any module root
reset         the canonical world returns, including the vehicles this batch
              created being gone
```

### What the suites found

Two harness faults of mine and no product defect in the three new modules.

The priority assertions counted `.ops-prio` unscoped, which matches the desktop
table and the mobile card list both, since the cards are `display: none` at that
width but still in the document. Ten work orders read as twenty. The selector is
scoped to the table now.

Two assertions in the domain suite stated the domain wrongly and were corrected
to what it actually does, which is better than what I had assumed: a rented
vehicle with an open work order keeps its contract pointer rather than losing
it, and a converted reservation leaves its vehicle Available rather than
Reserved.

Separately, building on Reservations surfaced a real defect in it:
`ReservationDetail` called `selectLeadActivity`, which filters audit entries by
`collection === leads`, with a reservation id, so its Activity section could
never populate. The narrowing is now `selectActivity(entries, collection,
entityId)` and the call site is fixed.

### Batch regression

Run once, after all three modules were complete, not three times.

```
stage09-render-safety           pass
stage09a-runtime                76/76
stage09a-shell                  85/85
stage09b-operations-spec        96/96
stage09c1-operations          211/211
stage09c2-operations-ui       141/141
stage09c21-hardening          111/111
stage09c31-leads              407/407
stage09c32-customers          174/174
stage09c33-inbox              422/422
stage09c40-readiness           62/62
stage09c41-reservations       219/219
stage09c4a-core               112/112
stage09c42-contracts          231/231
stage09c43-fleet-maintenance  422/422
public-repo-safety             19/19  (with --history)
copy-style, qa:memory          pass
tsc, eslint                    clean
```

Two assertions moved, both because a module that did not exist now does, and
neither was weakened.

`stage09c2-operations-ui` carries a check whose expected value is the build
state itself, and whose comment says it moves each time a module ships. It is
now the eight-module list.

`stage09c41-reservations` asserted that the converted contract was named and
not linked "because Contracts is not built". D-092 recorded that this would
change when Contracts arrived, and it has: the reference is a link now, and the
suite asserts the link. The old pair had a second problem worth naming, since
it is a trap rather than a typo: the companion check read `.ops-detail__ref`
elements and asserted none of them was an anchor, which passed vacuously the
moment the element stopped being rendered at all. The replacement asserts the
presence of the link rather than the absence of a tag name, and the suite gained
one check.

### Public production review pass

Run against `https://intelligent-systems-lab.duckdns.org` after the batch
deployment, so there is no probe route and everything is observed through the
interface. 142 checks, all passing.

```
routes      all eight demo routes plus /specimen answer 200; the three QA
            fixture routes 404; the neighbouring domain still answers 200
sidebar     eight modules navigable, three still marked pending, and the
            three that are pending are exactly Payments, Automations and
            Reports
visual      seven widths for each of the three modules, viewport and
            full-page captures at every one, zero pixels of portfolio
            background below the product in any of the 42 captures
states      a selected contract with its activation dialog, a selected
            vehicle with both form modes, a selected work order with its
            create sheet, and the three mobile lists with their drawers
sheets      D-093 still holds on the public build: the create sheet is
            sized to its content
sequence    create a reservation, confirm it onto a real vehicle, convert
            it, follow the contract link, activate, read the fleet register
            and find the vehicle Rented and named with its hirer, complete,
            open a work order, start it, complete it, then Reset
reset       14 contracts, 24 vehicles, 10 work orders and 18 reservations
            all return
console     no error on any of the three modules and none through the
            sequence
```

The sequence is the one a reviewer would run by hand, and it crosses all four
modules of the rental group on purpose: the assertion worth making about this
batch is not that three screens render, it is that a booking becomes a rental
becomes a returned vehicle becomes a job in the workshop, and that every screen
agrees about where the machine is at each step.

---

## Stage 09C4.B - Payments, Automations, Reports, and Demo 01 complete

PASS. Three new harnesses:

```
qa/stage09c44-payments.mjs             294 checks
qa/stage09c45-automations-reports.mjs  418 checks
qa/stage09-operations-final.mjs        403 checks
```

### The two assertions Payments exists to make

**Overdue is derived on read and absent from the store.** Read from both sides
in the same section: no stored payment carries the status Overdue, because the
stored union is only Pending and Paid, while the screen shows three rows with
an Overdue pill. That is D-053 stated rather than assumed.

**Rule 04 fires because someone walked in.** The suite opens the reader on the
canonical seed, opens the Payments module in the product, and reads back:

```
automation_runs   18 to 21, all three new ones automation_rule_0004, Success
notifications     22 to 25, all three Finance, pointing at payment_0016,
                  payment_0018 and payment_0019
announcement      "3 payments passed their due date and Finance was notified"
```

Then it reloads the module and asserts nothing further is written, because the
pass skips a payment that already has its notification. Idempotence matters as
much as firing: a module that raised the alert every time it opened would be
worse than one that never raised it.

### The two assertions Automations exists to make

**Disabling actually disables.** The suite switches Rule 03 off through the
dialog, then goes to Reservations and confirms a booking, then reads the store:
a Skipped run was recorded for Rule 03 and no System message was appended. A
screen that greyed the card and left the engine running would pass every other
check in the file and fail that one.

**Test writes a real run and moves nothing.** The dialog does not close on
success: it shows the status, the summary and the run id that were actually
written. The suite then asserts that no work order, vehicle, contract,
reservation, message or unread conversation moved. A Test button that quietly
reassigned a real lead would be a trap, and this is the check that says it
is not one.

### All five rules, through real product paths

One fresh context per rule, so each starts from the canonical seed, and not one
of them calls `processEvents`:

```
Rule 01  create a Website lead in Leads         assigned actor + CRM notification
Rule 02  move a lead to Qualified               follow-up date + CRM notification
Rule 03  confirm a reservation onto a vehicle   System message + unread thread
Rule 04  open Payments as Admin                 3 Finance notifications
Rule 05  complete the In Progress work order    Maintenance notification
```

### Reports

Exactly four panel titles in the frozen order, and the suite asserts there is no
fifth. The only control on the page is the period select: no primary button, no
form, no detail actions. Every `.ops-statbar__share` matches `/\d+% of \d+ /`,
so a share cannot appear without its denominator, and no percentage figure lacks
a note naming what it was taken over. The page is also asserted free of
comparison language: no "vs last", no "previous period", no bare "+12%".

The figures are checked against the canonical seed: funnel 44, fleet 24 split
10/4/7/3, contracts 14 split 3/7/3/1, payments 26 split 18/5/3. That last one
can only be produced by the effective status, which is the point.

### The final suite

`qa/stage09-operations-final.mjs` asks what no module suite can.

```
eleven routes    every module root renders for Admin, the sidebar offers
                 eleven links, and .ops-sidebar__item--pending matches nothing
                 anywhere: the build-state mechanism is gone
one sequence     lead to qualified to customer to reservation to confirmed to
                 contract to active to paid to completed to fleet to work order
                 to started to completed, driven through the real UI, with the
                 store read after every step
five rules       all proven by that sequence plus the Payments entry
invariants       every vehicle equals its derivation; every contract total
                 equals contractTotalCents; every paidAmount equals the sum of
                 its Paid payments; no contract overpaid; no stored Overdue;
                 reservation and contract point at each other both ways;
                 message timelines ordered; every run names a real rule; every
                 notification names a record that exists
roles            all four roles across all eleven routes against the frozen
                 matrix, with no name from a previous role left on the page
widths           eight modules at seven widths, the Inbox on its own
                 viewport-locked thresholds
content          all eleven modules checked for contact data, payment fields,
                 booking CTAs and em dashes, with zero external requests
reset            the whole canonical seed returns
```

### What it found, and what it did not

One real defect, in code written the same day: `reconcile()` in
`PaymentsScreen` had no in-flight guard, so a payment recorded while the first
pass was still committing could raise the same alert twice. Calls are serialised
now. The double-raise was reasoned about rather than observed, and the guard is
cheap enough that waiting for a reproduction would have been the wrong trade.

Three stale assertions, all of them the product outgrowing its own scaffolding
rather than breaking:

`stage09c2-operations-ui` carried "only the built modules are interactive",
whose expected value was the build state and whose comment said it would be
deleted with the `implemented` flag. It is: the check now asserts the permanent
claim, that every module a role can see is a link.

`stage09c33-inbox` asserted that notification sources linked "only to modules
that exist" and that "unbuilt modules stay unlinked", allowing three routes
because three were all there were. Eight source types are navigable now, so the
check asserts every href is a real module route and the inverse is that an
unlinked notification is one with no source record at all.

And one assertion of my own was simply wrong: the final suite expected three
Rule 04 runs in total, when the canonical seed already carries three of its own.
Counting `reconcile_*` source events rather than rule ids is the fix, and it is
a better assertion than the one it replaced.

### Public production review pass, Demo 01 complete

Run against `https://intelligent-systems-lab.duckdns.org` after the batch
deployment, so there is no probe route and everything is observed through the
interface. 395 checks, all passing, 82 captures in `qa/shots/stage09c4b/`.

```
eleven modules  every route renders exactly one visible module root, offers
                eleven sidebar links, and carries no build-state marker
content         all eleven checked for mailto, email, telephone, messenger,
                card or IBAN fields, booking CTAs and em dashes, with the
                synthetic-data disclosure present and the console clean
visual          seven widths across all eleven modules, full-page captures at
                every one, no horizontal overflow anywhere, no portfolio
                backdrop below the product, and the Inbox still exactly one
                viewport tall at every width
payments        26 records, the outstanding total naming its denominator, the
                overdue reconciliation announced on entry, three fields and no
                terminal vocabulary, the balance shown before anything is
                typed, and the sheet still sized to its content (D-093)
automations     five rules with their trigger events shown, enabled state as a
                word, the run history beside them, and View runs narrowing it
reports         the four frozen groups in order, every share carrying its
                denominator, the period select as the only control, and the
                fleet staying a snapshot under a 30 day filter
mobile          Payments, Automations and Reports at 390, no overflow, cards
                replacing the table, consoles clean
roles           all four roles across all eleven routes against the frozen
                matrix, with the sidebar link count matching and every refusal
                naming the role
```

### The public mutation sequence

One integrated workflow, driven through the live interface: create a
reservation, confirm it onto a vehicle, convert it, follow the contract link,
activate, record a payment against it, open a work order, start it, complete it,
and read Reports moving with all of it. Then Reset.

```
reset restores  18 reservations, 14 contracts, 24 vehicles, 10 work orders,
                26 payments
no residue      the review text appears nowhere in Reservations, Maintenance
                or Payments afterwards
reports         back to 12/10/9/7/6 on the funnel and 18/5/3 on payments
```

### What the public pass found

One assertion of mine, not a product fault. The suite banned the phrase
"previous period" as comparison language, and the Reports page contains it in
the sentence that promises the opposite: "Nothing is compared against a previous
period: the dataset does not contain one." A fabricated comparison is a claim
rather than a vocabulary, so the check now bans a signed percentage and an
actual comparison to an earlier window, and additionally asserts that the denial
is present.

### A deployment that reported SUCCESS while PM2 said errored

Worth recording because the deploy script's own summary did not catch it.

Step 8 of `deploy:safe` switched production to `.next-release-b` and the switch
took 19 seconds rather than the usual 7 to 13. In that window PM2 spawned a
replacement before the previous instance released port 3100, the replacement
died with `EADDRINUSE`, and PM2 retried until it marked the app `errored`. One
earlier child had bound successfully and kept serving, so every health check in
steps 9 and 11 passed and the run finished SUCCESS.

The result was production served correctly by a process PM2 had lost track of:
no pid file, status `errored`, and every subsequent `pm2 restart` spawning a new
child that could not bind. A supervisor that cannot restart the thing it is
supervising is a live site with no recovery path.

Resolved by stopping the orphan so the port freed, starting the app under PM2,
and verifying one listener, all thirteen public routes 200, the three QA routes
404, the neighbouring domain untouched and the http redirect intact, then
`pm2 save`. The deployment itself was correct throughout: the served build was
`.next-release-b` with all eleven modules, which is what the switch intended.

---

## Portfolio landing page finalization

PASS. One new harness:

```
qa/stage09e-landing.mjs                87 checks
```

`qa/stage09-render-safety.mjs` was rewritten in one section and still passes.

### What the new harness is actually guarding

Two things, and neither is visible in a screenshot.

**The truth boundary.** The homepage now publishes a demonstration in the place
a portfolio usually publishes client work, so the suite reads the whole rendered
body and asserts the absence of "case study", "client work", "selected client",
"commissioned", "production client" and "our client", plus the absence of the
case-study section and its verified mark in the DOM. It then asserts the
canonical disclosure is present, exact, and has client rects, because a
disclosure that is in the markup but not on the screen is not a disclosure.

The standing contact rules are checked against the raw HTML rather than the
visible text: no `mailto:`, no `tel:`, no email shape, no telephone shape, no
messenger or social host, no form control, no hire-me phrasing.

**One anchor.** Five navigation ids, each existing exactly once, `#work`
carrying the featured class, no `.nav-specimen` surviving anywhere, and the nav
link actually scrolling to within 160px of the section top. The anchor existing
and the link reaching it are different claims and both are made.

### The suite that had to be repointed

`qa/stage09-render-safety.mjs` asserted that the work section was not imported,
that `#work` was still a placeholder, and that its stylesheet was not loaded.
That described the page this stage replaced, so two of the three could only ever
fail or pass vacuously once the section existed.

They now assert the invariant that absence was standing in for: the case-study
section is neither imported nor rendered, its stylesheet is still not loaded,
and the featured section owns the anchor instead.

The old import check was a substring test for `SelectedWorkSection`, and
`page.tsx` carries a comment explaining which component owns `#work` and why it
is deliberately not that one. The test read the explanation as the violation it
was describing. Written as usage now: an import statement or a JSX element.

### The footer count

The rendered page contains six `<footer>` elements. Five are inside the demo
panels of earlier sections and pre-date this stage. Every footer assertion is
scoped to `.site-footer`, and there is exactly one of those.

### Measurement note

Group notes in the breadth band are bottom-aligned, not top-aligned. An ad-hoc
check that compared their `top` values reported a 21px mismatch at 768px, which
was the three-line note in System sitting one line higher than the two-line
notes beside it. The bottoms are flush, which is the intent. Recorded because
the same measurement will look like a regression again next time.

---

## Stage 09D1 - Orphan recovery

PASS. One new harness:

```
qa/stage09d1-orphan-recovery.mjs        47 checks
```

Deterministic: a pure function, no PM2, no sockets, no deployment.

### Why this one is mostly refusals

`deploy:safe` may now kill a process. The failure mode of getting that wrong is
not a failed deployment, it is taking down a different product that shares the
host. So one scenario authorises recovery and a dozen do not, each differing
from the authorised case in exactly one way: a Next server from another
directory, a node process that is not Next, a non-node process, an unreadable
command line, the PM2 daemon itself, a process that is not a PM2 descendant, a
host where the daemon cannot be identified, an empty port, an already-supervised
production, a supervision failure that is not an orphan, and a worker forked by
the managed process.

Two more assert that no verdict ever authorises without naming the pid it just
examined, and that bad input fails closed rather than open.

### The measurement that decided the design

Daemon ancestry reads like the strongest available proof of ownership. Run
against the real neighbouring application on this host it turns out to prove
nothing:

```
ours    11216 < 2432 < 6728
theirs  15004 < 2432 < 6728
```

One PM2 daemon, 2432, manages both products. The two processes are both
`node.exe`, both Next servers, both PM2 children. What separates them is whose
repository the command line names, and the check refuses the neighbour three
times over with no reason mentioning ancestry.

That case is in the suite with the real pids, because the obvious simplification
of this feature is "is it a PM2 child", and that simplification would kill the
neighbour.

### Verified on the first live run

The recovery ran at preflight against the real orphan, and the deployment then
completed normally:

```
before deployment  pm2 errored, slot .next-release-a, pid 0, listener 11216
recovery           proved pid 11216 is ours, stopped it, port released
after recovery     pm2 online, slot .next-release-a, pid 16056 = listener
supervision        pm2 online, slot .next-release-b, pid 15548 = listener
```

Verified independently afterwards rather than read from the script's summary:
exactly one listener on 3100, PM2 online holding that same pid, slot
`.next-release-b`, suspicious environment names empty, all thirteen public
routes 200, the three QA routes 404, the http redirect 308, the neighbouring
domain 200, and both neighbouring PM2 processes still at zero restarts, which is
what proves they were never touched.
