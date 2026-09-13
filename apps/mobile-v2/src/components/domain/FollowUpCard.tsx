import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Check, Clock, AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSCard, GSBadge, GSAmountDisplay, GSAvatar } from '../ui';
import type { FollowUp } from '../../domain/types';
import { formatShortDate } from '../../domain/formatters';
import { hapticFeedback } from '../../utils/haptics';

export interface FollowUpCardProps {
  followUp: FollowUp;
  onPress?: () => void;
  onComplete?: () => void;
  onSnooze?: () => void;
}

export function FollowUpCard({
  followUp,
  onPress,
  onComplete,
  onSnooze,
}: FollowUpCardProps) {
  const { colors } = useTheme();

  const isDone = followUp.status === 'Completed' || followUp.done;
  const isOverdue = followUp.status === 'Overdue';

  const handleCompletePress = (e: any) => {
    e.stopPropagation?.();
    hapticFeedback('success');
    if (onComplete) onComplete();
  };

  const displayName = followUp.customerName || followUp.title || 'Follow-up';
  const subtitle =
    followUp.customerName && followUp.title && followUp.title !== followUp.customerName
      ? followUp.title
      : followUp.subtitle || followUp.notes || 'Follow-up discussion';

  const timeDisplay = followUp.dueTime
    ? `${formatShortDate(followUp.dueDate)}, ${followUp.dueTime}`
    : formatShortDate(followUp.dueDate);

  return (
    <GSCard
      onPress={onPress}
      variant="bordered"
      padding="sm"
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: isOverdue && !isDone ? colors.dangerBorder : colors.border,
        },
        isOverdue && !isDone && { borderLeftWidth: 3, borderLeftColor: colors.danger },
      ]}
      accessibilityLabel={`Follow-up for ${displayName}`}
    >
      <View style={styles.cardContent}>
        {/* Left: Avatar with initials */}
        <GSAvatar name={displayName} size="md" style={styles.avatar} />

        {/* Center: Customer & Task */}
        <View style={styles.infoCol}>
          <Text numberOfLines={1} style={[styles.customerName, { color: colors.textPrimary }]}>
            {displayName}
          </Text>

          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>

          <View style={styles.timeRow}>
            {isOverdue && !isDone ? (
              <AlertCircle size={12} color={colors.danger} style={{ marginRight: 4 }} />
            ) : (
              <Clock size={12} color={colors.textTertiary} style={{ marginRight: 4 }} />
            )}
            <Text
              style={[
                styles.timeText,
                { color: isOverdue && !isDone ? colors.danger : colors.textTertiary },
              ]}
            >
              {timeDisplay}
            </Text>
          </View>
        </View>

        {/* Right: Quick Action / Status */}
        <View style={styles.rightCol}>
          {isDone ? (
            <GSBadge label="DONE" variant="success" size="sm" showDot />
          ) : onComplete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark follow-up completed"
              onPress={handleCompletePress}
              style={({ pressed }) => [
                styles.completeBtn,
                {
                  backgroundColor: pressed ? colors.brandStrong : colors.surface,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <Check size={14} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </GSCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing[2] + 2,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[1],
  },
  avatar: {
    marginRight: spacing[3],
  },
  infoCol: {
    flex: 1,
    paddingRight: spacing[2],
  },
  customerName: {
    fontSize: 15,
    fontFamily: typography.cardTitle.fontFamily,
    fontWeight: '700',
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: typography.bodySmall.fontFamily,
    fontWeight: '400',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '500',
  },
  rightCol: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  completeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
