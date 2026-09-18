/**
 * The two display preferences the app can honour by itself.
 *
 * Deliberately in memory only. Persisting them would mean choosing a store —
 * device storage or an API that does not have a settings endpoint — and a
 * preference that half-persists is worse than one that plainly does not. The
 * settings screen says as much.
 */
import React, { createContext, useContext, useMemo, useState } from "react";

import { setDateFormatPattern } from "./format";

export type ThemePreference = "system" | "light";
export type DateFormatPreference = "dmy" | "mdy" | "iso";

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: "Follow the system",
  light: "Always light",
};

export const DATE_FORMAT_LABELS: Record<DateFormatPreference, string> = {
  dmy: "18 Sep 2026",
  mdy: "Sep 18, 2026",
  iso: "2026-09-18",
};

interface PreferencesValue {
  theme: ThemePreference;
  setTheme: (next: ThemePreference) => void;
  dateFormat: DateFormatPreference;
  setDateFormat: (next: DateFormatPreference) => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [dateFormat, setDateFormatState] =
    useState<DateFormatPreference>("dmy");

  // `longDate` reads a module-level pattern, so the choice is pushed there and
  // into React state together: one makes the dates change, the other makes the
  // screen re-render to show it.
  const setDateFormat = (next: DateFormatPreference) => {
    setDateFormatPattern(next);
    setDateFormatState(next);
  };

  const value = useMemo(
    () => ({ theme, setTheme, dateFormat, setDateFormat }),
    [theme, dateFormat],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

/**
 * Falls back to the defaults outside a provider rather than throwing: a
 * preference is a convenience, and a screen that renders without one is
 * better than a screen that does not render.
 */
export function usePreferences(): PreferencesValue {
  return (
    useContext(PreferencesContext) ?? {
      theme: "system",
      setTheme: () => {},
      dateFormat: "dmy",
      setDateFormat: () => {},
    }
  );
}
