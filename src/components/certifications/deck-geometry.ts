/**
 * The certification deck's arithmetic, and nothing else.
 *
 * No React, no DOM, no measurement. Every function here is pure, so the
 * choreography can be reasoned about and tested without a browser, and the
 * scroll controller is left with one job: feed it a number and write the
 * results to CSS custom properties.
 *
 * That split is the point. A scroll animation that computes its own geometry
 * inline is a thing you can only debug by scrolling, and only on the viewport
 * you happen to have. `qa/stage09f-certifications.mjs` exercises all of this at
 * every card count and every breakpoint in a few milliseconds.
 */

/**
 * How many resolved cards fit side by side.
 *
 * Derived from measured width rather than from a viewport breakpoint table, and
 * that is a correction rather than a preference. The first version of this
 * declared capacity 5 at 1200px and above, which read sensibly and was wrong:
 * the content frame is 1200px, a card is 306px and the gap is 20px, so five
 * cards need 1610px. The last two were rendered off the right edge of the clip,
 * invisible and still focusable, on the widest viewport tested.
 *
 * Measuring removes the whole class of error. The card width and the gap are
 * both design tokens that change at breakpoints, the frame width changes with
 * the gutter, and none of that has to be restated here or kept in sync.
 *
 * `count` is not an input on purpose: capacity is a property of the space, not
 * of the collection. What happens when there are more cards than fit is the
 * rail's job.
 */
export function deckCapacity(availableWidth: number, cardWidth: number, gap: number): number {
  const avail = Number.isFinite(availableWidth) ? Math.max(0, availableWidth) : 0;
  const card = Number.isFinite(cardWidth) && cardWidth > 0 ? cardWidth : 1;
  const g = Number.isFinite(gap) ? Math.max(0, gap) : 0;
  /* n cards occupy n*card + (n-1)*gap, so the fit is (avail + gap) / (card + gap). */
  return Math.max(1, Math.floor((avail + g) / (card + g)));
}

export const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : Number.isFinite(n) ? n : 0);

/**
 * How much of the section's progress one card's reveal occupies.
 *
 * Wide enough that neighbouring reveals overlap: with five cards the gap
 * between thresholds is 0.165 and this is 0.34, so a card is still settling
 * while the next two have begun. Narrow it and the deck snaps card by card,
 * which is the thing this window exists to prevent.
 */
export const REVEAL_WINDOW = 0.34;

/**
 * Where card `index` begins to resolve, on a 0..1 section progress.
 *
 * The specification gives the shape as `i / max(N - 1, 1)`, which puts the
 * first card's threshold at 0. Paired with a reveal window that ends at the
 * threshold, that would mean card 01 is already fully resolved the instant the
 * section pins, and there would be no deck to unfold: the brief also asks for a
 * compact layered deck at section entry, and the two cannot both hold.
 *
 * So the window runs forward from the threshold rather than backward into it,
 * and the thresholds are compressed into `1 - REVEAL_WINDOW` so the last card
 * finishes exactly as the section releases. Card 01 starts resolving at p=0 and
 * is done a third of the way in, which is what "card 01 resolves first" means
 * when there is a deck to resolve out of.
 */
export function revealThreshold(index: number, count: number): number {
  if (count <= 1) return 0;
  const span = 1 - REVEAL_WINDOW;
  return (span * index) / (count - 1);
}

/** A single card's own 0..1 progress, given the section's. */
export function cardProgress(sectionProgress: number, index: number, count: number): number {
  const t = revealThreshold(index, count);
  return clamp01((clamp01(sectionProgress) - t) / REVEAL_WINDOW);
}

/**
 * The card the visitor is currently on: the last one at least half resolved.
 *
 * Used for the `NN / NN` counter, for `aria-current`, and for the rail shift.
 * Deriving it rather than storing it means it cannot disagree with what is on
 * screen, and because it is an integer it changes rarely, which is what makes
 * it safe to put in React state when the raw progress is not.
 */
