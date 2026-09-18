/**
 * 05D — Customer locations.
 *
 * Not a map surface. `react-native-maps` is not a dependency of this app and
 * has no web target, and this app is verified by exporting to web and driving
 * a real browser — adding it would make the whole verification loop untestable
 * for one screen. Recorded in CHECKLIST.md rather than worked around.
 *
 * What this does instead is the part of the board that carries the value: the
 * accounts that have a pinned location, each opening in the device's own maps
 * app, where the person already has their route and their traffic. Accounts
 * with no pin are listed separately, because "not shown on the map" and "has
 * no location" look identical on a map and are very different problems.
 */
import React, { useMemo, useState } from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight, MapPin, Navigation } from "lucide-react-native";

import {
  AppBar,
  Card,
  Chip,
  EmptyState,
  Panel,
  Screen,
  SearchBar,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { color, radius, space } from "@/design/tokens";
import { longDate, moneyShort } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";

export default function CustomerMapScreen() {
  const router = useRouter();
  const source = useData();
  const [search, setSearch] = useState("");

  const state = useAsync(
    () => source.listCustomers({ search: search || undefined, limit: 100 }),
    [source, search],
  );

  const { pinned, unpinned } = useMemo(() => {
    const rows = state.data?.items ?? [];
    return {
      pinned: rows.filter((c) => c.locationUrl != null),
      unpinned: rows.filter((c) => c.locationUrl == null),
    };
  }, [state.data]);

  async function open(url: string) {
    try {
      if (!(await Linking.canOpenURL(url))) throw new Error("unsupported");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Cannot open maps", "This device has no maps app.");
    }
  }

  return (
    <Screen
      tabBarSpacing
      bleed
      onRefresh={state.reload}
      refreshing={state.refreshing}
    >
      <AppBar title="Customer Locations" />

      <View style={styles.body}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search customers"
        />

        {state.loading ? (
          <SkeletonList rows={5} />
        ) : (state.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            title="No customers match"
            body="Try a shorter search, or a different spelling."
            icon={<MapPin size={22} color={color.muted2} strokeWidth={2} />}
          />
        ) : (
          <>
            <Panel style={styles.summary}>
              <Text variant="caption" tone="muted">
                {pinned.length} of {state.data?.items.length} accounts have a
                pinned location. Tapping one opens it in your maps app.
              </Text>
            </Panel>

            {pinned.map((customer) => (
              <Card
                key={customer.id}
                onPress={() => open(customer.locationUrl!)}
                accessibilityLabel={`Open ${customer.name} in maps`}
                style={styles.row}
              >
                <View style={styles.rowInner}>
                  <View style={styles.plate}>
                    <Navigation
                      size={17}
                      color={color.primaryDark}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text variant="cardTitle" numberOfLines={1}>
                      {customer.name}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      {customer.area ?? "No area recorded"}
                      {customer.locationPinnedAt
                        ? ` · pinned ${longDate(customer.locationPinnedAt)}`
                        : ""}
                    </Text>
                  </View>
                  {customer.outstanding > 0 ? (
                    <Chip
                      label={moneyShort(customer.outstanding)}
                      tone="amber"
                    />
                  ) : null}
                </View>
              </Card>
            ))}

            {unpinned.length > 0 ? (
              <>
                <Text variant="section" style={styles.heading}>
                  No location pinned
                </Text>
                <Text variant="caption" tone="muted">
                  These accounts cannot be navigated to. Pin them from the web
                  console.
                </Text>
                {unpinned.map((customer) => (
                  <Card
                    key={customer.id}
                    onPress={() => router.push(`/customer/${customer.id}`)}
                    accessibilityLabel={customer.name}
                    style={styles.row}
                  >
                    <View style={styles.rowInner}>
                      <View style={[styles.plate, styles.plateMuted]}>
                        <MapPin size={17} color={color.muted} strokeWidth={2} />
                      </View>
                      <View style={styles.rowText}>
                        <Text variant="cardTitle" numberOfLines={1}>
                          {customer.name}
                        </Text>
                        <Text variant="caption" tone="muted" numberOfLines={1}>
                          {customer.area ?? "No area recorded"}
                        </Text>
                      </View>
                      <ChevronRight
                        size={15}
                        color={color.muted2}
                        strokeWidth={2}
                      />
                    </View>
                  </Card>
                ))}
              </>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.md },
  summary: {},
  heading: { marginTop: space.lg },
  row: { paddingVertical: space.md },
  rowInner: { flexDirection: "row", alignItems: "center", gap: space.md },
  rowText: { flex: 1, gap: 2 },
  plate: {
    width: 36,
    height: 36,
    borderRadius: radius.input,
    backgroundColor: color.mintSurface,
    alignItems: "center",
    justifyContent: "center",
  },
  plateMuted: { backgroundColor: color.lineSoft },
});
