import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck, Mail, Lock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import { GSButton, GSInput } from '@/components/ui';
import { useLogin } from '@/hooks';

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useLogin();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both your work email and password.');
      return;
    }

    try {
      setError('');
      await loginMutation.mutateAsync({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });
      router.replace('/(app)/today');
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials. Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing[6],
            paddingBottom: insets.bottom + spacing[6],
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.iconCircle,
              {
                backgroundColor: colors.brandSoft,
                borderColor: colors.brand,
              },
            ]}
          >
            <ShieldCheck size={36} color={colors.brand} strokeWidth={2.5} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Welcome Back
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to your GreatSales field account
          </Text>
        </View>

        {/* Login Form */}
        <View
          style={[
            styles.formCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {error ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: colors.dangerSoft,
                  borderColor: colors.danger,
                },
              ]}
            >
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {error}
              </Text>
            </View>
          ) : null}

          <GSInput
            label="Work Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (error) setError('');
            }}
            placeholder="name@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<Mail size={18} color={colors.textSecondary} />}
          />

          <GSInput
            label="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (error) setError('');
            }}
            placeholder="••••••••"
            secureTextEntry
            leftIcon={<Lock size={18} color={colors.textSecondary} />}
          />

          <View style={styles.forgotRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Text style={[styles.forgotText, { color: colors.brand }]}>
                Forgot Password?
              </Text>
            </Pressable>
          </View>

          <GSButton
            title="Sign In"
            variant="primary"
            size="lg"
            onPress={handleLogin}
            loading={loginMutation.isPending}
            fullWidth
            style={{ marginTop: spacing[2] }}
          />
        </View>

        {/* Security Assurance */}
        <View style={styles.securityRow}>
          <Text style={[styles.securityText, { color: colors.textTertiary }]}>
            Enterprise 256-bit encrypted authentication
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing[4],
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[3],
  },
  title: {
    fontSize: typography.heading1.fontSize,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[5],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  errorBanner: {
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing[3],
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: spacing[4],
  },
  forgotText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
  },
  securityRow: {
    alignItems: 'center',
    marginTop: spacing[6],
  },
  securityText: {
    fontSize: typography.micro.fontSize,
    fontWeight: '500',
  },
});
