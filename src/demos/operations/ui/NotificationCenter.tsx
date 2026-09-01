"use client";

/**
 * Operations demo — the notification centre.
 *
 * A disclosure button and a popover. The button is a real `<button>` carrying
 * `aria-expanded` and `aria-controls`; the panel is a labelled group that
 * closes on Escape or on a click outside, and returns focus to the trigger
 * when it does.
 *
 * Items do not link anywhere yet. Their `sourceEntityId` is stored and correct,
 * but the modules those ids point at do not exist until 09C3 onward, and a link
 * to a 404 would be worse than no link. Navigation arrives with the routes.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useDemoQuery } from "@/demo-runtime/react/hooks";
import type { DemoRecord } from "@/demo-runtime/types";

import * as notificationService from "../services/notifications";
import type { Notification } from "../types";
import { IconBell } from "./icons";
import { useOperations } from "./OperationsProvider";

const PANEL_ID = "ops-notifications-panel";

export default function NotificationCenter() {
  const { ctx } = useOperations();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Deliberately not keyed on `open`. Keying it there would discard the
     settled result every time the panel is toggled, so opening it would show
     an empty list for a frame before refilling. The runtime's revision
     already refetches this whenever a notification changes. */
  const { data } = useDemoQuery(
    async () => (ctx ? notificationService.listNotifications(ctx) : []),
    []
  );
  const notifications: DemoRecord<Notification>[] = data ?? [];
  const unread = notifications.filter((n) => !n.data.read).length;

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  /* Escape closes, and a pointer outside dismisses. Both are what a disclosure
     popover is expected to do; neither is worth a dependency. */
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
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  const markOne = async (id: string) => {
    if (!ctx) return;
    await notificationService.markNotificationRead(ctx, id);
  };

  const markAll = async () => {
    if (!ctx) return;
    await notificationService.markAllNotificationsRead(ctx);
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
            <button
              type="button"
              className="ops-notify__action"
              onClick={markAll}
              disabled={unread === 0}
            >
              Mark all read
            </button>
          </div>

          <ul className="ops-notify__list">
            {notifications.slice(0, 12).map((n) => (
              <li
                key={n.id}
                className={`ops-notify__item${n.data.read ? "" : " ops-notify__item--unread"}`}
              >
                <div className="ops-notify__item-body">
                  <p className="ops-notify__category">{n.data.category}</p>
                  <p className="ops-notify__item-title">{n.data.title}</p>
                  <p className="ops-notify__item-text">{n.data.body}</p>
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
      )}
    </div>
  );
}
