import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, buildQuery } from "@/lib/api";

/**
 * Wire types for the notifications API. Mirrors the `@greatsales/shared`
 * contracts; kept as a local copy so the Vite build does not need to consume
 * the CJS `shared` dist — the arrangement every feature here uses. Verified
 * against the running API by `pnpm contract`.
 */
export type NotificationType =
  | "FollowUpDue"
  | "PaymentReminder"
  | "LeadAssigned"
  | "CustomerAssigned"
  | "OrderUpdate"
  | "System";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  at: string;
  entityType: "Customer" | "Lead" | "Order" | "Payment" | null;
  entityId: string | null;
}

export interface NotificationListResponse {
  items: NotificationRow[];
  unread: number;
}

export const notificationKeys = {
  all: ["notifications"] as const,
};

/**
 * The bell's inbox.
 *
 * Polled rather than pushed. These are events another person caused, so
 * "whenever this tab happens to refetch" would mean a reassignment sits unseen
 * until the user navigates. A minute is short enough that the bell is useful
 * and long enough that it costs one small request per user per minute; a socket
 * is the right answer at a scale this product is not at.
 */
export function useNotifications(limit = 20) {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () =>
      apiFetch<NotificationListResponse>(
        `/notifications${buildQuery({ limit: String(limit) })}`,
      ),
    refetchInterval: 60_000,
    // The badge is the first thing a returning user looks at.
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<NotificationRow>(`/notifications/${id}/read`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ read: number }>("/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
