/**
 * GreatSales design tokens — the single source of truth for color, type,
 * spacing, radii, elevation and motion. Screens and components must consume
 * these tokens (via `useTheme()`), never hard-coded values, so the product
 * reads as one coherent system in both light and dark mode.
 *
 * Color intent: every token is semantic (what it's for), not decorative (what
 * it looks like). Contrast targets follow WCAG 2.2 — body text ≥ 4.5:1 against
 * its background, and status is never signalled by color alone (components pair
 * every color with an icon and/or text label).
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/* ------------------------------------------------------------------ */
/* Spacing — a single 4pt-based scale. No arbitrary margins anywhere.  */
/* ------------------------------------------------------------------ */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;
export type SpacingKey = keyof typeof spacing;

/* ------------------------------------------------------------------ */
/* Radii                                                               */
/* ------------------------------------------------------------------ */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;
export type RadiusKey = keyof typeof radii;

/* ------------------------------------------------------------------ */
/* Minimum interactive hit area (Android 48dp / iOS ~44pt).            */
/* The visible control may be smaller; the touch target must not be.   */
/* ------------------------------------------------------------------ */
export const hitTarget = Platform.select({ ios: 44, default: 48 }) as number;

/* ------------------------------------------------------------------ */
/* Typography — one type scale, weights as RN-safe strings.            */
/* ------------------------------------------------------------------ */
const weight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: weight.bold, letterSpacing: 0.2 },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: weight.bold, letterSpacing: 0.2 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: weight.bold },
  h3: { fontSize: 18, lineHeight: 24, fontWeight: weight.semibold },
  bodyLg: { fontSize: 17, lineHeight: 25, fontWeight: weight.regular },
  body: { fontSize: 15, lineHeight: 22, fontWeight: weight.regular },
  bodySm: { fontSize: 13, lineHeight: 18, fontWeight: weight.regular },
  label: { fontSize: 13, lineHeight: 16, fontWeight: weight.semibold, letterSpacing: 0.3 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: weight.medium },
  button: { fontSize: 16, lineHeight: 20, fontWeight: weight.semibold },
  mono: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: weight.medium,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
} as const satisfies Record<string, TextStyle>;
export type TypographyVariant = keyof typeof typography;

/* ------------------------------------------------------------------ */
/* Color — semantic tokens for light and dark.                         */
/* ------------------------------------------------------------------ */
export type ColorTokens = {
  /** App canvas (lowest layer). */
  bg: string;
  /** Default card/sheet surface. */
  surface: string;
  /** Raised surface (menus, floating cards). */
  surfaceElevated: string;
  /** Recessed surface (inset groups, track backgrounds). */
  surfaceSunken: string;
  /** Text-input field background. */
  inputBg: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Text/icon that sits on a `primary`-filled surface. */
  textOnPrimary: string;

  primary: string;
  /** Pressed/active state of primary. */
  primaryPressed: string;
  /** Low-emphasis primary tint (chips, selected rows). */
  primarySubtle: string;

  border: string;
  borderStrong: string;
  divider: string;

  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  error: string;
  errorSubtle: string;
  info: string;
  infoSubtle: string;

  /** Focus ring for keyboard/AT focus. */
  focus: string;
  /** Scrim behind modals/sheets. */
  overlay: string;

  disabledBg: string;
  disabledText: string;

  tabBar: string;
  tabActive: string;
  tabInactive: string;

  skeleton: string;
};

export const lightColors: ColorTokens = {
  bg: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#EDF0F4',
  inputBg: '#FFFFFF',

  textPrimary: '#0E1420',
  textSecondary: '#4B5563',
  textMuted: '#8792A2',
  textOnPrimary: '#FFFFFF',

  primary: '#1A5CD8',
  primaryPressed: '#1447AE',
  primarySubtle: '#E8F0FE',

  border: '#D5DBE3',
  borderStrong: '#B9C1CC',
  divider: '#E6EAEF',

  success: '#1B873F',
  successSubtle: '#E6F4EA',
  warning: '#8A5200',
  warningSubtle: '#FBF0DD',
  error: '#C4291C',
  errorSubtle: '#FBE9E7',
  info: '#1A5CD8',
  infoSubtle: '#E8F0FE',

  focus: '#1A5CD8',
  overlay: 'rgba(9,14,20,0.45)',

  disabledBg: '#E7EAEF',
  disabledText: '#A9B2BE',

  tabBar: '#FFFFFF',
  tabActive: '#1A5CD8',
  tabInactive: '#6B7480',

  skeleton: '#E6EAEF',
};

export const darkColors: ColorTokens = {
  bg: '#0B0F16',
  surface: '#131926',
  surfaceElevated: '#1A2230',
  surfaceSunken: '#0E141F',
  inputBg: '#131926',

  textPrimary: '#F1F4F8',
  textSecondary: '#AEB8C4',
  textMuted: '#7A8494',
  textOnPrimary: '#FFFFFF',

  primary: '#2C63CF',
  primaryPressed: '#3B74E0',
  primarySubtle: '#17233B',

  border: '#273040',
  borderStrong: '#3A4555',
  divider: '#1E2836',

  success: '#43C46F',
  successSubtle: '#12281B',
  warning: '#E0A33E',
  warningSubtle: '#2B2210',
  error: '#F0776B',
  errorSubtle: '#2C1512',
  info: '#5B94F0',
  infoSubtle: '#17233B',

  focus: '#5B94F0',
  overlay: 'rgba(0,0,0,0.6)',

  disabledBg: '#1B2330',
  disabledText: '#5A6572',

  tabBar: '#0E141F',
  tabActive: '#5B94F0',
  tabInactive: '#7A8494',

  skeleton: '#1E2836',
};

/* ------------------------------------------------------------------ */
/* Elevation — restrained, platform-aware. Level 0 = flat.             */
/* Dark mode leans on surface color rather than heavy shadows.         */
/* ------------------------------------------------------------------ */
export type ElevationLevel = 0 | 1 | 2 | 3;

export function elevation(level: ElevationLevel, scheme: 'light' | 'dark'): ViewStyle {
  if (level === 0) return {};
  if (scheme === 'dark') {
    // Shadows read poorly on near-black; use a hairline lift only.
    return Platform.select<ViewStyle>({
      android: { elevation: level },
      default: {},
    }) as ViewStyle;
  }
  const map: Record<Exclude<ElevationLevel, 0>, ViewStyle> = {
    1: {
      shadowColor: '#0B1220',
      shadowOpacity: 0.06,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    2: {
      shadowColor: '#0B1220',
      shadowOpacity: 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    3: {
      shadowColor: '#0B1220',
      shadowOpacity: 0.14,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
  };
  return map[level];
}

/* ------------------------------------------------------------------ */
/* Motion — short, purposeful. Honour reduced-motion at call sites.    */
/* ------------------------------------------------------------------ */
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;
