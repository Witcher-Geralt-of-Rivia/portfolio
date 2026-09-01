import type { Metadata } from "next";

import "@/styles/demo-shell.css";

/**
 * Layout for the demo platform.
 *
 * A Server Component, and it has to be: a `metadata` export is only honoured
 * in one. It nests inside the root layout rather than replacing it, so it must
 * not emit `<html>` or `<body>`.
 *
 * No `page.tsx` exists beneath this yet, so `/demos` and every route under it
 * is a 404. That is deliberate — an unfinished product demonstration must not
 * be reachable. The layout and the shared runtime are built and frozen first;
 * each demo becomes a route only when it is finished.
 *
 * The stylesheet is imported here rather than appended to `globals.css`. The
 * project's composition root loads every stylesheet the site itself needs, and
 * adding demo chrome to it would put CSS on the homepage that the homepage
 * never uses.
 */

/**
 * Demo applications are kept out of search results.
 *
 * The portfolio page is the canonical indexed presentation of this work. A
 * synthetic demonstration surfacing on its own in a results page would be
 * separated from every piece of context that says it is a demonstration, and
 * could be read as an independent commercial product.
 *
 * Written as `index: false` / `follow: false`. The `noindex` and `nofollow`
 * keys exist in the type but are typed `never` and deprecated in this version
 * of Next, so they fail the typecheck rather than silently doing nothing.
 *
 * Metadata is shallow-merged and the LAST segment to define a key wins, so a
 * demo page that sets its own `robots` would discard this entirely. Any page
 * beneath here that needs its own robots settings must spread
 * `DEMO_ROBOTS` rather than replace it.
 */
export const DEMO_ROBOTS = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
} as const;

export const metadata: Metadata = {
  robots: DEMO_ROBOTS,
};

export default function DemosLayout({ children }: { children: React.ReactNode }) {
  return <div className="demo-root">{children}</div>;
}
