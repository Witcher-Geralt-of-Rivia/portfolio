import { Suspense } from "react";
import type { Metadata } from "next";

import CustomersScreen from "@/demos/operations/ui/customers/CustomersScreen";

/**
 * The Operations demo's Customers module.
 *
 * A Server Component, like every page in this subtree; the shell and the
 * client boundary come from the layout above it. `robots` is inherited rather
 * than restated, for the reason given in the Overview page.
 */
export const metadata: Metadata = {
  title: "Customers: Rental Operations Platform",
  description:
    "The customer records of an interactive rental operations demonstration. Synthetic data, frontend only.",
};

export default function OperationsCustomersPage() {
  return (
    <Suspense fallback={<div className="ops-customers" aria-busy="true" />}>
      <CustomersScreen />
    </Suspense>
  );
}
