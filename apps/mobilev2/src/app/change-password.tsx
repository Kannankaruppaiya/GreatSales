/**
 * Change password.
 *
 * Reached two ways: from My Profile, and — without a way around it — straight
 * after signing in with a password an administrator reset. The API refuses
 * every other request from an account flagged `mustChangePassword`, so without
 * this screen a rep given a temporary password would be locked out of the app
 * until someone cleared the flag on the web.
 *
 * The new password is checked against the same policy the API enforces
 * (`validatePassword` in @greatsales/shared) before it is sent, so the rep
 * sees the reason as they type rather than after a round trip. The server
 * checks again; this is a convenience, not the rule.
 */
import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Lock } from "lucide-react-native";
import {
  PASSWORD_FAILURE_MESSAGE,
  PASSWORD_MIN,
  validatePassword,
} from "@greatsales/shared";

import { AppBar, Button, Input, Panel, Screen, Text } from "@/components/ui";
import { ApiError, describeError } from "@/data/http";
import { changePassword, signOut, useSession } from "@/data/session";
import { color, space } from "@/design/tokens";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user } = useSession();
  const forced = user?.mustChangePassword ?? false;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const policy = useMemo(
    () =>
      next
        ? validatePassword(next, {
            name: user?.name,
            email: user?.email,
            username: user?.username ?? undefined,
          })
        : null,
    [next, user],
  );
  const mismatch = confirm.length > 0 && confirm !== next;
  const ready =
    current.length > 0 && policy?.ok === true && confirm === next && !saving;

  async function save() {
    if (!ready) return;
    setSaving(true);
    setError(null);
    try {
      await changePassword(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      if (forced) router.replace("/location-permission");
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 401
          ? "Your current password is not right."
          : describeError(e),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen bleed tabBarSpacing={!forced}>
      <AppBar title="Change Password" showBack={!forced} />

      <View style={styles.body}>
        {forced ? (
          <Panel tone="amber">
            <Text variant="body">
              Your administrator reset your password. Choose your own to
              continue.
            </Text>
          </Panel>
        ) : null}

        <Input
          label={forced ? "Temporary password" : "Current password"}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          autoComplete="current-password"
          icon={<Lock size={18} color={color.muted2} strokeWidth={2} />}
        />
        <Input
          label="New password"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters, not your name or email`}
          error={
            policy && !policy.ok
              ? PASSWORD_FAILURE_MESSAGE[policy.reason]
              : undefined
          }
          icon={<Lock size={18} color={color.muted2} strokeWidth={2} />}
        />
        <Input
          label="Confirm new password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoComplete="new-password"
          error={mismatch ? "The two passwords do not match." : undefined}
          icon={<Lock size={18} color={color.muted2} strokeWidth={2} />}
        />

        {error ? (
          <Text variant="caption" tone="red">
            {error}
          </Text>
        ) : done ? (
          <Text variant="caption" tone="primaryDark">
            Password changed.
          </Text>
        ) : null}

        <Button
          label="Change Password"
          block
          disabled={!ready}
          loading={saving}
          onPress={save}
        />

        {forced ? (
          <Button
            label="Sign Out"
            variant="tertiary"
            block
            onPress={() => void signOut()}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space.lg },
});
