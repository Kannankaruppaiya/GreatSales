/**
 * Button — the single action primitive. Variants encode hierarchy
 * (primary → secondary → tertiary → destructive); there should be at most one
 * primary action per screen. Guarantees a ≥ hitTarget touch height, a busy
 * state that blocks double-submits, and correct accessibility state.
 */
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/theme-provider';
import { hitTarget } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type ButtonSize = 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables interaction, keeps width stable. */
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leadingIcon?: IconName;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  fullWidth = true,
  leadingIcon,
  style,
}: ButtonProps) {
  const { colors, radii, spacing } = useTheme();
  const isDisabled = disabled || loading;

  const height = size === 'lg' ? 52 : Math.max(44, hitTarget);

  const bg: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.surface,
    tertiary: 'transparent',
    destructive: colors.error,
  };
  const pressedBg: Record<ButtonVariant, string> = {
    primary: colors.primaryPressed,
    secondary: colors.surfaceSunken,
    tertiary: colors.surfaceSunken,
    destructive: '#A81F14',
  };
  const fg: Record<ButtonVariant, string> = {
    primary: colors.textOnPrimary,
    secondary: colors.textPrimary,
    tertiary: colors.primary,
    destructive: colors.textOnPrimary,
  };
  const borderColor: Record<ButtonVariant, string> = {
    primary: 'transparent',
    secondary: colors.border,
    tertiary: 'transparent',
    destructive: 'transparent',
  };

  const spinnerColor = variant === 'secondary' || variant === 'tertiary' ? colors.primary : colors.textOnPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          minHeight: hitTarget,
          borderRadius: radii.md,
          paddingHorizontal: spacing.xl,
          backgroundColor: isDisabled ? colors.disabledBg : pressed ? pressedBg[variant] : bg[variant],
          borderColor: isDisabled ? 'transparent' : borderColor[variant],
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth * 2 : 0,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: pressed && variant === 'tertiary' ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View style={styles.content}>
          {leadingIcon ? (
            <Icon name={leadingIcon} size={18} color={isDisabled ? 'disabledText' : (fg[variant] as string)} />
          ) : null}
          <Text
            variant="button"
            style={{ color: isDisabled ? colors.disabledText : fg[variant] }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
