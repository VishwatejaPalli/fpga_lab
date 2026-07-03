"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
type FontSize = "small" | "medium" | "large";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  animations: boolean;
  setAnimations: (animations: boolean) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => null,
  animations: true,
  setAnimations: () => null,
  fontSize: "medium",
  setFontSize: () => null,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [animations, setAnimationsState] = useState<boolean>(true);
  const [fontSize, setFontSizeState] = useState<FontSize>("medium");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme;
    if (savedTheme) {
      setThemeState(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }

    const savedAnimations = localStorage.getItem("animations");
    if (savedAnimations !== null) {
      const isEnabled = savedAnimations === "true";
      setAnimationsState(isEnabled);
      document.documentElement.setAttribute("data-animations", isEnabled.toString());
    } else {
      document.documentElement.setAttribute("data-animations", "true");
    }

    const savedFontSize = localStorage.getItem("fontSize") as FontSize;
    if (savedFontSize) {
      setFontSizeState(savedFontSize);
      document.documentElement.setAttribute("data-font-size", savedFontSize);
    } else {
      document.documentElement.setAttribute("data-font-size", "medium");
    }

    setMounted(true);
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const setAnimations = (enabled: boolean) => {
    setAnimationsState(enabled);
    localStorage.setItem("animations", enabled.toString());
    document.documentElement.setAttribute("data-animations", enabled.toString());
  };

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem("fontSize", size);
    document.documentElement.setAttribute("data-font-size", size);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, animations, setAnimations, fontSize, setFontSize }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
