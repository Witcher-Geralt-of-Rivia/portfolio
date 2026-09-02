import { Suspense } from "react";
import type { Metadata } from "next";

import ReservationsScreen from "@/demos/operations/ui/reservations/ReservationsScreen";

/**
 * The Operations demo's Reservations module.
 *
 * A Server Component, like every page in this subtree; the shell and the
 * client boundary come from the layout above it. `robots` is inherited rather
 * than restated, for the reason given in the Overview page.
 */
export const metadata: Metadata = {
  title: "Reservations: Rental Operations Platform",
  description:
    "The booking workspace of an interactive rental operations demonstration. Synthetic data, frontend only.",
};

export default function OperationsReservationsPage() {
  return (
    <Suspense fallback={<div className="ops-reservations" aria-busy="true" />}>
      <ReservationsScreen />
    </Suspense>
  );
}
