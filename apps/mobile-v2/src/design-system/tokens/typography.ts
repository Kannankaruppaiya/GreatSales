/**
 * GreatSales Mobile Design System — Typography Tokens.
 *
 * Font family: Plus Jakarta Sans with standard System fallback.
 * Hierarchy:
 *   - displayLarge: 32-36
 *   - display: 28-32
 *   - largeHeading: 24-28
 *   - heading1 / h1: 22
 *   - heading2 / h2: 18
 *   - sectionHeading: 16-18
 *   - cardTitle: 15
 *   - body: 14
 *   - secondary / bodySmall: 12-13
 *   - caption: 11
 *   - micro: 10
 *
 * Includes dedicated tabular financial number presets.
 */

export const FONT_FAMILIES = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extraBold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const TYPOGRAPHY = {
  displayLarge: {
    fontFamily: FONT_FAMILIES.extraBold,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
  },
  display: {
    fontFamily: FONT_FAMILIES.extraBold,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
  },
  largeHeading: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.4,
  },
  h1: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  heading1: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  h2: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  heading2: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  sectionHeading: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.15,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.1,
  },
  cardTitle: {
    fontFamily: FONT_FAMILIES.semiBold,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: -0.05,
  },
  body: {
    fontFamily: FONT_FAMILIES.regular,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontFamily: FONT_FAMILIES.medium,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500' as const,
    letterSpacing: 0,
  },
  bodySmall: {
    fontFamily: FONT_FAMILIES.regular,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  bodySmallMedium: {
    fontFamily: FONT_FAMILIES.medium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    letterSpacing: 0.1,
  },
  secondary: {
    fontFamily: FONT_FAMILIES.regular,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    letterSpacing: 0.15,
  },
  caption: {
    fontFamily: FONT_FAMILIES.medium,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  micro: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },

  // Semantic Presets & Aliases
  screenTitle: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  label: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontFamily: FONT_FAMILIES.medium,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
    letterSpacing: 0.1,
  },

  // Tabular Financial Data Presets
  financialHero: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums' as const],
  },
  financialMetric: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums' as const],
  },
  financialSub: {
    fontFamily: FONT_FAMILIES.semiBold,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums' as const],
  },
  numericLarge: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums' as const],
  },
  numericMedium: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums' as const],
  },
  currency: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums' as const],
  },
  percentage: {
    fontFamily: FONT_FAMILIES.bold,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums' as const],
  },
} as const;

export const typography = TYPOGRAPHY;

export type TypographyVariant = keyof typeof TYPOGRAPHY;
