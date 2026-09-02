"use client";

/**
 * Operations demo: the notification centre.
 *
 * A disclosure button and a popover. The button is a real `<button>` carrying
 * `aria-expanded` and `aria-controls`; the panel is a labelled group that
 * closes on Escape or on a click outside, and returns focus to the trigger
 * when it does.
 *
 * An item links to its source when that module exists and this role can open
 * it. Three do as of 09C3.3: a lead, a customer and a conversation. The rest
 * stay plain text, because a link to a route that 404s is worse than no link,
 * and each becomes navigable as its own stage builds it (D-085).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { useDemoQuery } from "@/demo-runtime/react/hooks";
import type { DemoRecord } from "@/demo-runtime/types";

import * as notificationService from "../services/notifications";
import type { Notification, Role } from "../types";
import { IconBell } from "./icons";
import { useOperations } from "./OperationsProvider";
import { canViewModule } from "../permissions";
import type { ModuleName } from "../types";
import { canSeeNotification } from "./overview-policy";
import { lockPageScroll } from "./scroll-lock";

const PANEL_ID = "ops-notifications-panel";

/**
 * The source types that have a screen to open, and the module each belongs to.
 *
 * Keyed by the `sourceEntityType` the services already store. A type absent
 * from this table is not a bug: it means that module is not built, so the item
 * names its source without offering a way there.
 */
const SOURCE_ROUTES: Record<string, { module: ModuleName; href: (id: string) => string }> = {
  lead: {
    module: "Leads",
    href: (id) => `/demos/operations/leads?selected=${encodeURIComponent(id)}`,
  },
  customer: {
    module: "Customers",
    href: (id) => `/demos/operations/customers?selected=${encodeURIComponent(id)}`,
  },
  conversation: {
    module: "Inbox",
    href: (id) => `/demos/operations/inbox?selected=${encodeURIComponent(id)}`,
  },
};

export default function NotificationCenter() {
  const { ctx, role } = useOperations();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Deliberately not keyed on `open`. Keying it there would discard the
     settled result every time the panel is toggled, so opening it would show
     an empty list for a frame before refilling. The runtime's revision
     already refetches this whenever a notification changes. */
  const { data } = useDemoQuery(
    async () => (ctx ? notificationService.listNotifications(ctx) : []),
    [role]
  );
  /* Filtered by role, and the badge counts the filtered set.
     A notification names the area it came from, so a role that cannot open
     that area must not be told about it, and must not be shown a count that
     includes it. Counting the unfiltered set was a leak: Finance saw a badge
     of eight while its own list held three. */
  const notifications: DemoRecord<Notification>[] = (data ?? []).filter((n) =>
    canSeeNotification(role, n.data.category)
  );
  const unread = notifications.filter((n) => !n.data.read).length;

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  /* Escape closes, and a pointer outside dismisses. Both are what a disclosure
     is expected to do; neither is worth a dependency.

     On a phone the panel is a sheet rather than a popover, so it also measures
     where it starts and locks the page behind it. The height is set from that
     measurement in dynamic viewport units, because a phone's collapsing
     address bar changes the usable height and a fixed figure would cut the
     last row off. */
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    const sheet = window.matchMedia("(max-width: 767px)").matches;
    const measure = () => {
      const bar = document.querySelector(".ops-topbar");
      const bottom = bar ? bar.getBoundingClientRect().bottom : 120;
      document.documentElement.style.setProperty("--ops-sheet-top", `${Math.round(bottom + 8)}px`);
    };

    /* The page behind a sheet should not scroll with it. Taken through the
       shared counter rather than written directly: the Leads module puts its
       own sheets on the same page, and whichever closed first used to restore
       scrolling underneath one that was still open. */
    let releaseScroll: (() => void) | null = null;
    if (sheet) {
      measure();
      window.addEventListener("resize", measure);
      releaseScroll = lockPageScroll();
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      if (sheet) {
        window.removeEventListener("resize", measure);
        releaseScroll?.();
      }
    };
  }, [open, close]);

  const markOne = async (id: string) => {
    if (!ctx) return;
    await notificationService.markNotificationRead(ctx, id);
  };

  /* Marks only what this role can see, so "mark all read" clears the badge it
     is attached to rather than silently touching another area's items. */
  const markAll = async () => {
    if (!ctx) return;
    for (const n of notifications.filter((x) => !x.data.read)) {
      await notificationService.markNotificationRead(ctx, n.id);
    }
  };

  return (
    <div className="ops-notify">
      <button
        ref={triggerRef}
        type="button"
        className="ops-notify__trigger"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications, none unread"
        }
        onClick={() => setOpen((v) => !v)}
      >
        <IconBell />
        {unread > 0 && (
          <span className="ops-notify__badge" aria-hidden="true">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Phone only: dismisses on a tap outside and reads the page behind
              as inert. Desktop keeps the lighter outside-click dismiss. */}
          <button
            type="button"
            className="ops-notify__scrim"
            aria-label="Close notifications"
            onClick={close}
          />
          <div
            ref={panelRef}
            id={PANEL_ID}
            className="ops-notify__panel"
            role="group"
            aria-label="Notifications"
          >
            <div className="ops-notify__head">
              <p className="ops-notify__title">
                Notifications
                <span className="ops-notify__count">
                  {unread > 0 ? `${unread} unread` : "all read"}
                </span>
              </p>
              <span className="ops-notify__actions">
                <button
                  type="button"
                  className="ops-notify__action"
                  onClick={markAll}
                  disabled={unread === 0}
                >
                  Mark all read
                </button>
                <button type="button" className="ops-notify__close" onClick={close}>
                  Close
                </button>
              </span>
            </div>

            <ul className="ops-notify__list">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={`ops-notify__item${n.data.read ? "" : " ops-notify__item--unread"}`}
                >
                  <div className="ops-notify__item-body">
                    <p className="ops-notify__category">{n.data.category}</p>
                    <p className="ops-notify__item-title">{n.data.title}</p>
                    <p className="ops-notify__item-text">{n.data.body}</p>
                    <SourceLink notification={n.data} role={role} onNavigate={close} />
                  </div>
                  {!n.data.read && (
                    <button
                      type="button"
                      className="ops-notify__mark"
                      onClick={() => markOne(n.id)}
                    >
                      Mark read
                    </button>
                  )}
                </li>
              ))}
              {notifications.length === 0 && (
                <li className="ops-notify__empty">No notifications.</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The way to the record a notification is about, when there is one.
 *
 * Two conditions, both necessary: the module exists, and this role may open
 * it. A Finance Analyst never sees a CRM notification at all, but the check is
 * made here as well rather than trusted upstream, because a link is a way in
 * and a way in is exactly the thing worth checking twice.
 */
function SourceLink({
  notification,
  role,
  onNavigate,
}: {
  notification: Notification;
  role: Role;
  onNavigate: () => void;
}) {
  const { sourceEntityType, sourceEntityId } = notification;
  if (!sourceEntityType || !sourceEntityId) return null;
  const route = SOURCE_ROUTES[sourceEntityType];
  if (!route || !canViewModule(role, route.module)) return null;

  return (
    <Link
      className="ops-link-button ops-notify__source"
      href={route.href(sourceEntityId)}
      onClick={onNavigate}
    >
      Open {sourceEntityType}
    </Link>
  );
}
