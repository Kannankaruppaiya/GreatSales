/**
 * Design tokens for the JavaScript side.
 *
 * Tailwind classes get their colour from CSS variables in `src/global.css`.
 * This file is the same palette for the places a className cannot reach: an
 * `ActivityIndicator` colour, a `tabBarActiveTintColor`, the `color` prop on an
 * SVG icon, a `StatusBar` style.
 *
 * Read colour through `useC()`, not through `C`. `C` is the light palette and
 * is kept only so screens that have not been rewritten yet still compile — a
 * component that reads it renders light even when the phone is dark.
 *
 * On the `*Dark` roles: they are foregrounds painted on a `*Soft` background
 * (see TONE below). A soft background in dark mode is dark, so the role has to
 * flip to the light end of the ramp. They are inverted in DARK on purpose.
 */
import { useColorScheme } from 'react-native';

const light = {
  canvas: '#f8fafc',
  canvasSubtle: '#f1f5f9',
  surface: '#ffffff',
  surface2: '#f8fafc',
  surface3: '#f1f5f9',
  surfaceActive: '#e2e8f0',

  ink: '#0f172a',
  ink2: '#1e293b',
  body: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',

  line: '#e2e8f0',
  lineDark: '#cbd5e1',

  brand: '#059669',
  brandLight: '#10b981',
  brandHover: '#047857',
  brandDark: '#064e3b',
  brandSoft: '#ecfdf5',
  brandBorder: '#a7f3d0',
  brandInk: '#022c22',

  amber: '#d97706',
  amberDark: '#b45309',
  amberSoft: '#fffbeb',
  amberBorder: '#fde68a',

  red: '#dc2626',
  redDark: '#991b1b',
  redSoft: '#fef2f2',
  redBorder: '#fecaca',

  blue: '#2563eb',
  blueDark: '#1e40af',
  blueSoft: '#eff6ff',
  blueBorder: '#bfdbfe',

  indigo: '#4f46e5',
  indigoDark: '#3730a3',
  indigoSoft: '#eef2ff',
  indigoBorder: '#c7d2fe',

  violet: '#7c3aed',
  violetDark: '#5b21b6',
  violetSoft: '#f5f3ff',
  violetBorder: '#ddd6fe',

  shadowTint: '#0f172a',
  white: '#ffffff',
  black: '#000000',
};

/** Every palette has exactly these keys; values are plain colour strings. */
export type Palette = typeof light;

export const LIGHT: Palette = light;

export const DARK: Palette = {
  canvas: '#0b1220',
  canvasSubtle: '#141d2e',
  surface: '#141d2e',
  surface2: '#1a2436',
  surface3: '#212d43',
  surfaceActive: '#2b3854',

  ink: '#f8fafc',
  ink2: '#e2e8f0',
  body: '#cbd5e1',
  muted: '#94a3b8',
  faint: '#64748b',

  line: '#26324b',
  lineDark: '#3b4a6b',

  brand: '#10b981',
  brandLight: '#34d399',
  brandHover: '#059669',
  brandDark: '#a7f3d0',
  brandSoft: '#0c2f24',
  brandBorder: '#14563f',
  brandInk: '#d1fae5',

  amber: '#f59e0b',
  amberDark: '#fcd34d',
  amberSoft: '#2b1f08',
  amberBorder: '#6b4a10',

  red: '#f87171',
  redDark: '#fca5a5',
  redSoft: '#2c1416',
  redBorder: '#6b2226',

  blue: '#60a5fa',
  blueDark: '#93c5fd',
  blueSoft: '#101f38',
  blueBorder: '#1e4272',

  indigo: '#818cf8',
  indigoDark: '#a5b4fc',
  indigoSoft: '#171a3a',
  indigoBorder: '#33367a',

  violet: '#a78bfa',
  violetDark: '#c4b5fd',
  violetSoft: '#1c1636',
  violetBorder: '#3d2f6b',

  shadowTint: '#000000',
  white: '#ffffff',
  black: '#000000',
};

/** The palette for the phone's current appearance. Prefer this over `C`. */
export function useC(): Palette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

/** @deprecated Light only — use `useC()`. Kept so unmigrated screens compile. */
export const C = LIGHT;

export type Tone = 'won' | 'hot' | 'open' | 'lost' | 'neutral';

export function toneMap(p: Palette): Record<Tone, { fg: string; bg: string; border: string }> {
  return {
    won: { fg: p.brandDark, bg: p.brandSoft, border: p.brandBorder },
    hot: { fg: p.amberDark, bg: p.amberSoft, border: p.amberBorder },
    open: { fg: p.blueDark, bg: p.blueSoft, border: p.blueBorder },
    lost: { fg: p.redDark, bg: p.redSoft, border: p.redBorder },
    neutral: { fg: p.muted, bg: p.surface3, border: p.line },
  };
}

export function useTone() {
  return toneMap(useC());
}

/** @deprecated Light only — use `useTone()`. */
export const TONE = toneMap(LIGHT);

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { xs: 6, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999 } as const;

/**
 * Four sizes, not seven. A dense CRM row needs a title, a value, a label and a
 * hero number; anything between those just blurs the hierarchy.
 */
export const F = {
  hero: 28,
  h1: 24,
  h2: 19,
  title: 15,
  body: 13,
  sm: 12,
  xs: 11,
  micro: 10,
} as const;

/** ₹ figures must not wobble as digits change — every amount uses this. */
export const NUM = { fontVariant: ['tabular-nums' as const] };

export function shadows(p: Palette) {
  return {
    sm: {
      shadowColor: p.shadowTint,
      shadowOpacity: p === DARK ? 0.4 : 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    card: {
      shadowColor: p.shadowTint,
      shadowOpacity: p === DARK ? 0.5 : 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    float: {
      shadowColor: p.shadowTint,
      shadowOpacity: p === DARK ? 0.6 : 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
  };
}

export function useShadow() {
  return shadows(useC());
}

/** @deprecated Light only — use `useShadow()`. */
export const shadow = shadows(LIGHT);
