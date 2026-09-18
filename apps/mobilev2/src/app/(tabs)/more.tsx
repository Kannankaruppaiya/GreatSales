/**
 * 11 — More / Sales Account.
 *
 * Account-level utilities and secondary navigation only. The design board is
 * explicit that no core sales workflow belongs here — those live in Home,
 * Pipeline, Customers and the + launcher.
 *
 * Rows that depend on a backend capability the API does not have are not shown
 * rather than shown-and-broken; see BACKEND_CAPABILITIES.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ChevronRight,
  CircleHelp,
  Info,
  Search,
  Settings,
  User,
  Bell,
} from "lucide-react-native";

import { Avatar, Card, IconPlate, Screen, Text } from "@/components/ui";
import { SyntheticBanner } from "@/components/ui/SyntheticBanner";
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

const ROWS: MenuRow[] = [
  {
    key: "profile",
    label: "My Profile",
    hint: "Your name, role and contact details",
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
    key: "search",
    label: "Search",
    hint: "Find across customers, leads and orders",
    href: "/search",
    Icon: Search,
  },
  {
    key: "settings",
    label: "App Settings",
    hint: "Language, theme and date format",
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

  const state = useAsync(() => source.getCurrentUser(), [source]);

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
        <Text variant="pageTitle">More</Text>
      </View>

      <SyntheticBanner />

      <Card style={styles.identity} onPress={() => router.push("/profile")}>
        <View style={styles.identityRow}>
          <Avatar name={state.data?.name ?? ""} size={48} />
          <View style={styles.identityText}>
            <Text variant="cardTitle">{state.data?.name ?? " "}</Text>
            <Text variant="caption" tone="muted">
              Sales
            </Text>
          </View>
          <ChevronRight size={18} color={color.muted2} strokeWidth={2} />
        </View>
      </Card>

      <View style={styles.list}>
        {ROWS.map((row) => (
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
                  <row.Icon
                    size={18}
                    color={color.primaryDark}
                    strokeWidth={2}
                  />
                </IconPlate>
                <View style={styles.menuText}>
                  <Text variant="cardTitle">{row.label}</Text>
                  <Text variant="caption" tone="muted">
                    {row.hint}
                  </Text>
                </View>
                <ChevronRight size={18} color={color.muted2} strokeWidth={2} />
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: space.sm },
  identity: { marginTop: space.xl },
  identityRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  identityText: { flex: 1, gap: 2 },
  list: { gap: space.md, marginTop: space.xl },
  menuCard: { padding: space.lg },
  menuRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  menuText: { flex: 1, gap: 2 },
});
