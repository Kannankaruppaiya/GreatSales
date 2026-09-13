import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { MOTION } from '../tokens/animation';

/**
 * Reusable animated entrance hook for screens and major cards.
 * Opacity: 0 -> 1, translateY: distance -> 0.
 */
export function useFadeSlideIn(delay = 0, distance = 14) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(distance);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, {
        duration: MOTION.duration.normal,
        easing: MOTION.easing.standard,
      }),
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, {
        duration: MOTION.duration.normal,
        easing: MOTION.easing.standard,
      }),
    );
  }, [delay, distance]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return animatedStyle;
}

/**
 * Reusable scale press hook for interactive buttons and cards.
 */
export function usePressScale() {
  const scale = useSharedValue(1);

  const onPressIn = () => {
    scale.value = withTiming(MOTION.scale.pressed, {
      duration: MOTION.duration.instant,
    });
  };

  const onPressOut = () => {
    scale.value = withSpring(MOTION.scale.normal, MOTION.easing.spring);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { onPressIn, onPressOut, animatedStyle };
}
