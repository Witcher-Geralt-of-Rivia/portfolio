import type { Metadata } from "next";

import OperationsOverview from "@/demos/operations/ui/OperationsOverview";

/**
 * The Operations demo's Overview.
 *
 * A Server Component so the metadata export is honoured. The shell around it
 * lives in this route's layout, which is also where the client boundary and
 * the stylesheet are.
 *
 * `robots` is inherited from `src/app/demos/layout.tsx`. It is deliberately
 * NOT redefined here: metadata is shallow-merged and the last segment to set a
 * key wins, so setting `robots` at this level would discard the subtree's
 * noindex rather than adding to it.
 */
export const metadata: Metadata = {
  title: "Rental Operations Platform — Interactive Demo",
  description:
    "An interactive engineering demonstration of a rental operations product. Synthetic data, frontend only.",
};

export default function OperationsDemoPage() {
  return <OperationsOverview />;
}
