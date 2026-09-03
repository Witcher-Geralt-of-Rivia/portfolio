import Hero from "@/components/hero/Hero";
import IntelligentSystemsSection from "@/components/systems/IntelligentSystemsSection";
import ProductEngineeringSection from "@/components/products/ProductEngineeringSection";
import AILearningSection from "@/components/learning/AILearningSection";
import EngineeringLabSection from "@/components/lab/EngineeringLabSection";
import FeaturedDemoSection from "@/components/work/FeaturedDemoSection";
import SiteFooter from "@/components/layout/SiteFooter";

import "./page.css";

/**
 * The homepage, and now a finished one.
 *
 * Five sections and an ending. The first four demonstrate a capability each;
 * the fifth is one finished system the visitor can open, which is why it sits
 * last and is built heavier than the others.
 *
 * The navigation-specimen placeholders are gone. They existed from Stage 03 so
 * the navigation had somewhere to scroll to while the real sections were being
 * built, and the last of them, `#work`, is replaced here. `.nav-specimen` in
 * page.css goes with them.
 *
 * `FeaturedDemoSection` owns `id="work"`, and it is deliberately not
 * `SelectedWorkSection`: that component publishes real client work and refuses
 * to render until its own invariant is met. Nothing here changes that gate.
 */

export default function Home() {
  return (
    <>
      <div className="content-frame">
        <Hero />

        <IntelligentSystemsSection />

        <ProductEngineeringSection />

        <AILearningSection />

        <EngineeringLabSection />

        <FeaturedDemoSection />
      </div>

      <SiteFooter />
    </>
  );
}