export function activeIndex(sectionProgress: number, count: number): number {
  if (count <= 0) return 0;
  let active = 0;
  for (let i = 0; i < count; i++) {
    if (cardProgress(sectionProgress, i, count) >= 0.5) active = i;
  }
  return active;
}

/**
 * How far the rail slides, measured in whole card slots.
 *
 * This is the answer to both "more credentials than fit on a desktop" and "a
 * phone shows one at a time": they are the same problem at different
 * capacities. At capacity 1 the rail advances a slot per card, which is the
 * single-card progression the brief asks for on a phone; at capacity 5 with
 * five cards it never moves at all.
 *
 * A future collection large enough to want discrete pages rather than a sliding
 * window would change this function and nothing else.
 */
/**
 * How far the rail has slid, in card slots, as a CONTINUOUS value.
 *
 * Defined as the position of the frontmost card: how far the deck has unfolded.
 * `cardProgress(i) * i` is card i's own position in rail coordinates, so the
 * largest of them is the leading edge, and the rail follows it.
 *
 * Two earlier definitions were wrong in instructive ways.
 *
 * The first used `activeIndex`, an integer that flips at a threshold, while the
 * cards it was carrying moved smoothly. The rail jumped a whole slot while the
 * card it was following was two thirds of the way there, and on a 390px phone
 * that put the active credential two hundred pixels off the left edge.
 *
 * The second summed every card's progress. That reads like "how many have
 * resolved" but over-runs, because the reveal windows deliberately overlap:
 * cards further back contribute their partial progress to the total, so the
 * rail led the card it was meant to be following by up to 0.44 of a slot,
 * cutting nearly half the active card off a phone screen.
 *
 * Taking the maximum instead of the sum is the fix, and it is continuous and
 * monotonic for the same reason each term is: a max of non-decreasing
 * continuous functions is one.
 */
export function railShiftContinuous(
  sectionProgress: number,
  count: number,
  capacity: number
): number {
  const cap = Math.max(1, Math.floor(capacity));
  if (count <= cap) return 0;
  let front = 0;
  for (let i = 0; i < count; i++) {
    const at = cardProgress(sectionProgress, i, count) * i;
    if (at > front) front = at;
  }
  const maxShift = count - cap;
  return Math.min(maxShift, Math.max(0, front - (cap - 1)));
}

/** The whole-slot form, for deciding which cards are in the tab order. */
export function railShiftFor(active: number, count: number, capacity: number): number {
  const cap = Math.max(1, Math.floor(capacity));
  if (count <= cap) return 0;
  const maxShift = count - cap;
  const wanted = Math.floor(active) - (cap - 1);
  return Math.min(maxShift, Math.max(0, wanted));
}

export function railShift(sectionProgress: number, count: number, capacity: number): number {
  return railShiftFor(activeIndex(sectionProgress, count), count, capacity);
}

/**
 * Which cards are actually on screen, given the rail's position.
 *
 * Everything outside this window is translated out of the deck's clip and is
 * invisible, but it is still in the document. A `<button>` nobody can see is
 * still in the tab order, and tabbing to one inside an `overflow: hidden`
 * container makes the browser try to scroll it into view, which fights the
 * transform that put it there. So the cards outside the window are marked
 * inert, and this is the function that decides which those are.
 *
 * It matters most at capacity 1: a phone showing five credentials one at a time
 * has four off-screen cards at any moment, each with a link and a button in it.
 */
/**
 * Where a card actually sits on screen, in slot widths from the window's left
 * edge. 0 is the leading slot; `capacity - 1` is the trailing one.
 *
 * A card's position in rail coordinates blends its deck origin with its slot,
 * and the deck origin follows the rail, so an unresolved card sits at the
 * window rather than back at the rail's zero. Subtracting the rail's own
 * translation leaves the screen position:
 *
 *   rail coords  = cp * index + (1 - cp) * shift
 *   on screen    = that - shift = cp * (index - shift)
 *
 * Which says the useful thing plainly: an unresolved card (cp 0) is at the
 * window whatever the rail is doing, and a resolved card is as far from the
 * window as its index is from the rail.
 */
