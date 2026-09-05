import Hero from "@/components/hero/Hero";
import IntelligentSystemsSection from "@/components/systems/IntelligentSystemsSection";
import ProductEngineeringSection from "@/components/products/ProductEngineeringSection";
import AILearningSection from "@/components/learning/AILearningSection";
import EngineeringLabSection from "@/components/lab/EngineeringLabSection";
import CertificationsSection from "@/components/certifications/CertificationsSection";
import FeaturedDemoSection from "@/components/work/FeaturedDemoSection";
import SiteFooter from "@/components/layout/SiteFooter";
import SceneLayer from "@/components/scene/SceneLayer";

import "./page.css";

/**
 * The homepage, as a sequence of scenes.
 *
 * Each major section is wrapped in a `SceneLayer`, which gives it an
 * atmosphere, a way in, and in two cases a colour field that answers the
 * pointer. Crossing a boundary should look like the page changing environment
 * rather than like a paragraph fading up; the entries are declared in
 * `src/lib/scenes.ts` so that no two neighbours arrive the same way, which is a
 * property worth being able to read in one place.
 *
 * The wrappers sit OUTSIDE the content frame rather than inside it, so a
 * scene's colour field can reach the edges of the viewport. Inside, the field
 * stopped at 1200px and drew a hard vertical seam down both sides of the page.
 * Each scene puts the frame back around its own content, so the text measure is
 * unchanged.
 *
 * They add no markup the sections care about. Every heading, landmark, link and
 * focus order below is what it was before any of this existed, and with
 * JavaScript off or reduced motion on the scene classes never appear and
 * nothing moves.
 *
 * `FeaturedDemoSection` owns `id="work"` and is deliberately not
 * `SelectedWorkSection`: that component publishes real client work and refuses
 * to render until its own gate is met. Nothing here changes that.
 *
 * `CertificationsSection` is mounted and renders nothing, which is the correct
 * output for a section whose collection is empty. It is mounted anyway, in the
 * position it will occupy, so that adding one verified record activates it with
 * no wiring.
 */

export default function Home() {
  return (
    <>
      <SceneLayer scene="hero">
        <div className="content-frame">
          <Hero />
        </div>
      </SceneLayer>

      <SceneLayer scene="systems">
        <div className="content-frame">
          <IntelligentSystemsSection />
        </div>
      </SceneLayer>

      <SceneLayer scene="products">
        <div className="content-frame">
          <ProductEngineeringSection />
        </div>
      </SceneLayer>

      <SceneLayer scene="learning">
        <div className="content-frame">
          <AILearningSection />
        </div>
      </SceneLayer>

      <SceneLayer scene="lab">
        <div className="content-frame">
          <EngineeringLabSection />
        </div>
      </SceneLayer>

      <div className="content-frame">
        <CertificationsSection />
      </div>

      <SceneLayer scene="work">
        <div className="content-frame">
          <FeaturedDemoSection />
        </div>
      </SceneLayer>

      <SiteFooter />
    </>
  );
}
