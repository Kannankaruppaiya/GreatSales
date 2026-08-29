/**
 * Text — the only way text is rendered in the app. Binds a type-scale variant
 * to a semantic color token. Font scaling is ON by default (accessibility);
 * we cap the multiplier so very large system fonts don't destroy layouts, but
 * never disable scaling outright.
 */
import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { useTheme } from '@/theme/theme-provider';
import type { TypographyVariant } from '@/theme/tokens';

export type TextColor =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'onPrimary'
  | 'link'
  | 'success'
  | 'warning'
  | 'error';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
  center?: boolean;
};

export function Text({
  variant = 'body',
  color = 'primary',
  center,
  style,
  maxFontSizeMultiplier = 1.6,
  ...rest
}: AppTextProps) {
  const { colors, typography } = useTheme();

  const colorValue: string = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    onPrimary: colors.textOnPrimary,
    link: colors.primary,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
  }[color];

  return (
    <RNText
      style={[typography[variant], { color: colorValue }, center && styles.center, style]}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({ center: { textAlign: 'center' } });
