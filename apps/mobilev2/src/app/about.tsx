/**
 * 11E — About.
 *
 * What this app is, which version is running, and where the data it is
 * showing comes from. The data-source line is the useful part: a screenshot
 * of a bug is far easier to place when it says whether the app was reading
 * generated rows or the live API.
 */
import React from "react";
import { Alert, Linking, StyleSheet, View } from "react-native";

import {
  AppBar,
  Card,
  KeyValueRow,
  Panel,
  RowDivider,
  Screen,
  Text,
} from "@/components/ui";
import { AppMark } from "@/components/brand/BrandMark";
import { API_BASE_URL, DATA_SOURCE } from "@/data/config";
import { space } from "@/design/tokens";
import { APP_NAME, APP_TAGLINE, APP_VERSION } from "@/lib/app-info";

const LEGAL_URL = "https://greatsales.app/legal";

export default function AboutScreen() {
  async function open(url: string) {
    try {
      if (!(await Linking.canOpenURL(url))) throw new Error("unsupported");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Cannot open the browser", url);
    }
  }

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="About" />

      <View style={styles.body}>
        <Card style={styles.identity}>
          <AppMark size={64} />
          <Text variant="hero" align="center">
            {APP_NAME}
          </Text>
          <Text variant="body" tone="muted" align="center">
            {APP_TAGLINE}
          </Text>
          <Text variant="caption" tone="muted2" align="center">
            Version {APP_VERSION}
          </Text>
        </Card>

        <Panel style={styles.panel}>
          <KeyValueRow label="Built for" value="Field sales" />
          <RowDivider />
          <KeyValueRow
            label="Data source"
            value={
              DATA_SOURCE === "synthetic" ? "Generated sample data" : "Live API"
            }
          />
          {DATA_SOURCE === "api" ? (
            <>
              <RowDivider />
              <KeyValueRow label="API" value={API_BASE_URL} />
            </>
          ) : null}
        </Panel>

        <Panel>
          <Text variant="body" tone="muted">
            GreatSales keeps a salesperson's day in one place: the pipeline, the
            customers behind it, what was ordered and what is still owed.
          </Text>
        </Panel>

        <Text
          variant="secondary"
          tone="primaryDark"
          align="center"
          onPress={() => open(LEGAL_URL)}
          style={styles.link}
        >
          Terms and privacy
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
  identity: { alignItems: "center", gap: space.sm, paddingVertical: space.xxl },
  panel: { paddingVertical: space.xs },
  link: { marginTop: space.md },
});
