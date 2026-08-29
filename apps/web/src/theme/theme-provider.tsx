/**
 * Theme control. Resolves light/dark from a stored preference
 * ('system' | 'light' | 'dark') and applies the `.dark` class to <html> that
 * the token layer (index.css) keys off. Defaults to following the OS, matching
 * the mobile app, but allows a manual override via the topbar toggle.
 */
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "system" | "light" | "dark";
type Resolved = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: Resolved;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
};

const STORAGE_KEY = "gs.theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function systemScheme(): Resolved {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [systemPref, setSystemPref] = useState<Resolved>(systemScheme);

  // Track OS scheme changes (relevant while preference === 'system').
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => setSystemPref(e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: Resolved = preference === "system" ? systemPref : preference;

  // Apply the class the token layer reads.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    try {
      localStorage.setItem(STORAGE_KEY, p);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useThemeControl(): ThemeContextValue {
  const ctx = use(ThemeContext);
  if (!ctx) throw new Error("useThemeControl must be used within a ThemeProvider");
  return ctx;
}
