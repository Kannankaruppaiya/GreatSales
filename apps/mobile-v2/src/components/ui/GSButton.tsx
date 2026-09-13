import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, typography } from '../../design-system/tokens';
import { hapticFeedback } from '../../utils/haptics';

export interface GSButtonProps {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  accessibilityLabel?: string;
  testID?: string;
}

export function GSButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  style,
  textStyle,
  accessibilityLabel,
  testID,
}: GSButtonProps) {
  const { colors } = useTheme();

  const handlePress = async () => {
    if (loading || disabled) return;
    hapticFeedback(variant === 'danger' ? 'medium' : 'light');
    await onPress();
  };

  const getContainerStyle = (pressed: boolean): ViewStyle => {
    let bg = colors.brand;
    let borderColor = 'transparent';
    let borderWidth = 0;

    switch (variant) {
      case 'primary':
        bg = pressed ? colors.brandDark : colors.brand;
        break;
      case 'secondary':
        bg = pressed ? colors.borderStrong : colors.surfaceElevated;
        borderWidth = 1;
        borderColor = colors.border;
        break;
      case 'outline':
        bg = pressed ? colors.surfaceElevated : 'transparent';
        borderWidth = 1.5;
        borderColor = colors.brand;
        break;
      case 'ghost':
        bg = pressed ? colors.surfaceElevated : 'transparent';
        break;
      case 'danger':
        bg = pressed ? colors.dangerDark : colors.danger;
        break;
    }

    if (disabled) {
      bg = colors.surfaceMuted;
      borderColor = colors.border;
    }

    const sizePadding = {
      sm: { paddingVertical: spacing[1], paddingHorizontal: spacing[3], minHeight: 36 },
      md: { paddingVertical: spacing[3], paddingHorizontal: spacing[4], minHeight: 46 },
      lg: { paddingVertical: spacing[4], paddingHorizontal: spacing[6], minHeight: 52 },
    }[size];

    return {
      backgroundColor: bg,
      borderColor,
      borderWidth,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      opacity: disabled ? 0.6 : 1,
      width: fullWidth ? '100%' : undefined,
      ...sizePadding,
      ...style,
    };
  };

  const getTextColor = (): string => {
    if (disabled) return colors.textTertiary;
    switch (variant) {
      case 'primary':
      case 'danger':
        return '#FFFFFF';
      case 'secondary':
        return colors.textPrimary;
      case 'outline':
        return colors.brand;
      case 'ghost':
        return colors.textPrimary;
    }
  };

  const fontStyle = size === 'sm' ? typography.bodySmall : typography.cardTitle;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => getContainerStyle(pressed)}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={getTextColor()}
          style={styles.spinner}
        />
      ) : (
        <>
          {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
          <Text
            style={[
              {
                color: getTextColor(),
                fontFamily: fontStyle.fontFamily,
                fontSize: fontStyle.fontSize,
                fontWeight: fontStyle.fontWeight as any,
                lineHeight: fontStyle.lineHeight,
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
          {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  spinner: {
    marginVertical: 2,
  },
  leftIcon: {
    marginRight: spacing[2],
  },
  rightIcon: {
    marginLeft: spacing[2],
  },
});
