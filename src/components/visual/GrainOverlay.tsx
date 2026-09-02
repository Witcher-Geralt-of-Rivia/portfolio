/**
 * GrainOverlay: background layer D.
 *
 * A 256px monochrome noise tile, generated locally as SVG turbulence and
 * repeated across the viewport. It exists to dither the aurora gradients
 * so they never read as digitally flat.
 *
 * It sits above the colour layers and below page content, so it textures
 * the gradients without touching the crispness of type. Intensity is held
 * at --grain-opacity (0.018); the effect is meant to be felt, not seen.
 */

export default function GrainOverlay() {
  return <div className="grain" aria-hidden="true" />;
}
