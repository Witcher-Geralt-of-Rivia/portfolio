/**
 * The public disclosure carried by every demo.
 *
 * Server-rendered: it is fixed text with no behaviour, and it must be in the
 * initial HTML. A disclosure that appeared only after hydration would be
 * absent exactly when someone reads the page source or when scripting fails,
 * the two cases where an honest label matters most.
 *
 * The wording is canonical. It may be restyled; it may not be softened,
 * abbreviated into meaninglessness, or moved somewhere it can be missed.
 */

import {
  DEMO_DISCLOSURE_PRIMARY,
  DEMO_DISCLOSURE_SECONDARY,
} from "@/demo-runtime/demo-registry";

export default function DemoDisclosure() {
  return (
    <p className="demo-disclosure">
      <span className="demo-disclosure__primary">{DEMO_DISCLOSURE_PRIMARY}</span>
      <span className="demo-disclosure__divider" aria-hidden="true" />
      <span className="demo-disclosure__secondary">{DEMO_DISCLOSURE_SECONDARY}</span>
    </p>
  );
}
