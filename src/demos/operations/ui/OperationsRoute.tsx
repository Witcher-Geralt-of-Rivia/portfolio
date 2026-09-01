"use client";

/**
 * Operations demo — the client boundary.
 *
 * Everything below this point needs the browser: IndexedDB, the logical clock
 * and the session. Keeping the boundary here rather than on the route's layout
 * leaves the page and its metadata server-rendered.
 */

import OperationsAppShell from "./OperationsAppShell";
import OperationsOverview from "./OperationsOverview";
import OperationsProvider from "./OperationsProvider";

export default function OperationsRoute() {
  return (
    <OperationsProvider>
      <OperationsAppShell
        activeModule="Overview"
        title="Overview"
        context="Rental operations at a glance"
      >
        <OperationsOverview />
      </OperationsAppShell>
    </OperationsProvider>
  );
}
