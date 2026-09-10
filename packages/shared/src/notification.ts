import { z } from "zod";

/**
 * Notifications — the things that happened to you while you were not looking.
 *
 * The console's bell already showed two live alerts, computed in the browser
 * from every follow-up and every payment it had loaded: what is overdue, and
 * which customers are in the red zone. Those are STATE. They are correct as
 * derived values and they stay derived — a stored row saying "this is overdue"
 * would be a copy that goes stale the moment somebody completes the follow-up.
 *
 * What the bell could not show is EVENTS: a lead handed to you, an account
 * moved to you, an order you own moving to Delivered. Nothing on any screen
 * tells you those happened, because by the time you look, the screen shows only
 * the result. That is what these rows are for, and it is why the table exists.
 *
 * One rule governs every emitter: a notification is never sent to the person
 * who caused it. A bell that tells you what you just did is a bell people learn
 * to ignore, and once ignored it stops working for the things that matter.
 */

export const NOTIFICATION_TYPES = [
  "FollowUpDue",
  "PaymentReminder",
  "LeadAssigned",
  "CustomerAssigned",
  "OrderUpdate",
  "System",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  /** Optional second line. Null when the title says everything. */
  body: string | null;
  read: boolean;
  /** ISO 8601. */
  at: string;
  /**
   * Where this notification is about, so the bell can navigate.
   *
   * An alert you cannot click is a label, not a notification — the console's
   * derived alerts already follow that rule and these must too.
   */
  entityType: "Customer" | "Lead" | "Order" | "Payment" | null;
  entityId: string | null;
}

export interface NotificationListResponse {
  items: NotificationRow[];
  /**
   * Unread across the WHOLE inbox, not just the page above.
   *
   * The badge counts everything waiting; if it counted only what was fetched it
   * would read "20" forever on a busy workspace and stop meaning anything.
   */
  unread: number;
}

export const NotificationListQuerySchema = z.object({
  unreadOnly: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === "true"),
  /** The bell shows a short list; the cap keeps a busy inbox from paging. */
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});
export type NotificationListQuery = z.infer<
  typeof NotificationListQuerySchema
>;
