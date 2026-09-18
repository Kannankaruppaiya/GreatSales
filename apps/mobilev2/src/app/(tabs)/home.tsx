/**
 * 02 — Home.
 *
 * Built from the Penpot board "02E.1 Home Screen": brand bar, greeting, date
 * and territory chips, Today's Focus KPI tiles, Quick Actions, and the upcoming
 * follow-ups stream.
 *
 * Every figure here is derived from the data source's `getHomeSummary()` — none
 * is written into the screen. That is deliberate: the previous mobile rewrite
 * put its numbers in the JSX, and they were later read as the tenant's own.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  CalendarDays,
  ClipboardList,
  MapPin,
  Phone,
  ShoppingCart,
  Target,
  UserPlus,
} from "lucide-react-native";

import {
  Avatar,
  Card,
  Chip,
  CountBadge,
  IconPlate,
  Panel,
  Screen,
  SectionHeader,
  SkeletonList,
  StatusDot,
  Text,
} from "@/components/ui";
import { Wordmark } from "@/components/brand/BrandMark";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";
import { useData } from "@/data/provider";
import { color, icon, radius, space } from "@/design/tokens";
import { dueLabel, longDate } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

/** The design's greeting changes with the hour; it is not a stored string. */
function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good Morning,";
  if (hour < 17) return "Good Afternoon,";
  return "Good Evening,";
}

