"use client";

/**
 * Operations demo — the client boundary.
 *
 * Everything below this point needs the browser: IndexedDB, the logical clock
 * and the session. Keeping the boundary here rather than in the pages leaves
 * each page and its metadata server-rendered.
 *
 * It became a frame in 09C3.1, when the product grew a second route. Mounted
 * from `src/app/demos/operations/layout.tsx`, it survives navigation between
 * Overview and Leads — so the runtime is created once, IndexedDB is opened
 * once, and moving between modules does not tear the demo down and rebuild it.
 * When each page carried its own provider, every navigation disposed the
 * runtime and put both screens back to their skeletons.
 *
 * The shell asks the URL which module it is showing rather than being told by
 * the page. That keeps one answer to "where am I": the same pathname decides
 * the active navigation entry, the heading and the top bar's second line.
 * `usePathname` needs no Suspense boundary here — every route in this subtree
 * is static with no dynamic segment, so the pathname resolves at prerender.
 */

import { usePathname } from "next/navigation";

import { routeForPath } from "./modules";
import OperationsAppShell from "./OperationsAppShell";
import OperationsProvider from "./OperationsProvider";

export default function OperationsRoute({ children }: { children: React.ReactNode }) {
  const current = routeForPath(usePathname());

  return (
    <OperationsProvider>
      <OperationsAppShell
        activeModule={current.id}
        title={current.label}
        context={current.context}
      >
        {children}
      </OperationsAppShell>
    </OperationsProvider>
  );
}
