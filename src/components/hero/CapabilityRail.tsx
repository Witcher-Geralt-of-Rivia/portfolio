/**
 * A compact proof rail beneath the hero actions. Quiet technical metadata,
 * not a card grid. The panel-free treatment is deliberate.
 */

const CAPABILITIES = [
  { index: "01", label: "Intelligent Systems" },
  { index: "02", label: "Product Engineering" },
  { index: "03", label: "AI Learning Systems" },
];

export default function CapabilityRail() {
  return (
    <ul className="hero__rail">
      {CAPABILITIES.map((item) => (
        <li key={item.index} className="hero__rail-item">
          <span className="hero__rail-index">{item.index}</span>
          <span className="hero__rail-label">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
