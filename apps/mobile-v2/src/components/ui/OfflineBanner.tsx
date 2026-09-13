import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';

export interface OfflineBannerProps {
  isOnline: boolean;
  onRetry?: () => void;
  isChecking?: boolean;
}

export function OfflineBanner({
  isOnline,
  onRetry,
  isChecking = false,
}: OfflineBannerProps) {
  const { colors } = useTheme();

  if (isOnline) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel="Network is offline. Showing cached data."
      style={[
        styles.banner,
        {
          backgroundColor: colors.dangerSoft,
          borderColor: colors.dangerBorder,
        },
      ]}
    >
      <View style={styles.leftCol}>
        <WifiOff size={16} color={colors.danger} style={styles.icon} />
        <Text style={[styles.text, { color: colors.danger }]}>
          Offline • Viewing cached sales data
        </Text>
      </View>

      {onRetry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry connection"
          disabled={isChecking}
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryBtn,
            {
              backgroundColor: colors.surface,
              borderColor: colors.dangerBorder,
              opacity: pressed || isChecking ? 0.7 : 1,
            },
          ]}
        >
          <RefreshCw
            size={12}
            color={colors.danger}
            style={[styles.retryIcon, isChecking && styles.spinning]}
          />
          <Text style={[styles.retryText, { color: colors.danger }]}>
            {isChecking ? 'Checking...' : 'Retry'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    zIndex: 999,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: spacing[2],
  },
  text: {
    fontSize: typography.caption.fontSize,
    fontFamily: typography.caption.fontFamily,
    fontWeight: '600',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginLeft: spacing[2],
  },
  retryIcon: {
    marginRight: 4,
  },
  retryText: {
    fontSize: typography.micro.fontSize,
    fontFamily: typography.micro.fontFamily,
    fontWeight: '700',
  },
  spinning: {
    opacity: 0.5,
  },
});
