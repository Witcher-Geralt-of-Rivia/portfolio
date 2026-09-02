import ProductCapabilityRail from "./ProductCapabilityRail";
import ProductStudio from "./ProductStudio";

/**
 * 02 / PRODUCT ENGINEERING
 *
 * Where Stage 04 showed a conceptual system and Stage 05 showed its
 * architecture, this section shows the product surfaces themselves: one
 * product operating across web, mobile, an assistive panel and a backend
 * event pipeline.
 *
 * Server-rendered apart from the studio, which is the only interactive part.
 */
export default function ProductEngineeringSection() {
  return (
    <section id="products" className="products" aria-labelledby="products-title">
      <div className="products__intro">
        <div className="products__intro-lead">
          <p className="eyebrow">02 / PRODUCT ENGINEERING</p>
          <h2 id="products-title" className="products__title">
            One product. Every surface.
          </h2>
        </div>

        <div className="products__intro-support">
          <p className="products__lead">
            Web applications, mobile experiences and AI-assisted workflows
            designed as one product system, from interface state and APIs to
            data, background execution and synchronized user experiences.
          </p>
          <p className="products__capabilities">
            WEB / MOBILE / AI ASSIST / REALTIME / API / BACKEND
          </p>
        </div>
      </div>

      <div className="products__studio">
        <ProductStudio />
        <p className="products__micro">LOCAL / DETERMINISTIC</p>
      </div>

      <ProductCapabilityRail />
    </section>
  );
}
