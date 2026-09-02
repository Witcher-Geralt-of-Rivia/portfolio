import CapabilityRail from "./CapabilityRail";
import IntelligenceConstellation from "./IntelligenceConstellation";

/**
 * The homepage hero.
 *
 * Server-rendered in full. The entrance, the ambient drift, the signal flow
 * and the constellation hover are all CSS, so nothing here needs to become a
 * client component.
 *
 * Both actions are internal navigation to sections of this page. There is no
 * contact affordance anywhere in the hero.
 */

function ArrowIcon() {
  return (
    <svg
      className="hero__action-icon"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 7h9" />
      <path d="M8 3.5 11.5 7 8 10.5" />
    </svg>
  );
}

export default function Hero() {
  return (
    <section id="hero" className="hero" aria-labelledby="hero-title">
      <div className="hero__inner">
        <div className="hero__text">
          <p className="eyebrow hero__eyebrow">
            AI Systems · Product Engineering · Learning Technology
          </p>

          <h1 id="hero-title" className="hero__title">
            Engineering intelligent systems.
          </h1>

          <p className="hero__lead">
            AI agents, automation, SaaS, APIs, web, mobile and adaptive
            learning systems, engineered across interfaces, workflows, data
            and backend infrastructure.
          </p>

          <div className="hero__actions">
            <a href="#systems" className="hero__action hero__action--primary">
              Explore systems
              <ArrowIcon />
            </a>
            <a href="#work" className="hero__action hero__action--secondary">
              Selected work
            </a>
          </div>

          <CapabilityRail />
        </div>

        <div className="hero__visual">
          <IntelligenceConstellation />
        </div>
      </div>
    </section>
  );
}
