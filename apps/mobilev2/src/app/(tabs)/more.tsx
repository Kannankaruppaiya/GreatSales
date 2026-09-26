/**
 * 11 — More / Sales Account.
 *
 * The bottom navigation has four places: Home, Pipeline, Customers, More. The
 * salesperson's other modules — sales orders, payments, recurring projections
 * and customer mappings — have no tab of their own, so this is their front
 * door, above the account and app rows. Before this they were reachable only
 * from inside one another (the orders list from an order, mappings from a
 * mapping), which is to say not at all from a fresh start.
 *
 * Every screen opened from here keeps the same bottom navigation, with More
 * highlighted, so the way back is always the tab the person came through.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bell,
  ChartColumn,
  ChevronRight,
  CircleHelp,
  IndianRupee,
  Info,
  Link2,
  LogOut,
  Settings,
  ShoppingCart,
  User,
} from "lucide-react-native";

import {
  Avatar,
  Button,
  Card,
  CountBadge,
  IconPlate,
  Screen,
  Text,
} from "@/components/ui";
import { signOut } from "@/data/session";
import { confirmAction } from "@/lib/confirm";
import { useData } from "@/data/provider";
import { color, space } from "@/design/tokens";
import { useAsync } from "@/lib/useAsync";

interface MenuRow {
  key: string;
  label: string;
  hint: string;
  href: string;
  Icon: typeof User;
}

const SALES_ROWS: MenuRow[] = [
  {
    key: "orders",
    label: "Sales Orders",
    hint: "Orders you raised and where each one is",
    href: "/orders",
    Icon: ShoppingCart,
  },
  {
    key: "payments",
    label: "Payments & Collections",
    hint: "Outstanding, overdue and aging — read only",
    href: "/payments",
    Icon: IndianRupee,
  },
  {
    key: "projections",
    label: "Recurring Projections",
    hint: "This month's commitments against achievement",
    href: "/projections",
    Icon: ChartColumn,
  },
  {
    key: "mappings",
    label: "Customer Mappings",
    hint: "Which customer buys which product, at what price",
    href: "/mappings",
    Icon: Link2,
  },
];

const ACCOUNT_ROWS: MenuRow[] = [
  {
    key: "profile",
    label: "My Profile",
    hint: "Your details and password",
    href: "/profile",
    Icon: User,
  },
  {
    key: "notifications",
    label: "Notifications",
    hint: "Follow-ups, leads and order updates",
    href: "/notifications",
    Icon: Bell,
  },
  {
    key: "settings",
    label: "App Settings",
    hint: "Theme and date format",
    href: "/settings",
    Icon: Settings,
  },
  {
    key: "help",
    label: "Help & Support",
    hint: "Answers to common questions",
    href: "/help",
    Icon: CircleHelp,
  },
  {
    key: "about",
    label: "About",
    hint: "Version and product information",
    href: "/about",
    Icon: Info,
  },
];

export default function MoreScreen() {
  const router = useRouter();
  const source = useData();
  const insets = useSafeAreaInsets();

  const state = useAsync(async () => {
    const [user, notifications] = await Promise.all([
      source.getCurrentUser(),
      source.listNotifications(),
    ]);
    return { user, unread: notifications.unread };
  }, [source]);
  const [signingOut, setSigningOut] = React.useState(false);

  async function leave() {
    const ok = await confirmAction({
      title: "Sign out?",
      message: "You will need your password to sign back in on this phone.",
      confirmLabel: "Sign Out",
    });
    if (!ok) return;
    setSigningOut(true);
    await signOut();
  }

  const renderRows = (rows: MenuRow[]) =>
    rows.map((row) => (
      <Pressable
        key={row.key}
        accessibilityRole="button"
        accessibilityLabel={row.label}
        accessibilityHint={row.hint}
        onPress={() => router.push(row.href as never)}
      >
        <Card style={styles.menuCard}>
          <View style={styles.menuRow}>
            <IconPlate size={36}>
              <row.Icon size={18} color={color.primaryDark} strokeWidth={2} />
            </IconPlate>
            <View style={styles.menuText}>
              <Text variant="cardTitle">{row.label}</Text>
              <Text variant="caption" tone="muted">
                {row.hint}
              </Text>
            </View>
            {row.key === "notifications" && state.data?.unread ? (
              <CountBadge count={state.data.unread} />
            ) : null}
            <ChevronRight size={18} color={color.muted2} strokeWidth={2} />
          </View>
        </Card>
      </Pressable>
    ));

  return (
    <Screen
      onRefresh={state.reload}
      refreshing={state.refreshing}
      error={state.error}
    >
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text variant="pageTitle">More</Text>
      </View>

      <Card style={styles.identity} onPress={() => router.push("/profile")}>
        <View style={styles.identityRow}>
          <Avatar name={state.data?.user.name ?? ""} size={48} />
          <View style={styles.identityText}>
            <Text variant="cardTitle">{state.data?.user.name ?? " "}</Text>
            <Text variant="caption" tone="muted">
              {state.data?.user.email ?? "Sales"}
            </Text>
          </View>
          <ChevronRight size={18} color={color.muted2} strokeWidth={2} />
        </View>
      </Card>

      <Text variant="section" style={styles.groupTitle}>
        Sales
      </Text>
      <View style={styles.list}>{renderRows(SALES_ROWS)}</View>

      <Text variant="section" style={styles.groupTitle}>
        Account
      </Text>
      <View style={styles.list}>{renderRows(ACCOUNT_ROWS)}</View>

      <Button
        label="Sign Out"
        variant="secondary"
        block
        loading={signingOut}
        icon={<LogOut size={16} color={color.primary} strokeWidth={2} />}
        onPress={leave}
        style={styles.signOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: space.sm },
  identity: { marginTop: space.xl },
  identityRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  identityText: { flex: 1, gap: 2 },
  groupTitle: { marginTop: space.xl },
  list: { gap: space.md, marginTop: space.md },
  signOut: { marginTop: space.xl },
  menuCard: { padding: space.lg },
  menuRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  menuText: { flex: 1, gap: 2 },
});
