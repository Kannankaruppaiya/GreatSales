/**
 * 11C — App Settings.
 *
 * Mobile preferences only, and only the ones this app can actually honour on
 * its own. The spec's instruction was not to invent settings that need
 * backend support they do not have, so what is absent is deliberate:
 *
 * - **Notification preferences.** There is no endpoint that stores them and no
 *   push registration in this app, so a toggle here would change nothing.
 * - **Language.** Nothing is translated yet. A picker offering a language the
 *   app cannot render is a promise it breaks on the next screen.
 *
 * What remains — theme and date format — the app applies itself. They are held
 * in this session only: a stored preference would need somewhere to store it,
 * and neither the API nor a settings table exists for it yet. The screen says
 * so rather than letting a setting quietly reset on the next launch.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { Info } from "lucide-react-native";

import {
  AppBar,
  Card,
  KeyValueRow,
  Panel,
  RowDivider,
  Screen,
  Text,
} from "@/components/ui";
import {
  usePreferences,
  DATE_FORMAT_LABELS,
  THEME_LABELS,
} from "@/lib/preferences";
import { OptionSheet, PickerField } from "@/components/form";
import { color, space } from "@/design/tokens";
import { useState } from "react";
import { APP_VERSION } from "@/lib/app-info";

export default function SettingsScreen() {
  const { theme, setTheme, dateFormat, setDateFormat } = usePreferences();
  const [sheet, setSheet] = useState<"theme" | "date" | null>(null);

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="App Settings" />

      <View style={styles.body}>
        <Text variant="section">Display</Text>

        <PickerField
          label="Theme"
          value={THEME_LABELS[theme]}
          placeholder="System"
          onPress={() => setSheet("theme")}
        />

        <PickerField
          label="Date format"
          value={DATE_FORMAT_LABELS[dateFormat]}
          placeholder="Choose a format"
          onPress={() => setSheet("date")}
        />

        <Panel>
          <View style={styles.noteRow}>
            <Info size={16} color={color.muted} strokeWidth={2} />
            <Text variant="caption" tone="muted" style={styles.noteText}>
              These apply for this session. There is no settings store on the
              server yet, so they reset when the app restarts.
            </Text>
          </View>
        </Panel>

        <Text variant="section" style={styles.heading}>
          About this app
        </Text>
        <Card flush>
          <View style={styles.panel}>
            <KeyValueRow label="Version" value={APP_VERSION} />
            <RowDivider />
            <KeyValueRow
              label="Notifications"
              value="Managed in the web console"
            />
            <RowDivider />
            <KeyValueRow label="Language" value="English" />
          </View>
        </Card>
      </View>

      <OptionSheet
        visible={sheet === "theme"}
        onClose={() => setSheet(null)}
        title="Theme"
        options={(
          Object.keys(THEME_LABELS) as (keyof typeof THEME_LABELS)[]
        ).map((value) => ({
          value,
          label: THEME_LABELS[value],
        }))}
        value={theme}
        onChange={setTheme}
      />
      <OptionSheet
        visible={sheet === "date"}
        onClose={() => setSheet(null)}
        title="Date format"
        options={(
          Object.keys(DATE_FORMAT_LABELS) as (keyof typeof DATE_FORMAT_LABELS)[]
        ).map((value) => ({ value, label: DATE_FORMAT_LABELS[value] }))}
        value={dateFormat}
        onChange={setDateFormat}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
  heading: { marginTop: space.md },
  panel: { paddingHorizontal: space.xl, paddingVertical: space.xs },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  noteText: { flex: 1 },
});
