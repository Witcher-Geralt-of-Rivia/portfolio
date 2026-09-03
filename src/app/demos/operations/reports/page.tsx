import { Suspense } from "react";
import type { Metadata } from "next";

import ReportsScreen from "@/demos/operations/ui/reports/ReportsScreen";

/**
 * The Operations demo's Reports module.
 *
 * A Server Component, like every page in this subtree; the shell and the
 * client boundary come from the layout above it. `robots` is inherited rather
 * than restated, for the reason given in the Overview page.
 */
export const metadata: Metadata = {
  title: "Reports: Rental Operations Platform",
  description:
    "The derived figures of an interactive rental operations demonstration. Synthetic data, frontend only.",
};

export default function OperationsReportsPage() {
  return (
    <Suspense fallback={<div className="ops-reports" aria-busy="true" />}>
      <ReportsScreen />
    </Suspense>
  );
}
