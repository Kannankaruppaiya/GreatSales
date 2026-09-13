/**
 * GreatSales Mobile Design System — Spacing & Layout Tokens.
 *
 * Based on 4px/8px grid system.
 * Minimum touch target: 44-48px.
 */

export const SPACING = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const spacing = SPACING;

export const LAYOUT = {
  screenPaddingHorizontal: 16,
  cardPadding: 16,
  cardGap: 12,
  minTouchTarget: 44,
  headerHeight: 56,
  bottomBarHeight: 64,
  bottomSheetHandleHeight: 24,
  inputHeight: 48,
  buttonHeight: 48,
  buttonHeightSm: 36,
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 56,
  avatarXl: 72,
} as const;

export const layout = LAYOUT;
