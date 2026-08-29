/**
 * Banner — inline, non-blocking status message (info / success / warning /
 * error). Status is conveyed by icon + text, never color alone. Optionally
 * carries a single recovery action (e.g. Retry). Announced to screen readers.
 */
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import type { ColorTokens } from '@/theme/tokens';

export type BannerTone = 'info' | 'success' | 'warning' | 'error';

type BannerProps = {
  tone?: BannerTone;
  title?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const ICONS: Record<BannerTone, IconName> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  error: 'alert-circle',
};

export function Banner({ tone = 'info', title, message, actionLabel, onAction }: BannerProps) {
  const { colors, radii, spacing } = useTheme();

  const accentKey: Record<BannerTone, keyof ColorTokens> = {
    info: 'info',
    success: 'success',
    warning: 'warning',
    error: 'error',
  };
  const bgKey: Record<BannerTone, keyof ColorTokens> = {
    info: 'infoSubtle',
    success: 'successSubtle',
    warning: 'warningSubtle',
    error: 'errorSubtle',
  };
  const accent = colors[accentKey[tone]];

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.wrap,
        {
          backgroundColor: colors[bgKey[tone]],
          borderRadius: radii.md,
          borderLeftColor: accent,
          borderLeftWidth: 3,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={{ paddingTop: 1 }}>
          <Icon name={ICONS[tone]} size={18} color={accentKey[tone]} accessibilityLabel={tone} />
        </View>
        <View style={styles.body}>
          {title ? (
            <Text variant="label" style={{ color: colors.textPrimary }}>
              {title}
            </Text>
          ) : null}
          <Text variant="bodySm" style={{ color: colors.textPrimary }}>
            {message}
          </Text>
        </View>
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={8}
          style={styles.action}
        >
          <Text variant="label" style={{ color: accent }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  row: { flexDirection: 'row', gap: 10 },
  body: { flex: 1, gap: 2 },
  action: { alignSelf: 'flex-start', paddingVertical: 6, paddingLeft: 28 },
});
