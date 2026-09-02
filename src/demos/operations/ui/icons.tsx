/**
 * Operations demo: the shell's icon set.
 *
 * Authored here rather than installed. The project has no icon package and
 * every mark in it is drawn locally; a dependency for eleven glyphs would be
 * the largest thing in the repository by file count.
 *
 * One visual language throughout: a 24-unit viewBox drawn at 18px, 1.7 stroke,
 * round caps and joins, no fills. They are decorative (every navigation item
 * carries its own text label), so each is `aria-hidden`.
 */

type IconProps = { size?: number };

function Glyph({ size = 18, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="ops-icon"
    >
      {children}
    </svg>
  );
}

/** Overview: four panels, the shape of a dashboard. */
export const IconOverview = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </Glyph>
);

/** Leads: a rising track with a marked point. */
export const IconLeads = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 17.5 8.5 12l3.5 3.5L21 6.5" />
    <path d="M21 11V6.5h-4.5" />
  </Glyph>
);

/** Customers: two figures. */
export const IconCustomers = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.2 19.5a5.8 5.8 0 0 1 11.6 0" />
    <path d="M16.5 6.2a3.2 3.2 0 0 1 0 6" />
    <path d="M17.6 14.4a5.8 5.8 0 0 1 3.2 5.1" />
  </Glyph>
);

/** Reservations: a calendar with a held day. */
export const IconReservations = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="3.2" y="4.8" width="17.6" height="16" rx="2.2" />
    <path d="M3.2 9.6h17.6M8 3v3.6M16 3v3.6" />
    <rect x="7.2" y="12.6" width="4" height="3.4" rx="0.8" />
  </Glyph>
);

/** Contracts: a document with signed lines. */
export const IconContracts = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M6 2.8h7.5L19 8.4v12.8H6z" />
    <path d="M13.2 2.8v5.8H19" />
    <path d="M9 13h7M9 16.6h4.5" />
  </Glyph>
);

/** Fleet: a wheeled vehicle silhouette. */
export const IconFleet = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="6" cy="16.5" r="3.2" />
    <circle cx="18" cy="16.5" r="3.2" />
    <path d="M6 16.5 9.5 9h4l3 7.5" />
    <path d="M9.5 9h5.2M13.5 9l2.2-3h2.6" />
  </Glyph>
);

/** Maintenance: a spanner. */
export const IconMaintenance = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M15.4 4.2a4.8 4.8 0 0 0-5.9 6.2L4 15.9v3.4h3.4l5.5-5.5a4.8 4.8 0 0 0 6.2-5.9l-2.8 2.8-2.6-.7-.7-2.6z" />
  </Glyph>
);

/** Payments: a card with a stripe. */
export const IconPayments = (p: IconProps) => (
  <Glyph {...p}>
    <rect x="2.6" y="5.4" width="18.8" height="13.2" rx="2.2" />
    <path d="M2.6 10h18.8" />
    <path d="M6.4 14.6h3.6" />
  </Glyph>
);

/** Automations: a rule branching into two outcomes. */
export const IconAutomations = (p: IconProps) => (
  <Glyph {...p}>
    <circle cx="5.4" cy="12" r="2.4" />
    <circle cx="18.6" cy="6.4" r="2.4" />
    <circle cx="18.6" cy="17.6" r="2.4" />
    <path d="M7.8 11.1 16.3 7.3M7.8 12.9l8.5 3.8" />
  </Glyph>
);

/** Inbox: a tray with an arriving item. */
export const IconInbox = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3 13.4 5.8 5.2h12.4L21 13.4v5.4H3z" />
    <path d="M3 13.4h5l1.2 2.4h5.6l1.2-2.4h5" />
  </Glyph>
);

/** Reports: proportional bars. */
export const IconReports = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M3.4 20.4h17.2" />
    <path d="M7 20.4V12M12 20.4V5.6M17 20.4v-5.6" />
  </Glyph>
);

/** Notifications: a bell. */
export const IconBell = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M6.4 10.2a5.6 5.6 0 0 1 11.2 0c0 4 1.4 5.6 1.4 5.6H5s1.4-1.6 1.4-5.6z" />
    <path d="M10.2 19a2 2 0 0 0 3.6 0" />
  </Glyph>
);

/** Menu: three rules, for the compact navigation trigger. */
export const IconMenu = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Glyph>
);

export const IconClose = (p: IconProps) => (
  <Glyph {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Glyph>
);

import type { ModuleName } from "../types";

export const MODULE_ICONS: Record<ModuleName, (p: IconProps) => React.ReactElement> = {
  Overview: IconOverview,
  Leads: IconLeads,
  Customers: IconCustomers,
  Reservations: IconReservations,
  Contracts: IconContracts,
  Fleet: IconFleet,
  Maintenance: IconMaintenance,
  Payments: IconPayments,
  Automations: IconAutomations,
  Inbox: IconInbox,
  Reports: IconReports,
};
