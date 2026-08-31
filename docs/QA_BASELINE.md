<!-- PROJECT_STAGE: 4 -->
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

**Mitigation:** force a frame with a throwaway
`page.screenshot({ type: "jpeg", quality: 20 })` before measuring, and launch
with `--disable-backgrounding-occluded-windows`,
`--disable-renderer-backgrounding`, `--disable-background-timer-throttling`.
Several apparent bugs during Stages 03 and 04 were this artefact, not the app.

## Artefact Locations

```
qa/shots/               Stage 01 baselines (10 PNG)
qa/shots/stage02/       Stage 02 baselines (12 PNG)
qa/shots/stage03/       Stage 03 baselines (15 PNG)
qa/shots/stage04/       Stage 04 baselines (14 PNG)
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
