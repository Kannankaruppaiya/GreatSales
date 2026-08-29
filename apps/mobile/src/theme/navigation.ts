/**
 * Bridges our tokens into a React Navigation theme so navigator chrome
 * (headers, tab bar, card backgrounds) matches the design system in both
 * schemes. Themes are sourced from expo-router's re-export of React
 * Navigation, so we don't take a direct dependency on the navigation package.
 */
import { DarkTheme, DefaultTheme } from 'expo-router';

import { darkColors, lightColors } from '@/theme/tokens';

export function navTheme(scheme: 'light' | 'dark'): typeof DefaultTheme {
  const c = scheme === 'dark' ? darkColors : lightColors;
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.bg,
      card: c.surface,
      text: c.textPrimary,
      border: c.border,
      notification: c.error,
    },
  };
}
