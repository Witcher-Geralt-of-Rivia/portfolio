import Hero from "@/components/hero/Hero";
import IntelligentSystemsSection from "@/components/systems/IntelligentSystemsSection";
import ProductEngineeringSection from "@/components/products/ProductEngineeringSection";
import AILearningSection from "@/components/learning/AILearningSection";
import EngineeringLabSection from "@/components/lab/EngineeringLabSection";
import { NAV_ITEMS } from "@/components/navigation/nav-items";

import "./page.css";

/* The homepage: the Stage 04 hero, then the built capability sections, then
   the remaining navigation anchor zones. Those remaining zones are still
   Stage 03 QA placeholders and are replaced one per stage. */

const BUILT = new Set(["systems", "products", "ai-learning", "lab"]);
const PLACEHOLDERS = NAV_ITEMS.filter((item) => !BUILT.has(item.id));

export default function Home() {
  return (
    <div className="content-frame">
      <Hero />

      <IntelligentSystemsSection />

      <ProductEngineeringSection />

      <AILearningSection />

      <EngineeringLabSection />

      {PLACEHOLDERS.map((item) => (
        <section key={item.id} id={item.id} className="nav-specimen">
          <p className="eyebrow">
            {item.index} / {item.label.toUpperCase()}
          </p>
          <p className="type-caption">Navigation specimen section</p>
        </section>
      ))}
    </div>
  );
}
