import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import { GSButton, GSInput, GSIconButton } from '@/components/ui';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSend = () => {
    if (!email.trim()) {
      setError('Please enter your work email.');
      return;
    }
    setError('');
    setSubmitted(true);
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
          accessibilityLabel="Back to Login"
          onPress={() => router.back()}
          style={styles.backBtn}
        />

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Reset Password
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Enter your work email address and we'll send a password recovery code.
          </Text>

          {submitted ? (
            <View
              style={[
                styles.successBox,
                {
                  backgroundColor: colors.successSoft,
                  borderColor: colors.success,
                },
              ]}
            >
              <CheckCircle2 size={24} color={colors.success} style={{ marginBottom: 8 }} />
              <Text style={[styles.successTitle, { color: colors.success }]}>
                Recovery Code Dispatched
              </Text>
              <Text style={[styles.successDesc, { color: colors.textSecondary }]}>
                We sent a 6-digit recovery code to {email}. Check your inbox.
              </Text>
              <GSButton
                title="Enter Reset Code"
                variant="primary"
                onPress={() => router.push('/(auth)/reset-password')}
                style={{ marginTop: spacing[4], width: '100%' }}
              />
            </View>
          ) : (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
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
                error={error}
                leftIcon={<Mail size={18} color={colors.textSecondary} />}
              />

              <GSButton
                title="Send Recovery Code"
                variant="primary"
                size="lg"
                onPress={handleSend}
                fullWidth
                style={{ marginTop: spacing[2] }}
              />
            </View>
          )}
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
  successBox: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing[5],
    alignItems: 'center',
  },
  successTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
    marginBottom: 4,
  },
  successDesc: {
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
    lineHeight: 20,
  },
});