export default function HomeScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  const state = useAsync(async () => {
    const [user, summary, followUps, notifications] = await Promise.all([
      source.getCurrentUser(),
      source.getHomeSummary(),
      source.listFollowUps({ bucket: "today", limit: 3 }),
      source.listNotifications({ limit: 50 }),
    ]);
    // "Upcoming" on this screen means the next few things the user has to do:
    // today's list first, topped up from the days ahead when today is clear.
    const upcoming =
      followUps.items.length >= 3
        ? followUps
        : await source.listFollowUps({ bucket: "upcoming", limit: 3 });

    return {
      user,
      summary,
      upcoming: upcoming.items,
      unread: notifications.items.filter((n) => !n.read).length,
    };
  }, [source]);

  const now = new Date();

  return (
    <Screen onRefresh={state.reload} refreshing={state.refreshing}>
      <View style={[styles.brandBar, { paddingTop: insets.top + space.sm }]}>
        <Wordmark />
        <View style={styles.brandActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              state.data?.unread
                ? `Notifications, ${state.data.unread} unread`
                : "Notifications"
            }
            onPress={() => router.push("/notifications")}
            hitSlop={8}
          >
            <Bell size={22} color={color.ink} strokeWidth={icon.strokeWidth} />
            <View style={styles.bellBadge}>
              <CountBadge count={state.data?.unread ?? 0} />
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="My profile"
            onPress={() => router.push("/profile")}
          >
            <Avatar name={state.data?.user.name ?? ""} size={36} />
          </Pressable>
        </View>
      </View>

      <SyntheticBanner />

      <View style={styles.greeting}>
        <Text variant="body" tone="muted">
          {greeting(now)}
        </Text>
        <Text variant="hero">{state.data?.user.name ?? " "}</Text>
      </View>

      <View style={styles.contextChips}>
        <Chip
          label={longDate(now)}
          tone="neutral"
          icon={<CalendarDays size={13} color={color.muted} strokeWidth={2} />}
        />
        <Chip
          label="My territory"
          tone="neutral"
          icon={<MapPin size={13} color={color.muted} strokeWidth={2} />}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Today's Focus"
          actionLabel="View All"
          onAction={() => router.push("/followups")}
        />
        {state.loading ? (
          <SkeletonList rows={1} />
        ) : (
          <View style={styles.kpiRow}>
            <KpiTile
              value={state.data?.summary.followUpsDue ?? 0}
              label="Follow-ups"
              caption={
                state.data?.summary.overdueFollowUps
                  ? `${state.data.summary.overdueFollowUps} overdue`
                  : undefined
              }
              // Red tint only when something genuinely is overdue.
              tone={state.data?.summary.overdueFollowUps ? "red" : "mint"}
              onPress={() => router.push("/followups")}
            />
            <KpiTile
              value={state.data?.summary.siteVisits ?? 0}
              label="Site Visits"
              tone="mint"
              onPress={() => router.push("/followups")}
            />
            <KpiTile
              value={state.data?.summary.proposals ?? 0}
              label="Proposals"
              tone="steel"
              onPress={() => router.push("/(tabs)/pipeline")}
            />
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Quick Actions" />
        <View style={styles.actionRow}>
          <QuickAction
            label="Add Lead"
            Icon={Target}
            onPress={() => router.push("/lead/new")}
          />
          <QuickAction
            label="Log Visit"
            Icon={MapPin}
            onPress={() => router.push("/followup/new?kind=visit")}
          />
          <QuickAction
            label="New Order"
            Icon={ShoppingCart}
            onPress={() => router.push("/order/new")}
          />
          <QuickAction
            label="Add Customer"
            Icon={UserPlus}
            onPress={() => router.push("/customer/new")}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Upcoming Follow-ups"
          actionLabel="View All"
          onAction={() => router.push("/followups")}
        />
        {state.loading ? (
          <SkeletonList rows={3} />
        ) : state.data && state.data.upcoming.length > 0 ? (
          <View style={styles.followUpList}>
            {state.data.upcoming.map((followUp) => (
              <Card
                key={followUp.id}
                onPress={() => router.push(`/followup/${followUp.id}`)}
                accessibilityLabel={`${followUp.customerName}, ${followUp.purpose}`}
                style={styles.followUpCard}
                flush
              >
                <View style={styles.followUpRow}>
                  <View style={styles.followUpWhen}>
                    <StatusDot
                      tone={new Date(followUp.dueAt) < now ? "red" : "mint"}
                    />
                    <Text variant="micro" tone="muted">
                      {dueLabel(followUp.dueAt)}
                    </Text>
                  </View>
                  <Avatar name={followUp.customerName} size={34} />
                  <View style={styles.followUpText}>
                    <Text variant="cardTitle" numberOfLines={1}>
                      {followUp.customerName}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {followUp.purpose}
                    </Text>
                  </View>
                  <Phone size={17} color={color.primary} strokeWidth={2} />
                </View>
              </Card>
            ))}
          </View>
        ) : (
          <Panel>
            <Text variant="body" tone="muted">
              Nothing scheduled. Add a follow-up from the + button to keep the
              pipeline moving.
            </Text>
          </Panel>
        )}
      </View>
    </Screen>
  );
}

function KpiTile({
  value,
  label,
  caption,
  tone,
  onPress,
}: {
  value: number;
  label: string;
  caption?: string;
  tone: "mint" | "red" | "steel";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}${caption ? `, ${caption}` : ""}`}
      onPress={onPress}
      style={styles.kpiPressable}
    >
      <Panel tone={tone} style={styles.kpiTile}>
        <Text variant="display" tone={tone === "red" ? "redDark" : "ink"}>
          {value}
        </Text>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        {caption ? (
          <Text variant="nano" tone="redDark">
            {caption}
          </Text>
        ) : null}
      </Panel>
    </Pressable>
  );
}

function QuickAction({
  label,
  Icon,
  onPress,
}: {
  label: string;
  Icon: typeof Target;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.quickAction}
    >
      <IconPlate size={46}>
        <Icon size={20} color={color.primaryDark} strokeWidth={2} />
      </IconPlate>
      <Text variant="caption" tone="muted" align="center">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: space.md,
  },
  brandActions: { flexDirection: "row", alignItems: "center", gap: space.md },
  bellBadge: { position: "absolute", top: -4, right: -6 },
  greeting: { marginTop: space.sm, gap: 2 },
  contextChips: { flexDirection: "row", gap: space.sm, marginTop: space.md },
  section: { marginTop: space.xxl },
  kpiRow: { flexDirection: "row", gap: space.md },
  kpiPressable: { flex: 1 },
  kpiTile: { gap: 2, minHeight: 92, justifyContent: "center" },
  actionRow: { flexDirection: "row", justifyContent: "space-between" },
  quickAction: { alignItems: "center", gap: space.sm, width: 70 },
  followUpList: { gap: space.md },
  followUpCard: { padding: space.lg, borderRadius: radius.listCard },
  followUpRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  followUpWhen: { width: 58, gap: 4 },
  followUpText: { flex: 1, gap: 2 },
});
