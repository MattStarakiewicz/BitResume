"use client";

import { ThemeProvider } from "next-themes";
import type { ComponentProps } from "react";

type AppThemeProviderProps = ComponentProps<typeof ThemeProvider>;

export function AppThemeProvider({ children, ...props }: AppThemeProviderProps) {
  return <ThemeProvider {...props}>{children}</ThemeProvider>;
}
