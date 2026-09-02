import { Suspense } from "react";
import type { Metadata } from "next";

import LeadsScreen from "@/demos/operations/ui/leads/LeadsScreen";

/**
 * The Operations demo's Leads module.
 *
 * A Server Component, like every page in this subtree; the shell and the
 * client boundary come from the layout above it. `robots` is inherited rather
 * than restated, for the reason given in the Overview page.
 */
export const metadata: Metadata = {
  title: "Leads: Rental Operations Platform",
  description:
    "The CRM pipeline of an interactive rental operations demonstration. Synthetic data, frontend only.",
};

/**
 * `LeadsScreen` reads the selected record from `?selected=`, and this route is
 * prerendered. A client component that reads the query string during a
 * prerender must sit inside a Suspense boundary, or the build fails: the
 * query string is not known until the request. The fallback is what the static
 * HTML carries until the screen hydrates.
 */
export default function OperationsLeadsPage() {
  return (
    <Suspense fallback={<div className="ops-leads" aria-busy="true" />}>
      <LeadsScreen />
    </Suspense>
  );
}
