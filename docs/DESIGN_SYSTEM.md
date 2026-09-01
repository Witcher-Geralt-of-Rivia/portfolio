<!-- PROJECT_STAGE: 7 -->
<!-- DOCUMENT_STATUS: CURRENT -->

# Milky Intelligence Design System

Canonical design language. Numeric values live in `src/styles/tokens.css`; this
document explains the intent so future work stays coherent. Where the two
disagree, the stylesheet is the truth and this document is stale - report it.

## Design Philosophy

The site should read as an advanced engineering laboratory crossed with a
premium SaaS product: quiet, precise, airy, technical, unmistakably considered.

Restraint is the through-line. Colour is soft and continuous rather than
saturated. Motion is slow enough to be felt rather than watched. Hierarchy comes
from scale, spacing, measure and colour before it comes from weight. Nothing
shouts.

The atmosphere is generated, never photographed. Every visual in the project is
CSS or SVG authored in this repository.

## Palette

Backgrounds are near-white but never white:

```
--background-base  #f7f7fb      --background-warm  #faf7f4
--background-cool  #f5f8fb
```

Seven milky aurora hues, all low-saturation and high-lightness:

```
lavender #e9e0ff   sky   #dceeff   aqua  #d9f4f3   mint #ddf5e8
rose     #f9dfeb   peach #fbe4d7   lemon #f8efc9
```

Do not increase their saturation. The palette's ceiling is roughly 19 units of
chroma once composited; pushing past that breaks the identity.

## Background Atmosphere

Four fixed layers, each mounted separately and painted behind all content:
a stationary base gradient, six drifting aurora fields, two prism light sweeps,
and a micro-grain dither.

Principles:

- The background is always in gentle motion, and the motion is asynchronous.
  Cycle lengths share no common factor so the composition never repeats.
- Blur is declared once and never animated. Only `transform` and `opacity` move.
- The grain exists to dither the gradients so they never band. It must never be
  visible as texture.
- Under `prefers-reduced-motion` the colour composition stays complete and only
  movement stops. The page must never fall back to plain white.
- On small screens the fields restack following the hue wheel, because stacking
  complementary hues in a narrow column cancels them into grey.

## Surface Types

Three surfaces, and only three:

| Surface | Use | Character |
|---|---|---|
| Milk | major content | poured milk over colour; the workhorse |
| Frost | floating UI, navigation, controls | thinner, colder, heavier backdrop blur |
| Prism | showcase moments, sparingly | refracted edge, never a rainbow border |

Do not invent a fourth glass system. Navigation reuses Frost at a slightly
higher alpha rather than introducing its own material.

## Typography

Geist Sans for everything editorial and interface. Geist Mono strictly as a
signal for machine-facing text: identifiers, statuses, routes, measurements,
code, eyebrows. Mono is never used for a paragraph and never as decoration.

Both families are self-hosted variable WOFF2. No third-party font request is
permitted.

Weight range is deliberately narrow: 400, 450, 500, 520, 560, 620. There is no
700+ tier. Emphasis resolves to 620, not 800.

Measure is a first-class token. Prose is capped in characters, so a wide display
makes a column no harder to read.

## Text Roles

```
--text-primary     #191b24   headings, important body, important UI
--text-secondary   #515666   supporting paragraphs, lead copy
--text-annotation  #595e6c   captions, technical labels, readable metadata
--text-muted       #7c8190   decorative only - NOT meaningful text
```

`--text-muted` sits near 3.2:1 on the live background. It is below AA and is
reserved for decorative indexes and ghosted annotation. Any caption, control
label or technical label that carries meaning uses `--text-annotation`.

## Border System

```
subtle      1px solid rgba(74, 80, 104, 0.08)
glass edge  1px solid rgba(255, 255, 255, 0.68)
technical   1px solid rgba(74, 80, 104, 0.10)
line-subtle rgba(61, 68, 88, 0.10)
```

No strong grey outlines anywhere.

## Shadow System

```
large card   0 24px 70px rgba(41, 47, 70, 0.08)
card         0 12px 36px rgba(41, 47, 70, 0.055)
floating     0 8px 24px rgba(41, 47, 70, 0.07)
inner light  inset 0 1px 0 rgba(255, 255, 255, 0.72)
```

Diffuse and cool. No dark drop shadows, no halos.

## Radius System

One consistent family: 10px controls, 12-14px buttons, 16px small cards,
20px cards, 24px feature cards, 28-32px large panels. Radii are never assigned
at random. The desktop navigation uses 20px deliberately - architectural rather
than a fully rounded pill.

## Motion Principles

- Animate `transform`, `opacity`, `offset-distance` and `stroke-dashoffset`.
  Never animate blur, box-shadow, width, height, top or left.
- Ambient motion is continuous, slow, and asynchronous. Nothing pulses.
- Entrances are under a second, travel at most 8px, and never animate letters.
- No JavaScript animation loop. No `requestAnimationFrame`, no `setInterval`,
  no pointer tracking.
- `prefers-reduced-motion: reduce` stops movement everywhere while keeping the
  composition visually complete.

## Navigation Language

A precision instrument floating above the aurora, not a panel resting on it.
Frost surface, 20px radius, quiet type, and a single restrained accent: the
active link carries a 20px aurora-gradient dash. That dash is one of the only
places the navigation quotes the palette directly.

