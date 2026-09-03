import { Suspense } from "react";
import type { Metadata } from "next";

import ContractsScreen from "@/demos/operations/ui/contracts/ContractsScreen";

/**
 * The Operations demo's Contracts module.
 *
 * A Server Component, like every page in this subtree; the shell and the
 * client boundary come from the layout above it. `robots` is inherited rather
 * than restated, for the reason given in the Overview page.
 */
export const metadata: Metadata = {
  title: "Contracts: Rental Operations Platform",
  description:
    "The rental agreements workspace of an interactive rental operations demonstration. Synthetic data, frontend only.",
};

export default function OperationsContractsPage() {
  return (
    <Suspense fallback={<div className="ops-contracts" aria-busy="true" />}>
      <ContractsScreen />
    </Suspense>
  );
}
