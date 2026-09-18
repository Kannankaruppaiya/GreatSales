/**
 * 11A — My Profile.
 *
 * What the account is, read from `getCurrentUser`. Nothing here is editable:
 * the write surface has no user-update method, because a salesperson's role,
 * territory and login are set by an administrator in the web console. An
 * editable-looking field that silently discards the change would be worse
 * than a plain one.
 *
 * The profile picture is the initials avatar the rest of the app uses. There
 * is no upload endpoint, so no upload control is offered.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Info, LogOut } from "lucide-react-native";

import {
  AppBar,
  Avatar,
  Button,
  Card,
  KeyValueRow,
  Panel,
  RowDivider,
  Screen,
  SkeletonList,
  Text,
} from "@/components/ui";
import { useData } from "@/data/provider";
import { color, space } from "@/design/tokens";
import { useAsync } from "@/lib/useAsync";

export default function ProfileScreen() {
  const router = useRouter();
  const source = useData();
  const state = useAsync(() => source.getCurrentUser(), [source]);
  const user = state.data ?? null;

  return (
    <Screen tabBarSpacing bleed>
      <AppBar title="My Profile" />

      <View style={styles.body}>
        {state.loading || !user ? (
          <SkeletonList rows={3} />
        ) : (
          <>
            <Card style={styles.identity}>
              <Avatar name={user.name} size={72} />
              <Text variant="section" align="center">
                {user.name}
              </Text>
              <Text variant="body" tone="muted" align="center">
                Field Sales
              </Text>
            </Card>

            <Panel style={styles.panel}>
              <KeyValueRow label="Email" value={user.email} />
              <RowDivider />
              <KeyValueRow label="Phone" value={user.phone} />
              <RowDivider />
              <KeyValueRow label="Role" value="Sales" />
            </Panel>

            <Panel>
              <View style={styles.noteRow}>
                <Info size={16} color={color.muted} strokeWidth={2} />
                <Text variant="caption" tone="muted" style={styles.noteText}>
                  Your name, role and contact details are managed by your
                  administrator in the web console.
                </Text>
              </View>
            </Panel>

            <Button
              label="Sign Out"
              variant="secondary"
              block
              icon={<LogOut size={16} color={color.primary} strokeWidth={2} />}
              onPress={() => router.replace("/login")}
              style={styles.signOut}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
  identity: { alignItems: "center", gap: space.sm, paddingVertical: space.xxl },
  panel: { paddingVertical: space.xs },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  noteText: { flex: 1 },
  signOut: { marginTop: space.md },
});
