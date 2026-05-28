"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";

/**
 * Theme toggle with a View Transitions API circle reveal anchored to
 * the button's center. The new theme appears under an expanding
 * clip-path circle, falling back to an instant swap on browsers
 * without `document.startViewTransition` or when the user prefers
 * reduced motion.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark";

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const root = document.documentElement;
    root.style.setProperty("--theme-toggle-x", `${x}px`);
    root.style.setProperty("--theme-toggle-y", `${y}px`);
    root.style.setProperty("--theme-toggle-r", `${maxRadius}px`);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (
      reduceMotion ||
      typeof document.startViewTransition !== "function"
    ) {
      setTheme(nextTheme);
      return;
    }

    document.startViewTransition(() => {
      flushSync(() => {
        setTheme(nextTheme);
      });
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        mounted
          ? `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`
          : "Toggle theme"
      }
      className="relative grid h-8 w-8 place-items-center rounded-md border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
    >
      <Sun
        className="h-4 w-4 rotate-0 scale-100 transition-transform duration-200 ease-out dark:-rotate-90 dark:scale-0 motion-reduce:transition-none"
        aria-hidden="true"
      />
      <Moon
        className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-200 ease-out dark:rotate-0 dark:scale-100 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </button>
  );
}
