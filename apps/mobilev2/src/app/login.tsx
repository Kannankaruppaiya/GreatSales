/**
 * 01A — Login.
 *
 * From the Penpot board "Screen 01A Login": the brand lockup, a welcome
 * heading, two fields, the remember-me row, the primary action, and the
 * onboarding backdrop at the foot.
 *
 * "Continue with Google" is in the design but the API exposes only
 * password sign-in (`/auth/login`), so it is not rendered — an OAuth button
 * that cannot complete is worse than none. Recorded in CHECKLIST.md.
 *
 * The API signs in by workspace + email + password, so those are the fields.
 * The design's "Mobile Number or Email" became "Email": there is no phone
 * sign-in to offer. The workspace is remembered after the first sign-in, so
 * a salesperson types it once per phone.
 *
 * Only a salesperson may sign in here. The API refuses every other role from
 * the mobile client after checking the password, and its message is shown as
 * it is — it already says where to go instead.
 */
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Building2, Check, Eye, EyeOff, Lock, Mail } from "lucide-react-native";

import { Button, Input, Text } from "@/components/ui";
import { OnboardingBackdrop } from "@/components/brand/Decor";
import { color, font, space } from "@/design/tokens";
import { ApiError, describeError } from "@/data/http";
import { lastWorkspace, signIn } from "@/data/session";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [workspace, setWorkspace] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    let live = true;
    void lastWorkspace().then((code) => {
      if (live && code) setWorkspace((current) => current || code);
    });
    return () => {
      live = false;
    };
  }, []);

  const canSubmit =
    workspace.trim().length > 0 &&
    identifier.trim().length > 0 &&
    password.length > 0;

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const user = await signIn({
        workspace,
        email: identifier,
        password,
        remember,
      });
      setPassword("");
      router.replace(
        user.mustChangePassword ? "/change-password" : "/location-permission",
      );
    } catch (caught) {
      // One message for every wrong credential, whichever part was wrong —
      // the API does the same, so this screen cannot be used to find out
      // which workspaces or addresses exist.
      setError(
        caught instanceof ApiError && caught.status === 401
          ? "The workspace, email or password is not right."
          : caught instanceof ApiError && caught.status === 429
            ? "Too many attempts. Wait a minute, then try again."
            : describeError(caught),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <OnboardingBackdrop />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + space.xxl,
            paddingBottom: insets.bottom + space.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <Text style={styles.logoG}>G</Text>
          <Text style={styles.brand}>GreatSales</Text>
          <Text variant="secondary" tone="muted">
            Field Sales CRM
          </Text>
        </View>

        <Text style={styles.heading}>Welcome Back</Text>
        <Text
          variant="body"
          tone="muted"
          align="center"
          style={styles.subheading}
        >
          Sign in to continue to your sales workspace.
        </Text>

        <View style={styles.form}>
          <Input
            label="Workspace"
            placeholder="Your company's workspace code"
            value={workspace}
            onChangeText={setWorkspace}
            autoCapitalize="none"
            autoCorrect={false}
            icon={<Building2 size={18} color={color.muted2} strokeWidth={2} />}
          />

          <Input
            label="Email"
            placeholder="you@company.com"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            icon={<Mail size={18} color={color.muted2} strokeWidth={2} />}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            onSubmitEditing={submit}
            returnKeyType="go"
            error={error ?? undefined}
            icon={<Lock size={18} color={color.muted2} strokeWidth={2} />}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  showPassword ? "Hide password" : "Show password"
                }
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={10}
              >
                {showPassword ? (
                  <EyeOff size={19} color={color.muted} strokeWidth={2} />
                ) : (
                  <Eye size={19} color={color.muted} strokeWidth={2} />
                )}
              </Pressable>
            }
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            accessibilityState={{ expanded: showReset }}
            onPress={() => setShowReset((v) => !v)}
            style={styles.forgotRow}
            hitSlop={8}
          >
            <Text variant="secondary" tone="primaryDark" style={styles.forgot}>
              Forgot Password?
            </Text>
          </Pressable>
          {showReset ? (
            <Text variant="caption" tone="muted" style={styles.resetNote}>
              Passwords are reset by your company's GreatSales administrator.
              Ask them for a temporary password — you will choose your own the
              first time you sign in with it.
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            accessibilityLabel="Remember me"
            onPress={() => setRemember((v) => !v)}
            style={styles.rememberRow}
          >
            <View
              style={[styles.checkbox, remember ? styles.checkboxOn : null]}
            >
              {remember ? (
                <Check size={14} color={color.surfaceWhite} strokeWidth={3} />
              ) : null}
            </View>
            <Text variant="body">Remember me</Text>
          </Pressable>

          <Button
            label="Sign In"
            block
            onPress={submit}
            disabled={!canSubmit}
            loading={submitting}
            style={styles.submit}
          />
        </View>

        <Text
          variant="caption"
          tone="muted"
          align="center"
          style={styles.footer}
        >
          New to GreatSales, or forgot your password? Your company's
          administrator sets up and resets accounts.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surfaceWhite },
  content: { paddingHorizontal: space.gutter, flexGrow: 1 },
  brandBlock: { alignItems: "center", marginTop: space.section },
  resetNote: { marginTop: -space.sm },
  logoG: { fontFamily: font.extrabold, fontSize: 39, color: color.primary },
  brand: {
    fontFamily: font.extrabold,
    fontSize: 25,
    color: color.ink,
    marginTop: space.md,
  },
  heading: {
    fontFamily: font.extrabold,
    fontSize: 27,
    color: color.ink,
    textAlign: "center",
    marginTop: space.xxl,
  },
  subheading: { marginTop: space.sm, paddingHorizontal: space.xxl },
  form: { marginTop: space.xxl, gap: space.xl },
  forgotRow: { alignSelf: "flex-end", marginTop: -space.sm },
  forgot: { fontFamily: font.semibold },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: color.line,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: color.primary, borderColor: color.primary },
  submit: { marginTop: space.sm },
  footer: { marginTop: "auto", paddingTop: space.xxl },
});
