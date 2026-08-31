import { CAPABILITIES } from "./product-scenarios";

/** Six engineering capabilities as a quiet rail. Numbers and titles only. */
export default function ProductCapabilityRail() {
  return (
    <ul className="products__rail">
      {CAPABILITIES.map((c) => (
        <li key={c.index} className="products__rail-item">
          <span className="products__rail-index">{c.index}</span>
          <span className="products__rail-title">{c.title}</span>
        </li>
      ))}
    </ul>
  );
}
