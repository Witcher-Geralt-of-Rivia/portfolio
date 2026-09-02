import { NAV_ITEMS } from "./nav-items";
import PortfolioMark from "./PortfolioMark";

/**
 * The floating desktop bar (>= 900px). Purely presentational: the active
 * section is resolved by SiteNavigation and handed down.
 */
export default function DesktopNavigation({ activeId }: { activeId: string }) {
  return (
    <nav
      aria-label="Primary navigation"
      className="site-nav__desktop nav-surface"
    >
      {/* The mark and wordmark are the route back to the top. The label is
          for assistive technology only; no visible "Home" link is added. */}
      <a
        href="#hero"
        className="site-nav__identity site-nav__identity--link"
        aria-label="Return to portfolio introduction"
      >
        <PortfolioMark />
        <span className="site-nav__wordmark">Engineering Lab</span>
      </a>

      <ul className="site-nav__links">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <a
              href={item.href}
              className="site-nav__link"
              /* These are sections within one document, not separate
                 pages, so the current state is a location. */
              aria-current={activeId === item.id ? "location" : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
