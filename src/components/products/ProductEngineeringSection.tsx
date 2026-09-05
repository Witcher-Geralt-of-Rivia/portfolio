import ProductCapabilityRail from "./ProductCapabilityRail";
import ProductStack from "./ProductStack";
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

      {/* The stack wraps rather than replaces: the studio, its tablist, its
          run control and all three surfaces are unchanged inside it. Below
          900px it does nothing at all. */}
      <ProductStack>
        <div className="products__studio">
          {/* The spectral edge, on the studio because it is this section's
              focal surface. The studio paints its own milk surface, so the
              wrapper's inner is bare here and only carries the clip. */}
          <div className="spectral spectral--lg">
            <div className="spectral__inner spectral__inner--bare">
              <ProductStudio />
            </div>
          </div>
          <p className="products__micro">LOCAL / DETERMINISTIC</p>
        </div>
      </ProductStack>

      <ProductCapabilityRail />
    </section>
  );
}
