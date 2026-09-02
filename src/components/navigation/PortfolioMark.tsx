/**
 * The portfolio mark.
 *
 * Renders the approved logo from `/brand/mark-120.png`, derived from the master
 * artwork at the repository root by `qa/brand-derive.mjs`. The master is never
 * modified and never served.
 *
 * It replaces the Stage 03 four-node SVG mark. The name changed with it: the
 * old component was `SystemMarkImage`, and keeping that name would have
 * described artwork the project no longer uses.
 *
 * Uses the tight derivative rather than the square one. The master centres a
 * 965x1119 mark in a 1254 square, so 11.5% of each side is empty; in a 28px
 * box that left the mark 21px wide and reading small beside 12px type. The
 * tight asset removes that padding while keeping the mark's own aspect and a
 * 5% safety margin around the soft outer glow, so nothing is cropped.
 *
 * 30px tall rather than 28 square, which the trim earns without enlarging the
 * bar: the visible mark goes from 25px to 30px. Explicit width and height keep
 * it shift-free, and the source has real transparency, so no plate is drawn
 * behind it on any background it sits on.
 *
 * A plain <img> is deliberate, as it was before: `next/image` would add a
 * wrapper and a loader path for a 12 KB asset that is already the right size.
 *
 * Decorative: the adjacent wordmark names the site, so an empty alt avoids
 * announcing it twice.
 */

/** The tight asset's aspect, 1077x1231. */
const MARK_ASPECT = 105 / 120;

export default function PortfolioMark({ height = 30 }: { height?: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/brand/mark-120.png"
      alt=""
      width={Math.round(height * MARK_ASPECT)}
      height={height}
      className="site-nav__mark"
      draggable={false}
    />
  );
}
