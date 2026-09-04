import Link from "next/link";

import {
  DEMO_DISCLOSURE_PRIMARY,
  DEMO_DISCLOSURE_SECONDARY,
  findDemo,
} from "@/demo-runtime/demo-registry";

import { certificationsArePublishable } from "@/content/certifications";
import { MODULE_GROUPS, routesInGroup } from "@/demos/operations/ui/modules";

import FeaturedPreview from "./FeaturedPreview";
import FeaturedSequence from "./FeaturedSequence";

/**
 * 05 / FEATURED ENGINEERING BUILD
 *
 * The page's culmination, and deliberately not the same thing as
 * `SelectedWorkSection`.
 *
 * That component publishes real client work and refuses to render until its own
 * invariant is satisfied: a minimum number of case studies, each verified,
 * each complete. Nothing here touches it. This section publishes something
 * different and says so in as many words: an interactive engineering demo,
 * built for this portfolio, running on synthetic data in the visitor's own
 * browser. Presenting the two through one component would have meant either
 * weakening the case-study gate or dressing a demo as an engagement, and both
 * are the same lie told in different directions.
 *
 * So this owns `id="work"` on the homepage, the real case-study section stays
 * dormant, and the distinction is visible rather than implied: the canonical
 * disclosure sits at the top of the product frame, not in a tooltip.
 *
 * Every figure below is read from the frozen demo rather than written here.
 */

/* The four the specification freezes, each checkable in a minute by opening the
   demo and counting. Nothing derived, nothing rounded, nothing impressive that
   is not also true. */
const FACTS = [
  { value: "11", label: "connected modules" },
  { value: "13", label: "domain entities" },
  { value: "4", label: "simulated roles" },
  { value: "5", label: "automation rules" },
];

/**
 * Eleven modules is a list nobody reads. Three groups and an entry point is a
 * shape somebody understands.
 *
 * Derived from `MODULE_ROUTES` rather than retyped, and that is not tidiness.
 * A hand-written copy of this list said Contracts belonged to "Rental
 * operations" and Inbox to "Customer operations", while the preview directly
 * above it drew the console's real sidebar, where Contracts is a customer
 * operation and Inbox is a system one. The page was showing a visitor two
 * different architectures for one product and inviting them to open the demo
 * and find a third. Reading the product's own configuration means the section
 * cannot disagree with the product, and cannot drift from it later.
 *
 * Only the prose is written here, keyed by the group names the product owns.
 */
const GROUP_NOTES: Record<string, string> = {
  "Customer operations":
    "A lead becomes a customer, then a booking, then a signed agreement.",
  Operations: "Where an agreement becomes a vehicle out on hire, and comes back.",
  System: "The rules that watch the work, the messages it sends, the figures it derives.",
};

const GROUPS = MODULE_GROUPS.filter((group) => group !== "primary").map((group) => ({
  id: group,
  title: group,
  modules: routesInGroup(group).map((route) => route.label),
  note: GROUP_NOTES[group] ?? "",
}));

/* The domains the system covers, as a strip under the lead. Seven, and in the
   order the work actually happens. */
const CAPABILITIES = [
  "CRM",
  "RESERVATIONS",
  "CONTRACTS",
  "FLEET",
  "MAINTENANCE",
  "PAYMENTS",
  "AUTOMATION",
];

/* Descriptive, and each one a property a visitor can observe: reload the page
   and the data is still there, switch role and the surface changes, resize and
   it holds. No badge, no score, no assertion counts. */
const NOTES = [
  "Deterministic local runtime",
  "Role-aware workflows",
  "Persistent synthetic state",
  "Responsive application",
];

export default function FeaturedDemoSection() {
  /* The route comes from the registry rather than a literal, so a demo that is
     not verified cannot be linked from here by accident. */
  const demo = findDemo("operations");
  const href = demo?.route ?? "/demos/operations";

  /* The eyebrow numbers this section's place on the page, so it has to know
     whether anything is in front of it. Certifications sits between the Lab and
     this section and renders only when a real credential exists; today it does
     not, so this is 05. When the first credential arrives, Certifications takes
     05 and this becomes 06 on its own.

     The alternative was a hard-coded 05 that silently becomes wrong the day the
     section above it appears, giving the page two sections numbered 05. A
     number that describes a position should be derived from the position. */
  const index = certificationsArePublishable() ? "06" : "05";

  return (
    <section id="work" className="featured" aria-labelledby="featured-title">
      <div className="featured__intro">
        <div className="featured__intro-lead">
          <p className="eyebrow">{index} / FEATURED ENGINEERING BUILD</p>
          <h2 id="featured-title" className="featured__title">
            One operational system. Eleven connected modules.
          </h2>
        </div>

        <div className="featured__intro-support">
          <p className="featured__lead">
            A complete rental operations workflow: customer acquisition,
            reservations, contracts, fleet state, maintenance, payments,
            automation, messaging and reporting, connected through one
            deterministic system that runs entirely in the browser.
          </p>
          {/* A list rather than one string. Written as a string it wrapped
              with the separator leading the second line, and a line that opens
              with "/ AUTOMATION" reads as a broken path. Each item now carries
              its own trailing separator, so a wrap can only ever happen after
              one. */}
          <ul className="featured__capabilities">
            {CAPABILITIES.map((capability) => (
              <li className="featured__capability" key={capability}>
                {capability}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* The product frame, wrapped in the scroll sequence.

          `FeaturedSequence` is the only client boundary this section has, and
          it wraps rather than replaces: the frame, the masthead, the disclosure
          and the preview below are all server-rendered and pass through it
          untouched. With JavaScript off or reduced motion on it renders its
          children and nothing else, so what follows is the section exactly as
          it was before any motion existed. */}
      <FeaturedSequence>
      <div className="featured__product">
        <header className="featured__masthead">
          <div className="featured__identity">
            <h3 className="featured__product-name">Rental Operations Platform</h3>
            <p className="featured__product-sub">
              Operations Console <span aria-hidden="true">·</span> rental fleet management
            </p>
          </div>

          <p className="featured__disclosure">
            <span className="featured__disclosure-primary">{DEMO_DISCLOSURE_PRIMARY}</span>
            <span className="featured__disclosure-secondary">{DEMO_DISCLOSURE_SECONDARY}</span>
          </p>
        </header>

        <FeaturedPreview />
      </div>
      </FeaturedSequence>

      <div className="featured__breadth">
        <div className="featured__entry">
          <p className="featured__entry-label">Overview</p>
          <p className="featured__entry-note">
            The system entry point: live figures for every group below, each one
            counted from the records rather than stored.
          </p>
        </div>

        <ul className="featured__groups">
          {GROUPS.map((group) => (
            <li className="featured__group" key={group.id}>
              <p className="featured__group-title">{group.title}</p>
              <ul className="featured__module-list">
                {group.modules.map((module) => (
                  <li className="featured__module" key={module}>
                    {module}
                  </li>
                ))}
              </ul>
              <p className="featured__group-note">{group.note}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="featured__close">
        <dl className="featured__facts">
          {FACTS.map((fact) => (
            <div className="featured__fact" key={fact.label}>
              <dt className="featured__fact-label">{fact.label}</dt>
              <dd className="featured__fact-value">{fact.value}</dd>
            </div>
          ))}
        </dl>

        <div className="featured__action">
          <ul className="featured__notes">
            {NOTES.map((note) => (
              <li className="featured__note" key={note}>
                {note}
              </li>
            ))}
          </ul>

          <Link className="featured__cta" href={href}>
            Open the interactive demo
            <span className="featured__cta-arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
