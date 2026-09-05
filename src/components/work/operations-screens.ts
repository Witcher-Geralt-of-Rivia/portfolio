/**
 * The eleven real screens, in the product's own order.
 *
 * These describe image assets produced by `qa/capture-operations.mjs` from the
 * running application at its real routes. They are not a description of the
 * product: they are pointers at photographs of it.
 *
 * That distinction is the whole reason the constructed preview was removed. It
 * was a hand-composed picture of the console, honest about being an
 * abstraction, and it still misrepresented the product, because a visitor who
 * opened the demo found an interface that did not look like the one on the
 * landing page and had no way to know which was real.
 *
 * The order is the sidebar's order, which is `MODULE_ROUTES` in the demo. It is
 * checked against that file by `qa/stage09h-scenes.mjs` rather than trusted,
 * because a hand-written copy of a module list has drifted from the product
 * once already (D-099).
 */

export type OperationsScreen = {
  /** Matches the capture filename and the module id. */
  id: string;
  /** The module's name, exactly as the application's own top bar prints it. */
  label: string;
  /** The application's subtitle for the module, for the alt text. */
  context: string;
};

export const OPERATIONS_SCREENS: readonly OperationsScreen[] = [
  { id: "overview", label: "Overview", context: "Rental operations at a glance" },
  { id: "leads", label: "Leads", context: "CRM pipeline" },
  { id: "customers", label: "Customers", context: "Accounts and history" },
  { id: "reservations", label: "Reservations", context: "Bookings and availability" },
  { id: "contracts", label: "Contracts", context: "Active and closed agreements" },
  { id: "fleet", label: "Fleet", context: "Vehicles and status" },
  { id: "maintenance", label: "Maintenance", context: "Work orders" },
  { id: "payments", label: "Payments", context: "Balances and settlement" },
  { id: "automations", label: "Automations", context: "Rules and runs" },
  { id: "inbox", label: "Inbox", context: "Conversations" },
  { id: "reports", label: "Reports", context: "Derived figures" },
] as const;

export const SCREEN_COUNT = OPERATIONS_SCREENS.length;

/** Captured at 1440x900, the width the application was designed and QA'd at. */
export const DESKTOP_SOURCE = { width: 1440, height: 900 };
/** Captured at 390x844 at 2x, because the application is genuinely responsive. */
export const MOBILE_SOURCE = { width: 780, height: 1688 };

export function desktopSrc(id: string): string {
  return `/operations/desktop/operations-${id}.png`;
}

export function mobileSrc(id: string): string {
  return `/operations/mobile/operations-${id}.png`;
}

/**
 * What a screen reader is told about each image.
 *
 * Names the module and says plainly that this is a screenshot of the
 * demonstration, so the image is never mistaken for a live interface.
 */
export function screenAlt(screen: OperationsScreen): string {
  return `Screenshot of the ${screen.label} module in the Rental Operations Platform demonstration: ${screen.context}.`;
}

/* =====================================================================
   THE PROGRESSION
   Pure arithmetic, kept out of the component so it can be proved without
   a browser. Every property below was a real defect in this project
   before it was an assertion.
   ===================================================================== */

/**
 * How much of a transition the incoming screen spends arriving.
 *
 * Below 1 so each screen has a settled period where it is simply the screen,
 * rather than being permanently in motion between two others.
 */
export const CHANGE_WINDOW = 0.55;

export type ScreenFrame = {
  /** The screen being left. */
  index: number;
  /** The screen arriving. Equals `index` only at the very end. */
  incoming: number;
  /** How far the incoming screen has arrived, 0 to 1. */
  change: number;
  /** The screen the label and the index counter name. */
  current: number;
};

/**
 * Where the sequence is at a given scroll progress.
 *
 * With N screens there are N-1 transitions, and `floor(p * (N-1))` lands on
 * N-1 at p = 1: a transition that does not exist. Left alone, the final screen
 * never becomes active and Reports is never reached. Clamping the index and
 * letting the local progress carry to 1 is what makes the last screen resolve
 * exactly as the section releases, which is stated here rather than left as a
 * consequence of the arithmetic.
 */
export function screenFrame(progress: number): ScreenFrame {
  const segments = SCREEN_COUNT - 1;
  const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const scaled = clamped * segments;
  const index = Math.min(segments - 1, Math.floor(scaled));
  const raw = scaled - index;
  const local = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  const changeRaw = local / CHANGE_WINDOW;
  const change = changeRaw > 1 ? 1 : changeRaw;
  return {
    index,
    incoming: index + 1,
    change,
    current: local >= 1 ? index + 1 : index,
  };
}

/**
 * How one screen paints in a given frame.
 *
 * NOT a crossfade. Eleven screenshots of the same application share a layout,
 * a chrome and a colour, so two of them at half opacity do not read as one
 * changing into another: they read as a printing fault. The first build of this
 * did crossfade, and the settled screens were legible while every transition
 * was an unreadable double exposure of two dashboards.
 *
 * So a screen is either painted or it is not, and the arriving one is REVEALED
 * over the one it replaces by a moving clip edge. Nothing is ever
 * semi-transparent, so nothing is ever ghosted, and the application is legible
 * at every scroll position rather than only at the settled ones.
 *
 *   show   1 if this screen paints at all
 *   clip   how much of the arriving screen is still hidden, 1 to 0
 *   layer  1 for the arriving screen, so it sits above the one it covers
 */
export type ScreenLayer = { show: number; clip: number; layer: number };

export function screenLayer(frame: ScreenFrame, i: number): ScreenLayer {
  /* The screen being replaced. Fully painted and unclipped the whole time: it
     is what the visitor is looking at until the edge has passed over it. */
  if (i === frame.index) return { show: 1, clip: 0, layer: 0 };
  /* The screen arriving, revealed from `clip` to nothing. */
  if (i === frame.incoming) return { show: 1, clip: 1 - frame.change, layer: 1 };
  return { show: 0, clip: 1, layer: 0 };
}

/**
 * The screen a visitor is actually looking at: the arriving one once it has
 * covered the frame, otherwise the one underneath.
 *
 * This is what the label and the counter name, and what QA asserts, so that
 * "the sequence reaches Reports" means the visitor saw Reports rather than
 * that an invisible element existed.
 */
export function visibleScreen(frame: ScreenFrame): number {
  return frame.change >= 1 ? frame.incoming : frame.index;
}
