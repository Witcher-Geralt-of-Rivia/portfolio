import type { CSSProperties, RefObject } from "react";

import { NAV_ITEMS } from "./nav-items";
import SystemMarkImage from "./SystemMarkImage";

type Props = {
  open: boolean;
  activeId: string;
  onToggle: () => void;
  onNavigate: () => void;
  toggleRef: RefObject<HTMLButtonElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
};

const PANEL_ID = "mobile-primary-navigation";

/**
 * The compact bar and its panel (< 900px). Presentational: open state,
 * focus handling and the scroll lock all live in SiteNavigation.
 *
 * The panel stays mounted and is hidden with visibility plus `inert`, so
 * it is out of the tab order and the accessibility tree while closed but
 * can still transition on the way in and out.
 */
export default function MobileNavigation({
  open,
  activeId,
  onToggle,
  onNavigate,
  toggleRef,
  panelRef,
}: Props) {
  return (
    <>
      <div className="site-nav__bar nav-surface">
        <a
          href="#hero"
          className="site-nav__identity site-nav__identity--link"
          aria-label="Return to portfolio introduction"
          onClick={onNavigate}
        >
          <SystemMarkImage />
          <span className="site-nav__wordmark">Engineering</span>
        </a>

        <button
          ref={toggleRef}
          type="button"
          className="site-nav__toggle"
          aria-expanded={open}
          aria-controls={PANEL_ID}
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={onToggle}
        >
          <span className="site-nav__icon" aria-hidden="true">
            <span />
            <span />
          </span>
        </button>
      </div>

      {/* A milk veil, not a dark scrim. Inert so it never takes focus. */}
      <div className="site-nav__veil" data-open={open} aria-hidden="true" />

      <div
        ref={panelRef}
        id={PANEL_ID}
        className="site-nav__panel nav-surface"
        data-open={open}
        inert={!open}
      >
        <nav aria-label="Primary navigation">
          <ul className="site-nav__panel-list">
            {NAV_ITEMS.map((item, i) => (
              <li
                key={item.id}
                className="site-nav__panel-item"
                style={{ "--item-index": i } as CSSProperties}
              >
                <a
                  href={item.href}
                  className="site-nav__panel-link"
                  aria-current={activeId === item.id ? "location" : undefined}
                  onClick={onNavigate}
                >
                  <span className="site-nav__panel-index">
                    {item.index}
                    <span className="site-nav__panel-dash" aria-hidden="true" />
                  </span>
                  <span className="site-nav__panel-label">{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
