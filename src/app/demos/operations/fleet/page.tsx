import { Suspense } from "react";
import type { Metadata } from "next";

import FleetScreen from "@/demos/operations/ui/fleet/FleetScreen";

/**
 * The Operations demo's Fleet module.
 *
 * A Server Component, like every page in this subtree; the shell and the
 * client boundary come from the layout above it. `robots` is inherited rather
 * than restated, for the reason given in the Overview page.
 */
export const metadata: Metadata = {
  title: "Fleet: Rental Operations Platform",
  description:
    "The vehicle register of an interactive rental operations demonstration. Synthetic data, frontend only.",
};

export default function OperationsFleetPage() {
  return (
    <Suspense fallback={<div className="ops-vehicles" aria-busy="true" />}>
      <FleetScreen />
    </Suspense>
  );
}
