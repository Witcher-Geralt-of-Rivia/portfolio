import type { ReactNode } from "react";

import AuroraBackground from "@/components/visual/AuroraBackground";
import PrismLight from "@/components/visual/PrismLight";
import GrainOverlay from "@/components/visual/GrainOverlay";
import SiteNavigation from "@/components/navigation/SiteNavigation";

/**
 * The global site shell: Stage 01's atmosphere, the navigation, and the
 * content frame every page renders into.
 *
 * It is deliberately content-free. Anything specific to a single page
 * belongs in that page, not here.
 */
export default function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Stage 01 background. Fixed, inert, painted behind everything. */}
      <AuroraBackground />
      <PrismLight />
      <GrainOverlay />

      <SiteNavigation />

      {/* Top padding is shell clearance for the fixed navigation, not
          hero spacing. Pages add their own rhythm on top of it. */}
      <main className="site-main" id="main-content">
        {children}
      </main>
    </>
  );
}
