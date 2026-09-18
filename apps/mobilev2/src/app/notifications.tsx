/**
 * 11B — Notifications.
 *
 * Only the kinds the backend actually produces: follow-ups, leads, orders and
 * system messages. The spec's instruction was to implement only what is
 * supported, so there is no push-preference screen behind this and no
 * categories the API never sends.
 *
 * Read state is a real write — `markNotificationRead` — so tapping one marks
 * it, rather than only dimming it until the next launch.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Bell,
  CalendarCheck,
  Info,
  ShoppingCart,
  Target,
} from "lucide-react-native";

import {
  AppBar,
  Card,
  EmptyState,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import type { AppNotification } from "@/data/source";
import { color, radius, space } from "@/design/tokens";
import { longDate, timeOfDay } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

const ICONS: Record<AppNotification["kind"], typeof Bell> = {
  followup: CalendarCheck,
  lead: Target,
  order: ShoppingCart,
  system: Info,
};

export default function NotificationsScreen() {
  const router = useRouter();
  const source = useData();

  const state = useAsync(
    () => source.listNotifications({ limit: 50 }),
    [source],
  );
  const rows = state.data?.items ?? [];
  const unread = rows.filter((row) => !row.read).length;

  async function open(row: AppNotification) {
    if (!row.read) {
      await source.markNotificationRead(row.id);
      state.reload();
    }
    // Notifications carry no target id, so a tap marks it read and the person
    // goes where the text points them. Linking blind would guess.
    if (row.kind === "followup") router.push("/followups");
    else if (row.kind === "lead") router.push("/(tabs)/pipeline");
    else if (row.kind === "order") router.push("/orders");
  }

  return (
    <Screen
      tabBarSpacing
      bleed
      onRefresh={state.reload}
      refreshing={state.refreshing}
    >
      <AppBar title="Notifications" />

      <View style={styles.body}>
        {state.loading ? (
          <SkeletonList rows={5} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing new"
            body="Follow-up reminders, new leads and order updates will show up here."
            icon={<Bell size={22} color={color.muted2} strokeWidth={2} />}
          />
        ) : (
          <>
            {unread > 0 ? (
              <Text variant="caption" tone="muted">
                {unread} unread
              </Text>
            ) : null}

            {rows.map((row) => {
              const Icon = ICONS[row.kind];
              return (
                <Card
                  key={row.id}
                  onPress={() => open(row)}
                  accessibilityLabel={`${row.title}${row.read ? "" : ", unread"}`}
                  style={styles.row}
                >
                  <View style={styles.rowInner}>
                    <View
                      style={[styles.plate, row.read ? styles.plateRead : null]}
                    >
                      <Icon
                        size={17}
                        color={row.read ? color.muted : color.primaryDark}
                        strokeWidth={2}
                      />
                    </View>
                    <View style={styles.rowText}>
                      <Text
                        variant="cardTitle"
                        tone={row.read ? "muted" : "ink"}
                        numberOfLines={2}
                      >
                        {row.title}
                      </Text>
                      <Text variant="caption" tone="muted" numberOfLines={2}>
                        {row.body}
                      </Text>
                      <Text variant="nano" tone="muted2">
                        {longDate(row.at)}, {timeOfDay(row.at)}
                      </Text>
                    </View>
                    {!row.read ? <View style={styles.dot} /> : null}
                  </View>
                </Card>
              );
            })}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.md },
  row: { paddingVertical: space.md },
  rowInner: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  rowText: { flex: 1, gap: 2 },
  plate: {
    width: 36,
    height: 36,
    borderRadius: radius.input,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  plateRead: { backgroundColor: color.lineSoft },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: color.primary,
    marginTop: space.xs,
  },
});
