import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import { GSHeader, GSButton, GSInput, GSAvatar } from '@/components/ui';
import { useCurrentUser, useUpdateProfile } from '@/hooks';
import { hapticFeedback } from '@/utils/haptics';

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: user } = useCurrentUser();
  const updateMutation = useUpdateProfile();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    setError('');

    await updateMutation.mutateAsync({
      name: name.trim(),
      phone: phone.trim(),
    });

    hapticFeedback('success');
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <GSHeader title="Edit Profile" showBack />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={styles.avatarRow}>
            <GSAvatar uri={user?.avatarUrl} name={user?.name || 'GS'} size="xl" variant="identity" />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Editable Information
          </Text>

          <GSInput
            label="Full Name *"
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError('');
            }}
            placeholder="Your name"
            error={error}
          />

          <GSInput
            label="Mobile Phone Number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98420 12345"
            keyboardType="phone-pad"
          />

          <GSButton
            title="Save Changes"
            variant="primary"
            size="lg"
            onPress={handleSave}
            loading={updateMutation.isPending}
            style={{ marginTop: spacing[3] }}
          />
        </View>

        {/* Locked Organization Fields */}
        <View style={[styles.card, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <View style={styles.lockedHeader}>
            <Lock size={15} color={colors.textTertiary} />
            <Text style={[styles.lockedTitle, { color: colors.textSecondary }]}>
              Managed by Organization
            </Text>
          </View>
          <Text style={[styles.lockedDesc, { color: colors.textTertiary }]}>
            Work email, assigned role, division and territory are managed by system administrators.
          </Text>

          <GSInput label="Work Email" value={user?.email || ''} onChangeText={() => {}} disabled />
          <GSInput label="Role" value={user?.role === 'sales' ? 'Field Sales Executive' : user?.role || ''} onChangeText={() => {}} disabled />
          <GSInput label="Region / Territory" value={user?.region || ''} onChangeText={() => {}} disabled />
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
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  lockedTitle: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    marginLeft: 6,
  },
  lockedDesc: {
    fontSize: typography.caption.fontSize,
    lineHeight: 18,
    marginBottom: spacing[3],
  },
  avatarRow: {
    alignItems: 'center',
    marginBottom: spacing[4],
  },
});
