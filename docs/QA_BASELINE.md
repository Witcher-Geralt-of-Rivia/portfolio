<!-- PROJECT_STAGE: 6 -->
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
- **`document.getAnimations()` counts transitions.** A snapshot taken just
  after an interaction is full of 180-260ms colour transitions at
  `currentTime: 0`. To ask "does this section animate at rest", filter to
  `animationName` set, `iterations === Infinity`, and target within the
  section.

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

Dev server, 1440x900 unless stated. Harness: `qa/stage06-*.mjs`.

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

Keyboard: ArrowRight/ArrowLeft/Home/End all move selection and focus together
across the scenario tablist. Abandoning a run mid-flight by switching scenario
leaves no active stage, no passed stages, an empty live region and the button
back to `Run product flow`.

Surface stability across scenarios: the phone holds 367px at every viewport and
every frame keeps its position; only the web frame's height follows its content
(566-682px at desktop).

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
qa/shots/stage06/       Stage 06 baselines (6 PNG)
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
qa/stage06-shots.mjs        Stage 06 screenshot set
qa/project-memory-check.mjs canonical documentation consistency
```

Most scripts target `http://127.0.0.1:3000`. Stage 01 and Stage 02 scripts
target `/specimen`, where the surfaces and type roles live.

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