Below 900px the bar becomes a compact top bar plus a floating panel. The panel
is the surface; items are not cards.

## Hero Language

Text left, artwork right, both embedded in the page atmosphere. The hero has no
background of its own - no white rectangle, no card, no dark panel.

The Intelligence Constellation is the identity artwork: a system topology of
eight capability nodes around an orchestrator. It must read as a network, not as
a sphere, an orb, a brain or an atom. Signals travel slowly and sparsely; at most
five packets exist at once.

## Product Surface Language

Product surfaces are authored, never borrowed. The web frame is our own
application window: three pastel dots, a route field and a `DEMO DATA` label —
no address bar, no back/forward, no vendor chrome, no facsimile of any real
browser. The phone is a neutral container with a sensor capsule: no camera, no
notch clone, no manufacturer detail, no hardware branding.

Screens are rendered products, not decoration, so they use the same tokens as
the rest of the site. Status carries on pastel pills, never on saturated
semantic red/green. Data reads as demonstration data because it is labelled
that way, not because it is obviously fake.

The AI surface is a panel, not a chat window. Context, a one-line brief and a
next action. No input field, no transcript, no provider name, no model. It is
badged `LOCAL SIMULATION` on the surface itself, not only in a caption.

When a scenario changes, frames stay where they are and only their contents
transform. A surface that jumped position or resized on every switch would read
as a page reload rather than one product with several faces.

## Learning Surface Language

Stage 07 is the cognitive end of the palette. Mint, aqua and sky lead; lavender,
peach and rose appear only as state accents. The register is calm and
human-centred without becoming soft: this is education technology, so there are
no graduation caps, no books, no pencils, no classroom illustration and no
cartoon anything.

Knowledge state is never carried by colour alone. Each of mastered, learning,
gap and locked has a distinct ring pattern and core mark as well as a hue, and
the legend names all four in text. A gap is an open dashed ring, never a red
error marker - a gap is where the learner is going next, not a fault.

The knowledge map reads as knowledge rather than circuitry: connections are
soft curves bowed away from the canvas centre, and the graph stays sparser than
the hero constellation. At most two signals travel it at a time.

Simulated learner data is labelled once, at the lab header, and not repeated on
every panel. One honest annotation is enough to stop a visitor reading
synthetic mastery figures as real assessment.

## Responsive Principles

- Validate at 1920x1080, 1440x900, 1366x768, 1024x768, 768x1024, 430x932,
  390x844 and 360x800.
- Zero horizontal overflow at every width. Diagnose the offending element rather
  than masking it with `body { overflow-x: hidden }`.
- Mobile stays colourful. What shrinks is blur cost, travel distance and the
  number of competing elements - never the palette.
- Text sizes are tuned per breakpoint rather than allowed to scale away. Nothing
  meaningful drops below 13px except decorative artwork metadata.

## Accessibility Principles

- Meaningful text meets WCAG AA 4.5:1; large text meets 3:1. Measure against the
  actual moving background at several aurora positions, not against the base
  colour.
- Every interactive control has a visible focus ring: 2px solid
  `rgba(81,86,102,0.48)` at 2px offset, plus a soft lavender halo. Never the
  browser default blue.
- Touch targets are at least 40x40.
- Decorative SVG is `aria-hidden`; anything meaningful it conveys is duplicated
  in real text.
- Only one navigation presentation is in the accessibility tree at a time.

## Anti-Patterns

This list exists because these are the failure modes a fresh session is most
likely to drift into. None of them belong in this project.

**Atmosphere and colour**

- Plain white background, or a background that reads as white
- Dark developer / cyberpunk theme
- Neon anything
- One big purple glow, or a generic purple gradient hero
- Excessive glassmorphism, or a fourth glass material
- Heavy drop shadows and glow halos
- Rainbow borders

**Layout and composition**

- Generic SaaS template hero
- Bootstrap-style navbar, or an opaque white navigation rectangle
- Random colourful cards scattered as decoration
- A network diagram pasted next to text rather than composed with it
- A hero on its own solid panel

**Artwork**

- Stock developer illustration
- Personal avatar, headshot or illustrated portrait
- AI robot art, brain icons, sparkles, chatbot bubbles
- Any third-party company logo, including OpenAI and Anthropic marks
- Eight nodes in a perfect circle, or a wireframe orb
- Heavy 3D

**Motion**

- Typewriter or scramble hero animation
- Per-character entrance animation
- Particle storms
- Cursor trails, mouse-follow spotlights, magnetic hover
- Excessive parallax, or parallax driven by cursor coordinates
- Anything that pulses, strobes or spins

**Engineering**

- WebGL, Canvas or Three.js for decorative visuals
- An animation library added for one effect
- JavaScript that recalculates font sizes or layout on resize
- Continuous `requestAnimationFrame` work while the page is idle
- Client components introduced where CSS would do

## Design Failure Test

Before declaring visual work complete, ask:

1. Does this still read as Milky Intelligence, or has it drifted toward a
   generic template?
2. If the word "AI" were removed from every string, would the visual still
   communicate advanced systems engineering? It must.
3. Is any hierarchy being carried by weight that should be carried by scale,
   spacing, measure or colour?
4. Does anything move faster or brighter than the background atmosphere?
5. Would a client mistake any element for stock or third-party artwork?
