import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSBottomSheet, GSButton } from '../ui';
import { useSnoozeFollowUp } from '../../hooks';
import { hapticFeedback } from '../../utils/haptics';

export interface SnoozeFollowUpSheetProps {
  visible: boolean;
  onClose: () => void;
  followUpId: string;
  customerName: string;
}

const SNOOZE_OPTIONS = [
  { label: '+1 Day (Tomorrow)', days: 1 },
  { label: '+3 Days', days: 3 },
  { label: '+7 Days (Next Week)', days: 7 },
  { label: '+14 Days (2 Weeks)', days: 14 },
];

export function SnoozeFollowUpSheet({
  visible,
  onClose,
  followUpId,
  customerName,
}: SnoozeFollowUpSheetProps) {
  const { colors } = useTheme();
  const snoozeMutation = useSnoozeFollowUp();

  const handleSnooze = async (days: number) => {
    await snoozeMutation.mutateAsync({
      id: followUpId,
      days,
    });
    hapticFeedback('success');
    onClose();
  };

  return (
    <GSBottomSheet
      visible={visible}
      onClose={onClose}
      title="Snooze Follow-up"
      subtitle={`For ${customerName}`}
    >
      <View style={styles.content}>
        <View style={styles.list}>
          {SNOOZE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.days}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              onPress={() => handleSnooze(opt.days)}
              style={({ pressed }) => [
                styles.item,
                {
                  backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Clock size={16} color={colors.brand} />
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <GSButton
          title="Cancel"
          variant="secondary"
          onPress={onClose}
          style={{ marginTop: spacing[3] }}
        />
      </View>
    </GSBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing[4],
  },
  list: {
    gap: spacing[2],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderRadius: radius.md,
  },
  label: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    marginLeft: spacing[3],
  },
});
