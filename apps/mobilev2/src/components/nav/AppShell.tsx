/**
 * The signed-in shell: who may see which screen, and the one bottom navigation.
 *
 * Session: the stored refresh token is exchanged once at launch. Until that
 * answers, nothing routes. Then —
 *   - signed out, anywhere but the splash or sign-in → sign-in;
 *   - signed in with a reset password → change password, and nowhere else;
 *   - signed in on the splash → straight into the app.
 * The API enforces all of this itself; the shell only keeps the screens from
 * asking for data they would be refused.
 *
 * Navigation: `BottomNav` is drawn here, once, over every signed-in screen —
 * the tab roots and every list, detail and form opened from them — so the
 * navigator is the same object everywhere rather than a copy per screen. The
 * tab it highlights is the section the current screen belongs to. The + opens
 * Quick Actions over whatever is on screen and changes nothing underneath.
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { usePathname, useRouter, useSegments } from "expo-router";

import { Button, Text } from "@/components/ui";
import { describeError } from "@/data/http";
import { restoreSession, signOut, useSession } from "@/data/session";
import { color, space } from "@/design/tokens";

import { BottomNav, type TabKey } from "./BottomNav";
import { QuickActionsSheet } from "./QuickActionsSheet";

/** Screens a signed-out visitor may see. */
const PUBLIC = new Set(["", "index", "login", ...(__DEV__ ? ["penpot"] : [])]);

/** Screens that belong to the sign-in flow and carry no navigation. */
const NO_NAV = new Set([
  "",
  "index",
  "login",
  "location-permission",
  "preparing",
  // The dev-only Penpot gallery: every board draws its own navigation.
  "penpot",
]);

/** The section each screen belongs to, by its first path segment. */
const SECTION: Record<string, TabKey> = {
  home: "home",
  followups: "home",
  followup: "home",
  actions: "home",
  "sales-progress": "home",
  notifications: "home",
  search: "home",
  pipeline: "pipeline",
  lead: "pipeline",
  stages: "pipeline",
  "hot-opportunities": "pipeline",
  activity: "pipeline",
  customers: "customers",
  customer: "customers",
};

function sectionOf(first: string): TabKey {
  return SECTION[first] ?? "more";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const { status, user } = useSession();
  const [createOpen, setCreateOpen] = useState(false);
  const [restoreError, setRestoreError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  // Route groups like "(tabs)" are not part of the address.
  const route = segments.filter((s) => !s.startsWith("("));
  const first = route[0] ?? "";

  useEffect(() => {
    setRestoreError(null);
    restoreSession().catch((e: unknown) => setRestoreError(e));
  }, [attempt]);

  useEffect(() => {
    if (status === "unknown") return;
    if (status === "signedOut") {
      if (!PUBLIC.has(first)) router.replace("/login");
      return;
    }
    if (user?.mustChangePassword) {
      if (first !== "change-password") router.replace("/change-password");
      return;
    }
    if (first === "" || first === "index") router.replace("/preparing");
  }, [status, user?.mustChangePassword, first, router]);

  // Close the launcher when the screen changes under it.
  useEffect(() => setCreateOpen(false), [pathname]);

  if (status === "unknown") {
    // Offline at launch is not signed out: offer a retry, keep the session.
    return restoreError ? (
      <View style={styles.offline}>
        <Text variant="section" align="center">
          Can't reach GreatSales
        </Text>
        <Text variant="body" tone="muted" align="center">
          {describeError(restoreError)}
        </Text>
        <Button label="Try Again" onPress={() => setAttempt((n) => n + 1)} />
        <Button
          label="Sign Out"
          variant="tertiary"
          onPress={() => void signOut()}
        />
      </View>
    ) : (
      <View style={styles.hold} />
    );
  }

  const showNav =
    status === "signedIn" && !user?.mustChangePassword && !NO_NAV.has(first);

  return (
    <View style={styles.root}>
      {children}
      {showNav ? (
        <>
          <BottomNav
            active={sectionOf(first)}
            onSelect={(tab) => router.navigate(`/(tabs)/${tab}`)}
            onCreate={() => setCreateOpen(true)}
          />
          <QuickActionsSheet
            visible={createOpen}
            onClose={() => setCreateOpen(false)}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  hold: { flex: 1, backgroundColor: color.canvas },
  offline: {
    flex: 1,
    justifyContent: "center",
    padding: space.gutter,
    gap: space.lg,
    backgroundColor: color.canvas,
  },
});
