/**
 * PrismLight: background layer C.
 *
 * Two broad diagonal light sweeps crossing the composition on long,
 * mismatched cycles (58s and 68s). Their job is to make surfaces read as
 * illuminated rather than merely tinted; at full attention the effect
 * should be almost impossible to point at.
 *
 * Peak opacity is capped by --prism-opacity-a / --prism-opacity-b, both
 * held well below the 0.25 ceiling.
 */

export default function PrismLight() {
  return (
    <div className="prism" aria-hidden="true">
      <div className="prism__beam prism__beam--a" />
      <div className="prism__beam prism__beam--b" />
    </div>
  );
}
