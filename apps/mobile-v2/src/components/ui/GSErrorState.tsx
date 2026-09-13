import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { GSButton } from './GSButton';

export interface GSErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  style?: ViewStyle;
}

export function GSErrorState({
  title = 'Something went wrong',
  message = 'We encountered an error loading this data. Please check your connection and try again.',
  onRetry,
  style,
}: GSErrorStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor: colors.dangerSoft,
            borderColor: colors.danger,
          },
        ]}
      >
        <AlertCircle size={32} color={colors.danger} />
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.desc, { color: colors.textSecondary }]}>{message}</Text>

      {onRetry ? (
        <GSButton
          title="Try Again"
          variant="secondary"
          size="sm"
          onPress={onRetry}
          style={styles.retryBtn}
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
    maxWidth: 300,
  },
  retryBtn: {
    marginTop: spacing[4],
  },
});
