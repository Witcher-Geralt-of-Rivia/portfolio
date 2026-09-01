/**
 * The portfolio mark.
 *
 * Renders the approved logo from `/brand/logo-96.png`, derived from the master
 * artwork at the repository root by `qa/brand-derive.mjs`. The master is never
 * modified and never served.
 *
 * It replaces the Stage 03 four-node SVG mark. The name changed with it: the
 * old component was `SystemMarkImage`, and keeping that name would have
 * described artwork the project no longer uses.
 *
 * Displayed at 28px — the geometry the navigation was built around — from a
 * 96px source, so it stays sharp past 3x. Explicit width and height keep it
 * shift-free, and the source has real transparency, so no plate is drawn
 * behind it on any of the backgrounds it sits on.
 *
 * A plain <img> is deliberate, as it was before: `next/image` would add a
 * wrapper and a loader path for a 12 KB asset that is already the right size.
 *
 * Decorative — the adjacent wordmark names the site, so an empty alt avoids
 * announcing it twice.
 */

export default function PortfolioMark({ size = 28 }: { size?: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/brand/logo-96.png"
      alt=""
      width={size}
      height={size}
      className="site-nav__mark"
      draggable={false}
    />
  );
}
