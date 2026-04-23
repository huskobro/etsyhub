"use client";

import { useEffect, type ReactNode } from "react";
import { tokensToCssVars, type DesignTokens } from "@/features/theme/design-tokens";

export function ThemeProvider({ tokens, children }: { tokens: DesignTokens; children: ReactNode }) {
  useEffect(() => {
    const vars = tokensToCssVars(tokens);
    for (const [key, value] of Object.entries(vars)) {
      document.documentElement.style.setProperty(key, value);
    }
  }, [tokens]);

  return <>{children}</>;
}
