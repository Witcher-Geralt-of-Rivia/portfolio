import type { Metadata } from "next";

import OperationsRoute from "@/demos/operations/ui/OperationsRoute";

/* Imported by the route rather than by the client boundary beneath it, so
   Next links it as this route's stylesheet instead of preloading a chunk
   the document never claims. */
import "@/styles/operations.css";

/**
 * The Operations demo.
 *
 * A Server Component so the metadata export is honoured; everything that needs
 * the runtime is inside `OperationsRoute`, which is the client boundary. The
 * shell renders no demo data on the server — there is none to render, since it
 * all lives in the visitor's browser — so there is nothing to mismatch on
 * hydration.
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
  return <OperationsRoute />;
}
