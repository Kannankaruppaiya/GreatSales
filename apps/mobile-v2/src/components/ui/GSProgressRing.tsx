import React, { useEffect } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../design-system/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface GSProgressRingProps {
  value: number; // percentage 0-100+
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

export function GSProgressRing({
  value,
  size = 84,
  strokeWidth = 7,
  color,
  trackColor,
  children,
  style,
}: GSProgressRingProps) {
  const { colors } = useTheme();

  const clamped = Math.min(Math.max(value, 0), 100);
  const ringColor = color || (value >= 100 ? colors.success : colors.brand);
  const bgTrack = trackColor || colors.borderSubtle;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedPercent = useSharedValue(0);

  useEffect(() => {
    animatedPercent.value = withTiming(clamped, {
      duration: 900,
      easing: Easing.bezier(0.2, 0, 0, 1),
    });
  }, [clamped]);

  const animatedProps = useAnimatedProps(() => {
    const strokeDashoffset = circumference - (animatedPercent.value / 100) * circumference;
    return {
      strokeDashoffset,
    };
  });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      accessibilityLabel={`Achievement: ${Math.round(value)}%`}
      style={[styles.container, { width: size, height: size }, style]}
    >
      <Svg width={size} height={size} style={styles.svg}>
        {/* Background Track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgTrack}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Active Animated Ring */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          strokeLinecap="round"
          fill="none"
          originX={size / 2}
          originY={size / 2}
          rotation="-90"
        />
      </Svg>

      {children ? <View style={styles.childrenContainer}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  childrenContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
