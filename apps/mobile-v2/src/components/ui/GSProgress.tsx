import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../design-system/theme';
import { radius } from '../../design-system/tokens';

export interface GSProgressProps {
  value: number; // 0 to 100+
  height?: number;
  color?: string;
  trackColor?: string;
  style?: ViewStyle;
}

export function GSProgress({
  value,
  height = 6,
  color,
  trackColor,
  style,
}: GSProgressProps) {
  const { colors } = useTheme();

  const clamped = Math.min(Math.max(value, 0), 100);
  const barColor = color || (value >= 100 ? colors.success : colors.brand);
  const bgTrack = trackColor || colors.surfaceMuted;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      accessibilityLabel={`Progress: ${Math.round(clamped)}%`}
      style={[
        styles.track,
        {
          height,
          backgroundColor: bgTrack,
          borderRadius: radius.full,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clamped}%`,
            backgroundColor: barColor,
            borderRadius: radius.full,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
