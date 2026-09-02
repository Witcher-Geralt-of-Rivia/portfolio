import OperationsRoute from "@/demos/operations/ui/OperationsRoute";

/* Imported by the layout rather than by the client boundary beneath it, so
   Next links it as this subtree's stylesheet instead of preloading a chunk the
   document never claims. */
import "@/styles/operations.css";

/**
 * Layout for the Operations demo.
 *
 * Holds the product's client boundary (provider, shell, sidebar, top bar) so
 * it persists while the visitor moves between modules. The runtime beneath it
 * is created once for the whole product rather than once per screen.
 *
 * A Server Component: it carries no metadata of its own (each page sets its
 * title, and `robots` is inherited from `src/app/demos/layout.tsx`), but the
 * boundary has to start below it for the pages to stay server-rendered.
 */
export default function OperationsLayout({ children }: { children: React.ReactNode }) {
  return <OperationsRoute>{children}</OperationsRoute>;
}
