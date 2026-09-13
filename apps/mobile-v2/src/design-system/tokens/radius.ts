/**
 * GreatSales Mobile Design System — Radius Tokens.
 */

export const RADIUS = {
  none: 0,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

export const radius = RADIUS;

export type RadiusSize = keyof typeof RADIUS;
