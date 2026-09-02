import { Suspense } from "react";
import type { Metadata } from "next";

import InboxScreen from "@/demos/operations/ui/inbox/InboxScreen";

/**
 * The Operations demo's Inbox module.
 *
 * A Server Component, like every page in this subtree; the shell and the
 * client boundary come from the layout above it. `robots` is inherited rather
 * than restated, for the reason given in the Overview page.
 */
export const metadata: Metadata = {
  title: "Inbox: Rental Operations Platform",
  description:
    "The conversation workspace of an interactive rental operations demonstration. Synthetic data, frontend only.",
};

export default function OperationsInboxPage() {
  return (
    <Suspense fallback={<div className="ops-inbox" aria-busy="true" />}>
      <InboxScreen />
    </Suspense>
  );
}
