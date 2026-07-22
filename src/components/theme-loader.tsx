"use client";

import { useEffect } from "react";
import { loadTheme, applyTheme } from "@/lib/theme";

export function ThemeLoader() {
  useEffect(() => {
    const theme = loadTheme();
    applyTheme(theme);
  }, []);

  return null;
}
