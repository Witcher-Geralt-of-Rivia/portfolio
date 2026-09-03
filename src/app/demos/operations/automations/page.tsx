import { Suspense } from "react";
import type { Metadata } from "next";

import AutomationsScreen from "@/demos/operations/ui/automations/AutomationsScreen";

/**
 * The Operations demo's Automations module.
 *
 * A Server Component, like every page in this subtree; the shell and the
 * client boundary come from the layout above it. `robots` is inherited rather
 * than restated, for the reason given in the Overview page.
 */
export const metadata: Metadata = {
  title: "Automations: Rental Operations Platform",
  description:
    "The rule engine of an interactive rental operations demonstration. Synthetic data, frontend only.",
};

export default function OperationsAutomationsPage() {
  return (
    <Suspense fallback={<div className="ops-automations" aria-busy="true" />}>
      <AutomationsScreen />
    </Suspense>
  );
}
