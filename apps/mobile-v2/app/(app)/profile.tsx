import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Camera,
  Edit2,
  Shield,
  Settings,
  LogOut,
  Mail,
  Phone,
  Building2,
  MapPin,
  ChevronRight,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design-system/theme';
import { spacing, radius, typography } from '@/design-system/tokens';
import { GSHeader, GSButton, GSIconButton, GSDialog, GSAvatar } from '@/components/ui';
import { AvatarPickerSheet } from '@/components/modals';
import { useCurrentUser, useLogout } from '@/hooks';
import { formatInitials } from '@/domain/formatters';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();

  const [avatarSheetVisible, setAvatarSheetVisible] = useState(false);
  const [logoutDialogVisible, setLogoutDialogVisible] = useState(false);

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLogoutDialogVisible(false);
    router.replace('/(auth)/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader
        title="Sales Profile"
        showBack
        rightActions={
          <GSButton
            title="Edit"
            variant="ghost"
            size="sm"
            onPress={() => router.push('/(app)/edit-profile')}
          />
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* Avatar & Header Identity */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <GSAvatar
              uri={user?.avatarUrl}
              name={user?.name || 'GS'}
              size="hero"
              variant="identity"
              onPress={() => setAvatarSheetVisible(true)}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change avatar"
              onPress={() => setAvatarSheetVisible(true)}
              style={[styles.cameraBadge, { backgroundColor: colors.brand, borderColor: colors.surface }]}
            >
              <Camera size={14} color={colors.white} />
            </Pressable>
          </View>

          <Text style={[styles.profileName, { color: colors.textPrimary }]}>
            {user?.name}
          </Text>
          <Text style={[styles.profileRole, { color: colors.textSecondary }]}>
            {user?.role === 'sales' ? 'Field Sales Executive' : user?.role} • {user?.region || 'Tamil Nadu'}
          </Text>
        </View>

        {/* Section: Personal Information */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Personal Contact
          </Text>

          <View style={[styles.infoRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.labelCol}>
              <Mail size={16} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Work Email</Text>
            </View>
            <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{user?.email}</Text>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <View style={styles.labelCol}>
              <Phone size={16} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Mobile Number</Text>
            </View>
            <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{user?.phone || '—'}</Text>
          </View>
        </View>

        {/* Section: Work & Territory */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Work & Territory
          </Text>

          <View style={[styles.infoRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.labelCol}>
              <Building2 size={16} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Division</Text>
            </View>
            <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{user?.division || 'Industrial Lubricants'}</Text>
          </View>

          <View style={[styles.infoRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.labelCol}>
              <MapPin size={16} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Region</Text>
            </View>
            <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{user?.region || 'Coimbatore & Erode'}</Text>
          </View>

          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <View style={styles.labelCol}>
              <Building2 size={16} color={colors.textSecondary} />
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Reporting Manager</Text>
            </View>
            <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{user?.managerName || 'Admin / Management'}</Text>
          </View>
        </View>

        {/* Quick Navigation Items */}
        <View style={[styles.navCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Security settings"
            onPress={() => router.push('/(app)/security')}
            style={[styles.navRow, { borderBottomColor: colors.borderSubtle }]}
          >
            <Shield size={18} color={colors.textSecondary} style={{ marginRight: spacing[3] }} />
            <Text style={[styles.navText, { color: colors.textPrimary }]}>Password & Security</Text>
            <ChevronRight size={16} color={colors.textTertiary} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="App preferences"
            onPress={() => router.push('/(app)/settings')}
            style={styles.navRow}
          >
            <Settings size={18} color={colors.textSecondary} style={{ marginRight: spacing[3] }} />
            <Text style={[styles.navText, { color: colors.textPrimary }]}>Preferences & Appearance</Text>
            <ChevronRight size={16} color={colors.textTertiary} />
          </Pressable>
        </View>

        {/* Sign Out CTA */}
        <GSButton
          title="Sign Out"
          variant="danger"
          size="md"
          leftIcon={<LogOut size={16} color={colors.white} />}
          onPress={() => setLogoutDialogVisible(true)}
          style={{ marginTop: spacing[2] }}
        />
      </ScrollView>

      {/* Avatar Picker Sheet */}
      <AvatarPickerSheet
        visible={avatarSheetVisible}
        onClose={() => setAvatarSheetVisible(false)}
        hasAvatar={Boolean(user?.avatarUrl)}
      />

      {/* Logout Confirmation */}
      <GSDialog
        visible={logoutDialogVisible}
        title="Sign Out?"
        message="Are you sure you want to sign out?"
        confirmText="Sign Out"
        destructive
        onConfirm={handleLogout}
        onCancel={() => setLogoutDialogVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing[4],
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: spacing[4],
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: spacing[3],
  },
  avatarImg: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: typography.heading1.fontSize,
    fontWeight: '800',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: typography.heading2.fontSize,
    fontWeight: '800',
    marginBottom: 2,
  },
  profileRole: {
    fontSize: typography.bodySmall.fontSize,
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
    marginBottom: spacing[3],
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  labelCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: typography.bodySmall.fontSize,
    marginLeft: spacing[2],
  },
  infoVal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  navCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing[4],
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
  },
  navText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    flex: 1,
  },
});
