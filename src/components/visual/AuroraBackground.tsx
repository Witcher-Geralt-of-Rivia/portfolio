/**
 * AuroraBackground: background layers A and B.
 *
 * Layer A is the stationary base surface. Layer B is six large fields of
 * diffused colour, each with its own irregular silhouette, its own blur,
 * and its own drift cycle. The cycle lengths (31/37/43/35/47/41s) share no
 * common factor, so the six never fall back into the same arrangement.
 *
 * All geometry, colour and timing live in CSS custom properties on the
 * field classes. See src/styles/layers.css and src/styles/motion.css.
 * This component only declares the structure.
 *
 * Renders on the server. No client JavaScript is involved in the motion.
 */

const AURORA_FIELDS = [1, 2, 3, 4, 5, 6] as const;

export default function AuroraBackground() {
  return (
    <>
      {/* Layer A: base surface */}
      <div className="backdrop-base" aria-hidden="true" />

      {/* Layer B: aurora colour fields */}
      <div className="aurora" aria-hidden="true">
        {AURORA_FIELDS.map((index) => (
          <div
            key={index}
            className={`aurora__field aurora__field--${index}`}
          />
        ))}
      </div>
    </>
  );
}
