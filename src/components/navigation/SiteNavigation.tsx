"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import DesktopNavigation from "./DesktopNavigation";
import MobileNavigation from "./MobileNavigation";
import { NAV_ITEMS } from "./nav-items";

/**
 * The only client component in the navigation.
 *
 * It owns exactly five behaviours: compact menu state, focus management,
 * active-section tracking, Escape handling and the body scroll lock.
 * Everything visual — hover, active styling, the panel transition, the
 * icon morph — is CSS. Nothing here runs on a timer or a scroll event,
 * so an idle page does no navigation work at all.
 */
export default function SiteNavigation() {
  /* Empty until a section actually reaches the detection band, so the
     hero reads as its own place rather than lighting up Systems. */
  const [activeId, setActiveId] = useState("");
  const [open, setOpen] = useState(false);

  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((value) => !value), []);

  /* Active section. IntersectionObserver only — no scroll listener. */
  useEffect(() => {
    const intersecting = new Map<string, boolean>();
    const targets = NAV_ITEMS.map((item) =>
      document.getElementById(item.id)
    ).filter((el): el is HTMLElement => el !== null);

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          intersecting.set(entry.target.id, entry.isIntersecting);
        }
        /* Resolving in document order guarantees a single active item
           even while two sections overlap the detection band. Sections are
           contiguous, so "nothing intersecting" only happens above the
           first one — at the hero — where nothing should be active. */
        const current = NAV_ITEMS.find((item) => intersecting.get(item.id));
        setActiveId(current ? current.id : "");
      },
      { rootMargin: "-30% 0px -55% 0px" }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  /* Escape closes the panel; Tab is confined to the trigger plus panel. */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = [
        toggleRef.current,
        ...Array.from(
          panelRef.current?.querySelectorAll<HTMLElement>("a[href]") ?? []
        ),
      ].filter((el): el is HTMLElement => el !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || active === null || !focusable.includes(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  /* Scroll lock. The scrollbar gutter is reserved permanently in
     globals.css, so removing the scrollbar cannot shift layout. */
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("nav-locked");
    return () => document.body.classList.remove("nav-locked");
  }, [open]);

  /* Focus enters the panel on open and returns to the trigger on close —
     but only when this component was the thing that moved it. */
  useEffect(() => {
    if (open) {
      panelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    } else if (wasOpen.current) {
      toggleRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  /* Crossing up to the desktop breakpoint hides the panel in CSS, so the
     open state has to be dropped or the scroll lock would outlive it. */
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 900px)");
    const onChange = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="site-nav">
      <DesktopNavigation activeId={activeId} />
      <MobileNavigation
        open={open}
        activeId={activeId}
        onToggle={toggle}
        onNavigate={close}
        toggleRef={toggleRef}
        panelRef={panelRef}
      />
    </div>
  );
}
