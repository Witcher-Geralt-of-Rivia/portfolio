import { Suspense } from "react";
import type { Metadata } from "next";

import PaymentsScreen from "@/demos/operations/ui/payments/PaymentsScreen";

/**
 * The Operations demo's Payments module.
 *
 * A Server Component, like every page in this subtree; the shell and the
 * client boundary come from the layout above it. `robots` is inherited rather
 * than restated, for the reason given in the Overview page.
 */
export const metadata: Metadata = {
  title: "Payments: Rental Operations Platform",
  description:
    "The balances and settlement workspace of an interactive rental operations demonstration. Synthetic data, frontend only.",
};

export default function OperationsPaymentsPage() {
  return (
    <Suspense fallback={<div className="ops-payments" aria-busy="true" />}>
      <PaymentsScreen />
    </Suspense>
  );
}
