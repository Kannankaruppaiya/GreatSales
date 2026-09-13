import React from 'react';
import { Pressable, View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { spacing, radius, shadows } from '../../design-system/tokens';
import { hapticFeedback } from '../../utils/haptics';

export interface GSCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: 'elevated' | 'flat' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function GSCard({
  children,
  onPress,
  variant = 'bordered',
  padding = 'md',
  style,
  accessibilityLabel,
  testID,
}: GSCardProps) {
  const { colors, isDark } = useTheme();

  const pad = {
    none: 0,
    sm: spacing[3],
    md: spacing[4],
    lg: spacing[6],
  }[padding];

  const shadowStyle = variant === 'elevated' ? (isDark ? {} : shadows.sm) : {};

  const cardStyle: ViewStyle = StyleSheet.flatten([
    {
      backgroundColor:
        variant === 'flat'
          ? colors.surfaceMuted
          : variant === 'elevated'
          ? colors.surfaceElevated
          : colors.surfaceElevated,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      padding: pad,
      ...shadowStyle,
    },
    style,
  ]);

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => {
          hapticFeedback('light');
          onPress();
        }}
        style={({ pressed }) => [
          cardStyle,
          pressed && {
            backgroundColor: colors.surfaceInteractive,
            transform: [{ scale: 0.985 }],
          },
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View testID={testID} style={cardStyle} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}
