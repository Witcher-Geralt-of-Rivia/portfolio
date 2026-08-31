import Hero from "@/components/hero/Hero";
import IntelligentSystemsSection from "@/components/systems/IntelligentSystemsSection";
import { NAV_ITEMS } from "@/components/navigation/nav-items";

import "./page.css";

/* The homepage: the Stage 04 hero, the Stage 05 Intelligent Systems section,
   then the remaining navigation anchor zones. Those remaining four are still
   Stage 03 QA placeholders and are replaced by their own stages. */

const PLACEHOLDERS = NAV_ITEMS.filter((item) => item.id !== "systems");

export default function Home() {
  return (
    <div className="content-frame">
      <Hero />

      <IntelligentSystemsSection />

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
