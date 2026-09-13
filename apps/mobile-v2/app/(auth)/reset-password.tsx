import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, ArrowLeft, KeyRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import { GSButton, GSInput, GSIconButton } from '@/components/ui';

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!code.trim() || !newPassword.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.replace('/(auth)/login');
    }, 600);
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
            paddingTop: insets.top + spacing[3],
            paddingBottom: insets.bottom + spacing[4],
          },
        ]}
      >
        <GSIconButton
          icon={<ArrowLeft size={20} color={colors.textPrimary} />}
          variant="ghost"
          size="sm"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backBtn}
        />

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Set New Password
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter the recovery code sent to your email along with your new password.
          </Text>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            {error ? (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
                ]}
              >
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            ) : null}

            <GSInput
              label="6-Digit Recovery Code"
              value={code}
              onChangeText={(t) => {
                setCode(t);
                if (error) setError('');
              }}
              placeholder="123456"
              keyboardType="numeric"
              leftIcon={<KeyRound size={18} color={colors.textSecondary} />}
            />

            <GSInput
              label="New Password"
              value={newPassword}
              onChangeText={(t) => {
                setNewPassword(t);
                if (error) setError('');
              }}
              placeholder="••••••••"
              secureTextEntry
              leftIcon={<Lock size={18} color={colors.textSecondary} />}
            />

            <GSInput
              label="Confirm New Password"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                if (error) setError('');
              }}
              placeholder="••••••••"
              secureTextEntry
              leftIcon={<Lock size={18} color={colors.textSecondary} />}
            />

            <GSButton
              title="Update Password & Sign In"
              variant="primary"
              size="lg"
              onPress={handleReset}
              loading={loading}
              fullWidth
              style={{ marginTop: spacing[2] }}
            />
          </View>
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
    flexGrow: 1,
  },
  backBtn: {
    marginBottom: spacing[4],
  },
  content: {
    marginTop: spacing[2],
  },
  title: {
    fontSize: typography.heading1.fontSize,
    fontWeight: '800',
    marginBottom: spacing[1],
  },
  subtitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    marginBottom: spacing[6],
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[5],
  },
  errorBox: {
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing[3],
  },
  errorText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
});
