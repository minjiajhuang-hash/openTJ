"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
  document.documentElement.dataset.themeMode = mode;
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const stored = localStorage.getItem("opentj-theme") as ThemeMode | null;
    const initial = stored && ["light", "dark", "system"].includes(stored) ? stored : "system";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- theme preference is synchronized from local storage after hydration.
    setMode(initial);
    applyTheme(initial);

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      if ((localStorage.getItem("opentj-theme") ?? "system") === "system") applyTheme("system");
    };
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const nextMode = () => {
    const next: ThemeMode = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
    localStorage.setItem("opentj-theme", next);
    setMode(next);
    applyTheme(next);
  };

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : SunMoon;
  return (
    <button aria-label={`Theme: ${mode}. Change theme`} className="header-button" onClick={nextMode} title={`Theme: ${mode}`} type="button">
      <Icon aria-hidden="true" />
      <span className="header-action-label">{mode[0]?.toUpperCase()}{mode.slice(1)}</span>
    </button>
  );
}
