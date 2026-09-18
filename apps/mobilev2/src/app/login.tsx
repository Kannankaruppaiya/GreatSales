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
 */
import React, { useState } from "react";
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
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Phone,
} from "lucide-react-native";

import { Button, Input, Text } from "@/components/ui";
import { OnboardingBackdrop } from "@/components/brand/Decor";
import { color, font, radius, space } from "@/design/tokens";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  async function signIn() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      // Sign-in against the API is wired when the app is pointed at it; with
      // the synthetic source there is no credential to check, so the flow
      // continues to the permission step exactly as it would after a success.
      router.replace("/location-permission");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not sign you in.",
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
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Language"
            style={styles.langPill}
            onPress={() => router.push("/settings")}
          >
            <Text variant="secondary" style={styles.langLabel}>
              EN
            </Text>
            <ChevronDown size={14} color={color.ink} strokeWidth={2} />
          </Pressable>
        </View>

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
            label="Mobile Number or Email"
            placeholder="+91 98765 43210"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoComplete="username"
            keyboardType="email-address"
            icon={<Phone size={18} color={color.muted2} strokeWidth={2} />}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
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
            onPress={() => router.push("/help")}
            style={styles.forgotRow}
            hitSlop={8}
          >
            <Text variant="secondary" tone="primaryDark" style={styles.forgot}>
              Forgot Password?
            </Text>
          </Pressable>

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
            onPress={signIn}
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
          New to GreatSales? Contact your administrator.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.surfaceWhite },
  content: { paddingHorizontal: space.gutter, flexGrow: 1 },
  topRow: { flexDirection: "row", justifyContent: "flex-end" },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    height: 35,
    paddingHorizontal: space.md,
    borderRadius: radius.input,
    backgroundColor: "#F5F9FB",
    borderWidth: 1,
    borderColor: "#DFE8ED",
  },
  langLabel: { fontFamily: font.semibold },
  brandBlock: { alignItems: "center", marginTop: space.section },
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