export function cardScreenSlot(
  sectionProgress: number,
  index: number,
  count: number,
  shift: number
): number {
  return cardProgress(sectionProgress, index, count) * (index - shift);
}

/**
 * Whether a card is on screen, and therefore whether it belongs in the tab
 * order.
 *
 * Judged from the rendered position rather than from an index window, because
 * an index window and a continuously sliding rail disagree exactly where it
 * matters: on the card that is half in. Slightly generous at both ends so a
 * card one pixel outside is not yanked out of the accessibility tree.
 */
export function isCardVisible(screenSlot: number, capacity: number): boolean {
  const cap = Math.max(1, Math.floor(capacity));
  return screenSlot > -0.9 && screenSlot < cap - 1 + 0.9;
}

/**
 * Depth in the unresolved stack, for the cards still waiting.
 *
 * Clamped so a deck of twenty does not offset the last card off the composition
 * entirely: past this many, cards sit on the same visual step.
 */
export const MAX_STACK_DEPTH = 4;

export function stackDepth(index: number, activeAt: number): number {
  return Math.min(MAX_STACK_DEPTH, Math.max(0, index - activeAt));
}

/* --- The scroll range ----------------------------------------------------- */

/** Viewport heights of travel each card is given. */
export const TRAVEL_PER_CARD = 0.62;
/** Enough travel to read the section even with a single credential. */
export const MIN_TRAVEL = 0.85;
/**
 * The ceiling, and the reason there is one: travel that grows without bound
 * turns a section into a tunnel. Past roughly five cards the deck slides
 * instead of getting longer.
 */
export const MAX_TRAVEL = 3.1;

/** Pixels of scroll the sticky stage stays pinned for. */
export function scrollTravel(count: number, viewportHeight: number): number {
  const vh = Math.max(1, Math.floor(viewportHeight));
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return 0;
  const raw = n * TRAVEL_PER_CARD;
  const bounded = Math.min(MAX_TRAVEL, Math.max(MIN_TRAVEL, raw));
  return Math.round(bounded * vh);
}

/**
 * The outer range's height: the pinned stage, its sticky offset, and the travel.
 *
 * `stageHeight` is measured, not assumed, because the stage is as tall as its
 * own content and that changes with the viewport, the font and the card count.
 *
 * `stickyTop` is in here because leaving it out was a real defect rather than a
 * rounding error. The stage is pinned at `top: var(--nav-scroll-margin)` so the
 * floating navigation does not sit on the heading, and a sticky box with a top
 * offset unpins that many pixels EARLIER than one pinned at zero. With the
 * offset missing from both the range and the progress denominator, the last
 * cards were still at 0.86 and 0.38 when the section released: the deck simply
 * never finished, and it never finished by exactly the height of the offset.
 */
export function scrollRangeHeight(
  count: number,
  viewportHeight: number,
  stageHeight: number,
  stickyTop = 0
): number {
  const stage = Math.max(0, Math.floor(stageHeight));
  const offset = Math.max(0, Math.floor(stickyTop));
  return stage + offset + scrollTravel(count, viewportHeight);
}

/**
 * Section progress from one scroll position and one cached measurement.
 *
 * Deliberately takes numbers rather than elements: the caller measures once, on
 * resize, and this runs per frame against the cached values. Reading layout
 * here would put a forced reflow inside the scroll path, which is the standard
 * way these sections come to cost more than they are worth.
 */
export function sectionProgress(
  scrollY: number,
  rangeTop: number,
  rangeHeight: number,
  stageHeight: number,
  stickyTop = 0
): number {
  const offset = Math.max(0, stickyTop);
  /* The stage pins when its top edge reaches `offset`, which is `offset` pixels
     of scrolling before the range's own top passes the viewport top. Both ends
     of the fraction have to agree about that or the choreography runs out of
     travel before it runs out of cards. */
  const travel = rangeHeight - stageHeight - offset;
  if (travel <= 0) return 0;
  return clamp01((scrollY + offset - rangeTop) / travel);
}
