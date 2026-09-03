import Link from "next/link";

import { NAV_ITEMS } from "@/components/navigation/nav-items";

/**
 * The page's ending.
 *
 * Before this the homepage simply stopped: the last section ran out and the
 * document ended, which reads as unfinished however good the sections above it
 * are.
 *
 * A close, not a funnel. There is no email, no telephone, no social account, no
 * form and no availability line, and that is a standing rule of this portfolio
 * rather than an omission: the site carries no contact route on any surface.
 * What it offers instead is the way back into the page, which is the only thing
 * a reader who has got this far actually needs.
 */
export default function SiteFooter() {
  return (
    <footer className="site-footer" aria-labelledby="site-footer-title">
      <div className="site-footer__inner">
        <div className="site-footer__identity">
          {/* The mark sits on the name's line rather than above it. On its own
              row it read as a stray dot with the name floating beneath it. */}
          <p id="site-footer-title" className="site-footer__name">
            <span className="site-footer__mark-dot" aria-hidden="true" />
            Intelligent Systems Lab
          </p>
          <p className="site-footer__statement">
            Engineering portfolio. Interactive systems built to be opened and
            used, not described.
          </p>
        </div>

        <nav className="site-footer__nav" aria-label="Page sections">
          <ul className="site-footer__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.id}>
                <Link className="site-footer__link" href={item.href}>
                  <span className="site-footer__link-index" aria-hidden="true">
                    {item.index}
                  </span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <p className="site-footer__base">
        <span className="site-footer__base-note">
          Built with Next.js and TypeScript. No third-party fonts, trackers or
          analytics.
        </span>
      </p>
    </footer>
  );
}
