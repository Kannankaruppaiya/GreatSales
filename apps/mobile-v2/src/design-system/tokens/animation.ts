/**
 * GreatSales Mobile Design System — Motion & Animation Tokens.
 */

import { Easing } from 'react-native-reanimated';

export const MOTION = {
  duration: {
    instant: 100,
    fast: 180,
    normal: 260,
    emphasis: 360,
    staggerDelay: 45,
  },
  easing: {
    standard: Easing.bezier(0.2, 0, 0, 1),
    decelerate: Easing.bezier(0, 0, 0.2, 1),
    accelerate: Easing.bezier(0.4, 0, 1, 1),
    spring: {
      damping: 18,
      stiffness: 160,
      mass: 0.8,
    },
    bouncy: {
      damping: 12,
      stiffness: 180,
      mass: 0.6,
    },
  },
  scale: {
    pressed: 0.97,
    normal: 1,
    subtle: 0.985,
  },
} as const;
