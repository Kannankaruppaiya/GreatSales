import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Inbox } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSButton } from './GSButton';

export interface GSEmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function GSEmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  style,
}: GSEmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
          },
        ]}
      >
        {icon || <Inbox size={32} color={colors.textTertiary} />}
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.desc, { color: colors.textSecondary }]}>{description}</Text>

      {actionLabel && onAction ? (
        <GSButton
          title={actionLabel}
          variant="outline"
          size="sm"
          onPress={onAction}
          style={styles.actionBtn}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[6],
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    fontSize: typography.cardTitle.fontSize,
    fontWeight: '700',
    lineHeight: typography.cardTitle.lineHeight,
    textAlign: 'center',
    marginBottom: spacing[1],
  },
  desc: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    textAlign: 'center',
    maxWidth: 280,
  },
  actionBtn: {
    marginTop: spacing[4],
  },
});
