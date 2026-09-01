/**
 * Operations demo — notification services.
 *
 * Notifications are created by domain workflows and automation rules, never by
 * a screen. Reading them is the only thing a visitor does directly.
 */

import type { DemoRecord } from "@/demo-runtime/types";

import { C, P } from "../constants";
import type { Notification, NotificationCategory, Role } from "../types";
import { must, read, type OperationsContext } from "./context";

export type CreateNotificationInput = {
  category: NotificationCategory;
  title: string;
  body: string;
  actorRole?: Role;
  sourceEntityType?: string;
  sourceEntityId?: string;
};

/**
 * Build the record and the audit-free op for a notification.
 *
 * Returned rather than committed, so a workflow can raise its notification
 * inside the same transaction as the change that caused it — a notification
 * that survived a rolled-back mutation would be announcing something that
 * never happened.
 */
export function notificationOp(
  m: import("@/demo-runtime/runtime").MutationContext,
  input: CreateNotificationInput
): { record: DemoRecord<Notification>; id: string } {
  const id = m.nextId(C.notifications, P.notification);
  const record = m.record<Notification>(C.notifications, id, {
    ...(input.actorRole ? { actorRole: input.actorRole } : {}),
    category: input.category,
    title: input.title,
    body: input.body,
    read: false,
    ...(input.sourceEntityType ? { sourceEntityType: input.sourceEntityType } : {}),
    ...(input.sourceEntityId ? { sourceEntityId: input.sourceEntityId } : {}),
  });
  return { record, id };
}

export async function markNotificationRead(
  ctx: OperationsContext,
  notificationId: string
): Promise<DemoRecord<Notification>> {
  const notification = await ctx.runtime.repository.require<Notification>(
    C.notifications,
    notificationId
  );
  const result = await ctx.runtime.commit<DemoRecord<Notification>>((m) => {
    const record = m.record<Notification>(
      C.notifications,
      notificationId,
      { ...notification.data, read: true },
      notification
    );
    return { ops: [{ kind: "put", record }], data: record };
  });
  return result.data;
}

export async function markAllNotificationsRead(ctx: OperationsContext): Promise<number> {
  const all = await ctx.runtime.repository.all<Notification>(C.notifications);
  const unread = all.filter((n) => !n.data.read);
  if (unread.length === 0) return 0;

  const result = await ctx.runtime.commit<number>((m) => ({
    ops: unread.map((n) => ({
      kind: "put" as const,
      record: m.record<Notification>(C.notifications, n.id, { ...n.data, read: true }, n),
    })),
    data: unread.length,
  }));
  return result.data;
}

export async function unreadNotificationCount(ctx: OperationsContext): Promise<number> {
  const all = await ctx.runtime.repository.all<Notification>(C.notifications);
  return all.filter((n) => !n.data.read).length;
}

export async function listNotifications(
  ctx: OperationsContext
): Promise<DemoRecord<Notification>[]> {
  const all = await ctx.runtime.repository.all<Notification>(C.notifications);
  /* Newest first by id, which is also creation order because ids are a
     monotonic counter. */
  return [...all].sort((a, b) => b.id.localeCompare(a.id));
}

/* `must` and `read` are re-exported so notification consumers do not reach
   into the context module directly. */
export { must, read };
