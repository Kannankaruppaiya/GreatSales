/**
 * The four tab roots: Home | Pipeline | Customers | More.
 *
 * `Tabs` keeps each root's state alive while another is shown. Its own bar is
 * switched off: the app's single bottom navigation is drawn once, by the root
 * layout, over every signed-in screen — tab roots and the screens opened from
 * them alike — so there is exactly one navigator and it never differs.
 */
import React from "react";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={() => null}>
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="pipeline" options={{ title: "Pipeline" }} />
      <Tabs.Screen name="customers" options={{ title: "Customers" }} />
      <Tabs.Screen name="more" options={{ title: "More" }} />
    </Tabs>
  );
}
