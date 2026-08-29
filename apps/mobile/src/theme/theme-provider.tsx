/**
 * Theme context. Resolves the active color scheme (following the OS setting)
 * and exposes the full token set to the tree. Components call `useTheme()`
 * and never import raw color values, so light/dark stay consistent everywhere.
 */
import { createContext, use, useMemo, type ReactNode } from 'react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  darkColors,
  elevation as elevationFn,
  lightColors,
  motion,
  radii,
  spacing,
  typography,
  type ColorTokens,
  type ElevationLevel,
} from '@/theme/tokens';

export type ColorScheme = 'light' | 'dark';

export type Theme = {
  scheme: ColorScheme;
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  motion: typeof motion;
  /** Shadow/elevation style for the current scheme. */
  elevation: (level: ElevationLevel) => ReturnType<typeof elevationFn>;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  const value = useMemo<Theme>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      spacing,
      radii,
      typography,
      motion,
      elevation: (level: ElevationLevel) => elevationFn(level, scheme),
    }),
    [scheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): Theme {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
