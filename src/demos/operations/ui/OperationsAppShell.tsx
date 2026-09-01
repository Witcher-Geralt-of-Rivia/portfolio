"use client";

/**
 * Operations demo — the application shell.
 *
 * Sits inside the shared demo chrome and owns everything below it: the
 * sidebar, the top bar and the content area. It supplies the role control into
 * the shared chrome's slot rather than drawing a second one, so there is one
 * place to change role and the domain sees the same value the bar shows.
 *
 * Below 1180px the sidebar becomes a drawer with focus management; below
 * 768px the product gets its own compact bar. There is no state in which both
 * navigations are on screen.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";

import DemoShell from "@/components/demos/DemoShell";
import { useDemoRuntimeContext } from "@/demo-runtime/react/DemoRuntimeProvider";
import { useDemoSession } from "@/demo-runtime/react/hooks";

import { ROLES, type ModuleName, type Role } from "../types";
import { IconClose, IconMenu } from "./icons";
import NotificationCenter from "./NotificationCenter";
import { useOperations } from "./OperationsProvider";
import OperationsSidebar from "./OperationsSidebar";

/**
 * The role control, placed into the shared chrome's slot.
 *
 * Labelled "Demo role" so nothing here reads as signing in. A polite live
 * region announces the change, because switching role rewrites the navigation
 * and the dashboard without moving focus.
 */
function RoleControl({ onAnnounce }: { onAnnounce: (message: string) => void }) {
  const session = useDemoSession();
  const id = useId();

  return (
    <span className="ops-role">
      <label className="visually-hidden" htmlFor={id}>
        Demo role
      </label>
      <select
        id={id}
        className="demo-chrome__action ops-role__select"
        value={session.activeRole}
        onChange={(e) => {
          const role = e.target.value;
          session.setRole(role);
          onAnnounce(`Demo role changed to ${role}`);
        }}
      >
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
    </span>
  );
}

export default function OperationsAppShell({
  activeModule,
  title,
  context,
  children,
}: {
  activeModule: ModuleName;
  title: string;
  context: string;
  children: React.ReactNode;
}) {
  const { role, actorName, initials } = useOperations();
  const { status, persistenceMode, error, retry } = useDemoRuntimeContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    triggerRef.current?.focus();
  }, []);

  /* Escape closes the drawer and focus returns to the trigger. Focus is moved
     into the drawer on open so a keyboard user is not left behind it. */
  useEffect(() => {
    if (!drawerOpen) return;
    const first = drawerRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  if (status === "error") {
    return (
      <DemoShell roleControl={<RoleControl onAnnounce={setAnnouncement} />}>
        <div className="ops-fatal">
          <h1 className="ops-fatal__title">The demo could not start</h1>
          <p className="ops-fatal__text">
            {error?.message ?? "Browser storage is unavailable in this context."}
          </p>
          <button type="button" className="ops-button" onClick={retry}>
            Reload demo
          </button>
        </div>
      </DemoShell>
    );
  }

  return (
    <DemoShell roleControl={<RoleControl onAnnounce={setAnnouncement} />}>
      <div className="ops-app">
        {/* Desktop and tablet: a persistent column above 1180px, a drawer
            below it. One element, two presentations, so the two navigations
            can never both be on screen. */}
        <div
          className={`ops-app__nav${drawerOpen ? " ops-app__nav--open" : ""}`}
          ref={drawerRef}
        >
          <OperationsSidebar
            role={role}
            activeModule={activeModule}
            onNavigate={() => setDrawerOpen(false)}
          />
          <button
            type="button"
            className="ops-app__nav-close"
            onClick={closeDrawer}
            aria-label="Close navigation"
          >
            <IconClose />
          </button>
        </div>

        {drawerOpen && (
          <button
            type="button"
            className="ops-app__scrim"
            aria-label="Close navigation"
            onClick={closeDrawer}
          />
        )}

        <div className="ops-app__main">
          <header className="ops-topbar">
            <button
              ref={triggerRef}
              type="button"
              className="ops-topbar__menu"
              aria-expanded={drawerOpen}
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
            >
              <IconMenu />
            </button>

            <div className="ops-topbar__context">
              {/* The product names itself here now, on phones, because the
                  provenance bar above no longer does. On desktop the sidebar
                  carries it and this stays the page title alone. */}
              <p className="ops-topbar__product">Operations Console</p>
              <h1 className="ops-topbar__title">{title}</h1>
              <p className="ops-topbar__sub">{context}</p>
            </div>

            <div className="ops-topbar__tools">
              {persistenceMode === "memory" && (
                <p className="ops-topbar__notice">Session only</p>
              )}
              <NotificationCenter />
              <div className="ops-actor">
                <span className="ops-actor__initials" aria-hidden="true">
                  {initials}
                </span>
                <span className="ops-actor__text">
                  <span className="ops-actor__name">{actorName}</span>
                  <span className="ops-actor__role">{role}</span>
                </span>
              </div>
            </div>
          </header>

          {/* A div, not a <main>. SiteShell already renders the document's
              main landmark, and a second one gives assistive technology two
              answers to "where does the content start?". The route's own <h1>
              sits inside that single landmark, which is what §92 is after. */}
          <div className="ops-content">
            <div className="ops-content__inner">{children}</div>
          </div>
        </div>
      </div>

      {/* One polite region for role changes and reset confirmation. */}
      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </DemoShell>
  );
}

export type { Role };
