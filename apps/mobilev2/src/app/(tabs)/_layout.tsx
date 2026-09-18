/**
 * The tabbed shell. Home | Pipeline | + | Customers | More.
 *
 * `Tabs` drives the routes; the bar itself is the design's own `BottomNav`
 * rather than the default one. The + is wired here, at the shell level, because
 * the Quick Actions sheet must sit above every tab and must not change which
 * tab is selected.
 */
import React, { useState } from "react";
import { Tabs, useRouter } from "expo-router";

import { BottomNav, type TabKey } from "@/components/nav/BottomNav";
import { QuickActionsSheet } from "@/components/nav/QuickActionsSheet";

export default function TabsLayout() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={({ state }) => {
          const active = (state.routeNames[state.index] ?? "home") as string;
          const key: TabKey =
            active === "home"
              ? "home"
              : active === "pipeline"
                ? "pipeline"
                : active === "customers"
                  ? "customers"
                  : "more";
          return (
            <BottomNav
              active={key}
              onSelect={(tab) => router.push(`/(tabs)/${tab}`)}
              onCreate={() => setCreateOpen(true)}
            />
          );
        }}
      >
        <Tabs.Screen name="home" options={{ title: "Home" }} />
        <Tabs.Screen name="pipeline" options={{ title: "Pipeline" }} />
        <Tabs.Screen name="customers" options={{ title: "Customers" }} />
        <Tabs.Screen name="more" options={{ title: "More" }} />
      </Tabs>

      <QuickActionsSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </>
  );
}
