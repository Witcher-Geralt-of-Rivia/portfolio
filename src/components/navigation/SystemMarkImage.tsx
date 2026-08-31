/**
 * The system mark, served from its canonical file at
 * /public/marks/system-mark.svg.
 *
 * The SVG is not duplicated into JSX: one asset, one source. It is
 * decorative here because the adjacent wordmark already names the site,
 * so it carries an empty alt rather than repeating that name.
 *
 * A plain <img> is deliberate. next/image optimises raster formats; for
 * an 890-byte vector it would add a wrapper and a loader path without
 * shrinking anything. Explicit width and height keep it shift-free.
 */

export default function SystemMarkImage() {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/marks/system-mark.svg"
      alt=""
      width={28}
      height={28}
      className="site-nav__mark"
      draggable={false}
    />
  );
}
