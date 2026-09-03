import { Suspense } from "react";
import type { Metadata } from "next";

import MaintenanceScreen from "@/demos/operations/ui/maintenance/MaintenanceScreen";

/**
 * The Operations demo's Maintenance module.
 *
 * A Server Component, like every page in this subtree; the shell and the
 * client boundary come from the layout above it. `robots` is inherited rather
 * than restated, for the reason given in the Overview page.
 */
export const metadata: Metadata = {
  title: "Maintenance: Rental Operations Platform",
  description:
    "The workshop queue of an interactive rental operations demonstration. Synthetic data, frontend only.",
};

export default function OperationsMaintenancePage() {
  return (
    <Suspense fallback={<div className="ops-maintenance" aria-busy="true" />}>
      <MaintenanceScreen />
    </Suspense>
  );
}
