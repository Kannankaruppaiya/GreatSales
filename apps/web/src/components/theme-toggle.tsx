/** Light/dark toggle. Follows the OS until the user overrides it. */
import { Moon, Sun } from "lucide-react";

import { useThemeControl } from "@/theme/theme-provider";

export function ThemeToggle() {
  const { resolved, toggle } = useThemeControl();
  const nextIsDark = resolved === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={nextIsDark ? "Switch to dark theme" : "Switch to light theme"}
      className="grid size-10 place-items-center rounded-field border border-border bg-surface text-fg-secondary hover:text-fg hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      {resolved === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
