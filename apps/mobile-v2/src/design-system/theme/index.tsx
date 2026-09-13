import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { PALETTE_LIGHT, PALETTE_DARK, type ColorPalette } from '../tokens/colors';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ColorPalette;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('dark');

  const isDark = useMemo(() => {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return systemScheme === 'dark';
  }, [mode, systemScheme]);

  const colors = useMemo(() => {
    return isDark ? PALETTE_DARK : PALETTE_LIGHT;
  }, [isDark]);

  const value = useMemo(
    () => ({
      mode,
      isDark,
      colors,
      setMode,
    }),
    [mode, isDark, colors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback if rendered outside provider
    return {
      mode: 'system',
      isDark: false,
      colors: PALETTE_LIGHT,
      setMode: () => {},
    };
  }
  return ctx;
}

export function useColors(): ColorPalette {
  return useTheme().colors;
}
