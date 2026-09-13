import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Pressable } from 'react-native';
import { Sun, Moon, Smartphone, Bell, Info } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/design-system/theme';
import { spacing, radius, typography } from '../../src/design-system/tokens';
import { GSHeader, GSChip } from '../../src/components/ui';

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [followUpAlerts, setFollowUpAlerts] = useState(true);
  const [paymentAlerts, setPaymentAlerts] = useState(true);
  const [orderAlerts, setOrderAlerts] = useState(true);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <GSHeader title="Settings & Appearance" showBack />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing[8] },
        ]}
      >
        {/* Appearance Section */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Theme & Appearance
          </Text>

          <View style={styles.themeChips}>
            <GSChip
              label="System"
              icon={<Smartphone size={14} color={mode === 'system' ? colors.white : colors.textSecondary} />}
              selected={mode === 'system'}
              onPress={() => setMode('system')}
            />
            <View style={{ width: spacing[2] }} />
            <GSChip
              label="Light"
              icon={<Sun size={14} color={mode === 'light' ? colors.white : colors.textSecondary} />}
              selected={mode === 'light'}
              onPress={() => setMode('light')}
            />
            <View style={{ width: spacing[2] }} />
            <GSChip
              label="Dark"
              icon={<Moon size={14} color={mode === 'dark' ? colors.white : colors.textSecondary} />}
              selected={mode === 'dark'}
              onPress={() => setMode('dark')}
            />
          </View>
        </View>

        {/* Notification Preferences */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Push Notifications
          </Text>

          <View style={[styles.switchRow, { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 }]}>
            <View style={{ flex: 1, marginRight: spacing[2] }}>
              <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>Follow-up Reminders</Text>
              <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                Alerts 15 mins before scheduled client calls and meetings
              </Text>
            </View>
            <Switch
              value={followUpAlerts}
              onValueChange={setFollowUpAlerts}
              trackColor={{ false: colors.surfaceMuted, true: colors.brand }}
            />
          </View>

          <View style={[styles.switchRow, { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 }]}>
            <View style={{ flex: 1, marginRight: spacing[2] }}>
              <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>Payment Due Alerts</Text>
              <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                High-priority alerts for Red-Zone aging invoices
              </Text>
            </View>
            <Switch
              value={paymentAlerts}
              onValueChange={setPaymentAlerts}
              trackColor={{ false: colors.surfaceMuted, true: colors.brand }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: spacing[2] }}>
              <Text style={[styles.switchTitle, { color: colors.textPrimary }]}>Order Status Updates</Text>
              <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
                Real-time alerts when warehouse dispatches your orders
              </Text>
            </View>
            <Switch
              value={orderAlerts}
              onValueChange={setOrderAlerts}
              trackColor={{ false: colors.surfaceMuted, true: colors.brand }}
            />
          </View>
        </View>

        {/* Application Information */}
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            About GreatSales
          </Text>

          <View style={[styles.aboutRow, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>App Version</Text>
            <Text style={[styles.aboutVal, { color: colors.textPrimary }]}>v2.0.0 (Production)</Text>
          </View>

          <View style={[styles.aboutRow, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Architecture</Text>
            <Text style={[styles.aboutVal, { color: colors.textPrimary }]}>React Native 0.81 (Hermes)</Text>
          </View>

          <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Data Provider</Text>
            <Text style={[styles.aboutVal, { color: colors.brand, fontWeight: '700' }]}>
              Synthetic Relational (API Ready)
            </Text>
          </View>
        </View>
      </ScrollView>
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
  themeChips: {
    flexDirection: 'row',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
  },
  switchTitle: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '700',
  },
  switchDesc: {
    fontSize: typography.caption.fontSize,
    marginTop: 2,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
  },
  aboutLabel: {
    fontSize: typography.bodySmall.fontSize,
  },
  aboutVal: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
});
