import Link from "next/link";

import {
  DEMO_DISCLOSURE_PRIMARY,
  DEMO_DISCLOSURE_SECONDARY,
  findDemo,
} from "@/demo-runtime/demo-registry";
import { certificationsArePublishable } from "@/content/certifications";

import OperationsScreenSequence from "./OperationsScreenSequence";
import { SCREEN_COUNT } from "./operations-screens";

/**
 * 05 / FEATURED ENGINEERING BUILD
 *
 * The page's climax, and now a photograph of the product rather than a drawing
 * of it.
 *
 * WHAT CHANGED AND WHY
 *
 * This section used to carry a composed preview: a hand-built rail, four state
 * cards, a flow strip, all drawn from the demo's canonical figures. It was
 * accurate and it was still wrong, because it did not look like the application
 * it was advertising. A visitor who followed the link found a different-looking
 * interface and no way to tell which of the two was real.
 *
 * So the section shows eleven screenshots of the real verified application, at
 * its real routes, in the product's own order, captured by a written-down
 * procedure rather than by hand. The scroll sequence walks them.
 *
 * WHAT WAS REMOVED, AND WHY THAT IS THE POINT
 *
 * Everything that used to sit below the preview is gone: the breadth band
 * naming eleven modules in three groups, the four counted facts, the four
 * descriptive notes. Every one of them described what the screenshots now show.
 * A visitor who has just watched eleven real pages of an application does not
 * need to be told it has eleven modules, and a long explanatory band after the
 * visual climax is an anticlimax with extra reading.
 *
 * What remains is what the screens cannot say themselves: whose product it is,
 * that it is a demonstration running on synthetic data, and how to open it.
 *
 * It is still deliberately not `SelectedWorkSection`. That component publishes
 * real client work and stays behind `MINIMUM_PUBLIC_CASES`; this publishes a
 * demonstration and says so above the frame (D-098).
 */

export default function FeaturedDemoSection() {
  /* The route comes from the registry rather than a literal, so a demo the
     registry does not mark verified cannot be linked from here by editing a
     href. */
  const demo = findDemo("operations");
  const href = demo?.route ?? "/demos/operations";

  /* Certifications sits between the Lab and this section and renders only when
     a real credential exists. Today it does not, so this is 05; when the first
     one arrives this becomes 06 on its own rather than leaving the page with
     two sections numbered the same. */
  const index = certificationsArePublishable() ? "06" : "05";

  return (
    <section id="work" className="featured" aria-labelledby="featured-title">
      <div className="featured__intro">
        <p className="eyebrow">{index} / FEATURED ENGINEERING BUILD</p>
        <h2 id="featured-title" className="featured__title">
          Rental Operations Platform
        </h2>

        <p className="featured__disclosure">
          <span className="featured__disclosure-primary">{DEMO_DISCLOSURE_PRIMARY}</span>
          <span className="featured__disclosure-secondary">{DEMO_DISCLOSURE_SECONDARY}</span>
        </p>

        <p className="featured__lead">
          {SCREEN_COUNT} connected modules, running entirely in the browser.
          Every screen below is the application itself.
        </p>
      </div>

      <OperationsScreenSequence />

      <div className="featured__close">
        {/* "demonstration", not "system". The disclosure above the frame
            already says what this is, and the action a visitor clicks should
            not be the one place on the page that sounds like a live product. */}
        <Link className="featured__cta" href={href}>
          Explore the demonstration
          <span className="featured__cta-arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
      </div>
    </section>
  );
}
