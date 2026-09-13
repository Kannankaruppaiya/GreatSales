import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck, Smartphone, Globe, Lock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import { GSHeader, GSButton, GSInput, GSBadge } from '@/components/ui';
import { useChangePassword } from '@/hooks';
import { hapticFeedback } from '@/utils/haptics';

export default function SecurityScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const changePwMutation = useChangePassword();

  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) {
      setError('Please fill in current and new passwords.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }

    try {
      setError('');
      await changePwMutation.mutateAsync({
        oldPw: oldPassword.trim(),
        newPw: newPassword.trim(),
      });
      hapticFeedback('success');
      setSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || 'Current password incorrect.');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <GSHeader title="Security & Sessions" showBack />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* Change Password Card */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Change Account Password
          </Text>

          {success && (
            <View style={[styles.successBanner, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <Text style={[styles.successText, { color: colors.success }]}>
                Password updated successfully!
              </Text>
            </View>
          )}

          {error ? (
            <View style={[styles.errorBanner, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          ) : null}

          <GSInput
            label="Current Password"
            value={oldPassword}
            onChangeText={(t) => {
              setOldPassword(t);
              if (error) setError('');
            }}
            placeholder="••••••••"
            secureTextEntry
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
          />

          <GSButton
            title="Update Password"
            variant="primary"
            size="md"
            onPress={handleChangePassword}
            loading={changePwMutation.isPending}
            style={{ marginTop: spacing[2] }}
          />
        </View>

        {/* Active Sessions */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Active Login Sessions
          </Text>

          <View style={[styles.sessionItem, { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 }]}>
            <View style={[styles.sessionIcon, { backgroundColor: colors.brandSoft }]}>
              <Smartphone size={20} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.sessionTitleRow}>
                <Text style={[styles.sessionDevice, { color: colors.textPrimary }]}>
                  {Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Mobile'}
                </Text>
                <GSBadge label="Current" variant="brand" size="sm" />
              </View>
              <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>
                GreatSales Mobile App • Active Now
              </Text>
            </View>
          </View>

          <View style={styles.sessionItem}>
            <View style={[styles.sessionIcon, { backgroundColor: colors.surfaceMuted }]}>
              <Globe size={20} color={colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sessionDevice, { color: colors.textPrimary }]}>
                Chrome / Windows
              </Text>
              <Text style={[styles.sessionMeta, { color: colors.textSecondary }]}>
                Web Portal • Signed in yesterday
              </Text>
            </View>
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
  content: {
    padding: spacing[4],
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '800',
    marginBottom: spacing[4],
  },
  successBanner: {
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing[3],
  },
  successText: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
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
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  sessionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sessionDevice: {
    fontSize: typography.body.fontSize,
    fontWeight: '700',
  },
  sessionMeta: {
    fontSize: typography.caption.fontSize,
  },
});
