/**
 * The five primary destinations, and the single source of truth for them.
 * The desktop bar, the compact panel and the section anchors all read from
 * here, so the information architecture cannot drift between them.
 */

export type NavItem = {
  /** Section element id, and the IntersectionObserver target. */
  id: string;
  href: string;
  label: string;
  /** Displayed beside the label in the compact panel. */
  index: string;
};

export const NAV_ITEMS: NavItem[] = [
  { id: "systems", href: "#systems", label: "Systems", index: "01" },
  { id: "products", href: "#products", label: "Products", index: "02" },
  { id: "ai-learning", href: "#ai-learning", label: "AI Learning", index: "03" },
  { id: "lab", href: "#lab", label: "Lab", index: "04" },
  { id: "work", href: "#work", label: "Work", index: "05" },
];
