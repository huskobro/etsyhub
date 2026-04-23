export const defaultTokens = {
  colors: {
    bg: "0 0% 100%",
    surface: "0 0% 98%",
    surfaceMuted: "0 0% 96%",
    text: "0 0% 7%",
    textMuted: "0 0% 45%",
    border: "0 0% 90%",
    accent: "14 100% 57%",
    accentForeground: "0 0% 100%",
    success: "142 71% 45%",
    warning: "38 92% 50%",
    danger: "0 84% 60%",
    sidebar: "0 0% 98%",
    sidebarForeground: "0 0% 20%",
    sidebarAccent: "14 100% 57%",
  },
  radius: { sm: "4px", md: "8px", lg: "12px", full: "9999px" },
  shadow: {
    card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
    popover:
      "0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.05)",
  },
  spacing: {
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px",
  },
  font: {
    sans: "Inter, system-ui, -apple-system, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  layout: {
    sidebarWidth: "240px",
    headerHeight: "56px",
    contentMaxWidth: "1440px",
  },
} as const;

export type DesignTokens = typeof defaultTokens;

export function tokensToCssVars(tokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(tokens.colors))
    vars[`--color-${kebab(name)}`] = value;
  for (const [name, value] of Object.entries(tokens.radius))
    vars[`--radius-${name}`] = value;
  for (const [name, value] of Object.entries(tokens.shadow))
    vars[`--shadow-${name}`] = value;
  for (const [name, value] of Object.entries(tokens.spacing))
    vars[`--space-${name}`] = value;
  for (const [name, value] of Object.entries(tokens.font))
    vars[`--font-${name}`] = value;
  for (const [name, value] of Object.entries(tokens.layout))
    vars[`--layout-${kebab(name)}`] = value;
  return vars;
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
