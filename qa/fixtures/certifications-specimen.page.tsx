/**
 * QA FIXTURE: not part of the product, and not a route while it lives here.
 *
 * NONE OF THE CREDENTIALS BELOW ARE REAL. No certification has been issued to
 * this portfolio's author, and `src/content/certifications.ts` is empty and
 * stays empty. Every record here exists to give the deck something to
 * choreograph so its geometry, its modal, its keyboard behaviour and its
 * responsive layout can be measured. Each issuer is an invented institution
 * name that could not be mistaken for a real awarding body, and each
 * verification URL points at `example.com`, which RFC 2606 reserves precisely
 * so it can never resolve to somebody's site.
 *
 * They must never reach the public page. Two things guarantee that and both are
 * checked: this file creates no route while it lives under `qa/`, and
 * `qa/stage09f-certifications.mjs` asserts that none of these strings appear in
 * the production homepage.
 *
 * To run the harness:
 *
 *   mkdir -p src/app/specimen/certifications
 *   cp qa/fixtures/certifications-specimen.page.tsx src/app/specimen/certifications/page.tsx
 *   npm run build && npx next start -p 3001 -H 127.0.0.1
 *   node qa/stage09f-certifications.mjs
 *   rm -r src/app/specimen/certifications
 *
 * It lives under `qa/` so that creating the route is a deliberate act: a QA
 * route must never exist in production.
 *
 * The fixtures deliberately cover what the brief asked the component to
 * survive: one card, three, five; a title long enough to need clamping; an
 * issuer name that is too long for its line; a credential id; an expiry; an
 * image present and absent. `?n=` selects how many are mounted, so the same
 * route serves the 1, 3 and 5 card cases without three fixtures.
 */

import CertificationsSection from "@/components/certifications/CertificationsSection";
import type { Certification } from "@/content/certifications";

/* Invented institutions. Chosen to be obviously fictional: no real awarding
   body is called any of these, and none of them is a real company operating
   under another name. */
const FIXTURES: Certification[] = [
  {
    id: "fixture-01",
    status: "verified",
    title: "Distributed Systems Engineering",
    issuer: "Meridian Institute of Applied Computing",
    issuedAt: "2025-03-18",
    credentialId: "MIAC-DSE-4417-QX",
    credentialUrl: "https://example.com/credentials/fixture-01",
    category: "Architecture",
  },
  {
    id: "fixture-02",
    /* Long title and long issuer together: the case where a card in a fixed
       rail has to clamp rather than grow taller than its neighbours. */
    status: "verified",
    title:
      "Advanced Event-Driven Architecture, Message Durability and Exactly-Once Delivery Semantics",
    issuer: "The Northfield Academy of Software Reliability and Systems Practice",
    issuedAt: "2025-07-02",
    expiresAt: "2028-07-02",
    credentialId: "NASRP-EDA-2025-000731-LONG-IDENTIFIER",
    credentialUrl: "https://example.com/credentials/fixture-02",
    category: "Reliability Engineering",
  },
  {
    /* No optional fields at all: no expiry, no credential id, no category, no
       image. The minimum a credential can be and still publish. */
    id: "fixture-03",
    status: "verified",
    title: "Type-Safe Application Development",
    issuer: "Calderwood School of Computing",
    issuedAt: "2024-11-09",
    credentialUrl: "https://example.com/credentials/fixture-03",
  },
  {
    /* Image present: exercises the modal's figure branch. A local SVG already
       in the repository, so the fixture pulls nothing from the network and the
       no-external-images rule holds. */
    id: "fixture-04",
    status: "verified",
    title: "Secure API Design and Threat Modelling",
    issuer: "Ashgrove Institute",
    issuedAt: "2025-01-24",
    expiresAt: "2027-01-24",
    credentialId: "AI-SATM-0091",
    credentialUrl: "https://example.com/credentials/fixture-04",
    image: "/textures/micro-grain.svg",
    category: "Security",
  },
  {
    id: "fixture-05",
    status: "verified",
    title: "Machine Learning Systems in Production",
    issuer: "Brackenhurst Technical College",
    issuedAt: "2024-06-13",
    credentialId: "BTC-MLSP-7788",
    credentialUrl: "https://example.com/credentials/fixture-05",
    category: "Applied ML",
  },
];

/* A record that must NOT publish, carried alongside the good ones so the gate
   is exercised by the specimen rather than only by the unit tests. It is
   complete in every field but its status is draft. The deck must never show
   six cards. */
const DRAFT: Certification = {
  id: "fixture-draft",
  status: "draft",
  title: "Unissued Draft That Must Never Render",
  issuer: "Draft Institute",
  issuedAt: "2025-09-01",
  credentialUrl: "https://example.com/credentials/draft",
};

export default async function CertificationsSpecimen({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const { n } = await searchParams;
  const requested = Number(n);
  const count =
    Number.isFinite(requested) && requested >= 1 && requested <= FIXTURES.length
      ? Math.floor(requested)
      : FIXTURES.length;

  const certifications = [...FIXTURES.slice(0, count), DRAFT];

  return (
    <main className="site-main">
      <div className="content-frame">
        <p
          style={{
            padding: "12px 0 4px",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--type-technical-micro)",
            letterSpacing: "var(--tracking-eyebrow)",
            color: "var(--text-annotation)",
          }}
        >
          QA FIXTURE / SYNTHETIC CREDENTIALS / NOT REAL / {count} MOUNTED
        </p>
        <CertificationsSection certifications={certifications} />

        {/*
          Trailing content, and it is load-bearing rather than decoration.

          A sticky range needs the document to extend past it, or the page runs
          out of scroll before the stage unpins and the last credentials never
          resolve. On the real homepage the featured build and the footer sit
          below this section and supply that room; a fixture page that ended at
          the deck would measure a shortfall the product does not have, and the
          first run of this harness did exactly that.
        */}
        <div
          style={{ height: "120svh" }}
          aria-hidden="true"
          data-qa="trailing-space-standing-in-for-the-rest-of-the-page"
        />
      </div>
    </main>
  );
}
