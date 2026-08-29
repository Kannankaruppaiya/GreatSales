/**
 * Badge — a compact status/label chip. Tone maps to a subtle background + a
 * readable foreground token; the text itself carries the meaning, so the badge
 * never relies on color alone.
 */
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import type { ColorTokens } from '@/theme/tokens';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const { colors, radii, spacing } = useTheme();

  const bg: Record<BadgeTone, keyof ColorTokens> = {
    neutral: 'surfaceSunken',
    primary: 'primarySubtle',
    success: 'successSubtle',
    warning: 'warningSubtle',
    error: 'errorSubtle',
  };
  const fg: Record<BadgeTone, keyof ColorTokens> = {
    neutral: 'textSecondary',
    primary: 'primary',
    success: 'success',
    warning: 'warning',
    error: 'error',
  };

  return (
    <View
      style={[
        styles.wrap,
        { backgroundColor: colors[bg[tone]], borderRadius: radii.pill, paddingHorizontal: spacing.sm },
      ]}
    >
      <Text variant="caption" style={{ color: colors[fg[tone]] }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 3, alignSelf: 'flex-start' },
});
