export const defaultTokens = {
  colors: {
    // Surfaces — warm off-white family
    bg: "60 23% 97%",
    surface: "0 0% 100%",
    surfaceMuted: "51 23% 94%",
    surface2: "51 23% 94%",
    surface3: "47 18% 90%",

    // Text
    text: "24 11% 9%",
    textMuted: "30 6% 40%",
    textSubtle: "32 6% 58%",

    // Borders
    border: "45 14% 89%",
    borderStrong: "45 13% 82%",
    borderSubtle: "51 18% 92%",

    // Accent — #E85D25 family
    accent: "17 81% 53%",
    accentHover: "17 78% 46%",
    accentSoft: "24 78% 93%",
    accentText: "18 77% 39%",
    accentForeground: "0 0% 100%",

    // Status
    success: "142 44% 33%",
    successSoft: "143 32% 92%",
    warning: "36 79% 39%",
    warningSoft: "41 64% 90%",
    danger: "8 63% 43%",
    dangerSoft: "12 60% 90%",
    info: "209 52% 37%",
    infoSoft: "207 55% 92%",

    // Sidebar legacy aliases (ThemeProvider uyumu)
    sidebar: "51 23% 94%",
    sidebarForeground: "24 11% 9%",
    sidebarAccent: "17 81% 53%",
  },
  radius: { sm: "4px", md: "6px", lg: "10px", full: "9999px" },
  shadow: {
    card: "0 1px 2px rgba(26, 23, 21, 0.04), 0 1px 1px rgba(26, 23, 21, 0.03)",
    popover:
      "0 12px 32px rgba(26, 23, 21, 0.12), 0 2px 6px rgba(26, 23, 21, 0.06)",
  },
  spacing: {
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "7": "28px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px",
    "20": "80px",
  },
  font: {
    sans: 'var(--font-inter), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: 'var(--font-plex-mono), "IBM Plex Mono", ui-monospace, Menlo, monospace',
  },
  layout: {
    sidebarWidth: "232px",
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
