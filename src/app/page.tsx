import Hero from "@/components/hero/Hero";
import { NAV_ITEMS } from "@/components/navigation/nav-items";

import "./page.css";

/* The homepage: the Stage 04 hero, followed by the five neutral navigation
   anchor zones carried over from Stage 03. Those zones remain QA
   placeholders — they hold no real content and are not designed sections. */

export default function Home() {
  return (
    <div className="content-frame">
      <Hero />

      {NAV_ITEMS.map((item) => (
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
