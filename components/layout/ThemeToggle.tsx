"use client";

import { useTheme } from "next-themes";

import { IconMoon, IconSun } from "@/components/ui/icons";
import { useHydrated } from "@/lib/useHydrated";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // The resolved theme is unknown during SSR, so render a stable icon until
  // after hydration rather than guessing and flipping. Gating the label on the
  // same value keeps the icon and its accessible name from disagreeing.
  const hydrated = useHydrated();

  const isDark = hydrated && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-lg border border-line bg-surface p-2 text-ink-muted transition hover:bg-surface-3 hover:text-ink"
    >
      {isDark ? <IconSun className="size-4" /> : <IconMoon className="size-4" />}
    </button>
  );
}
