/**
 * A Pressable that gives under the finger, the way iOS controls do: it springs
 * down to a slightly smaller size on press-in and back on release, on the UI
 * thread, so the response is immediate even while JS is busy.
 *
 * Opacity alone reads as a web button; the scale is what makes a card feel
 * like a physical thing being pushed. Keep `scaleTo` subtle — 0.97 for cards
 * and buttons, lower only for small round controls.
 */
import React from "react";
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DOWN = { damping: 20, stiffness: 420, mass: 0.6 } as const;
const UP = { damping: 14, stiffness: 300, mass: 0.6 } as const;

export interface PressScaleProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

export function PressScale({
  style,
  scaleTo = 0.97,
  disabled,
  onPressIn,
  onPressOut,
  children,
  ...rest
}: PressScaleProps) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) scale.value = withSpring(scaleTo, DOWN);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, UP);
        onPressOut?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
