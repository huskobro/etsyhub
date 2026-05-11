/**
 * R3.5 — defaultTokens Kivasy v4 paletine hizalandı.
 *
 * Bu değerler ThemeProvider tarafından runtime'da `<body>` element'ine
 * yazılır (admin Theme editor için override pipeline). globals.css :root
 * default'larıyla aynı palet olmalı; aksi halde canlı render globals'ı
 * runtime override ediyor ve eski "Editorial Cockpit" hissi sızıyor.
 */
export const defaultTokens = {
  colors: {
    // Surfaces — Kivasy v4 warm paper
    bg: "45 36% 95%",          // --k-bg #F7F5EF
    surface: "0 0% 100%",      // --k-paper #FFFFFF
    surfaceMuted: "45 27% 92%", // --k-bg-2 #F1EEE5
    surface2: "45 27% 92%",
    surface3: "43 23% 86%",    // --k-line tier as hover row tint

    // Text — Kivasy v4 ink
    text: "34 19% 7%",          // --k-ink #16130F
    textMuted: "36 8% 27%",     // --k-ink-2 #4A4640
    textSubtle: "33 8% 52%",    // --k-ink-3 #8B857C

    // Borders
    border: "43 23% 86%",       // --k-line #E4E0D5
    borderStrong: "40 19% 78%", // --k-line-strong #D2CCBE
    borderSubtle: "43 27% 91%", // --k-line-soft #EFEBE0

    // Accent — Kivasy v4 orange
    accent: "17 81% 53%",       // --k-orange #E85D25
    accentHover: "17 78% 45%",  // --k-orange-deep #C9491A
    accentSoft: "24 78% 93%",   // --k-orange-soft #FBEADF
    accentText: "18 78% 31%",   // --k-orange-ink #8E3A12
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

    // Sidebar legacy aliases (ThemeProvider runtime override uyumu)
    sidebar: "45 27% 92%",       // --k-bg-2
    sidebarForeground: "34 19% 7%",
    sidebarAccent: "17 81% 53%",
  },
  radius: { sm: "5px", md: "8px", lg: "14px", full: "9999px" },
  shadow: {
    card: "0 1px 1px rgba(22, 19, 15, 0.03)",
    popover:
      "0 12px 32px rgba(22, 19, 15, 0.12), 0 2px 6px rgba(22, 19, 15, 0.06)",
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
    // Kivasy stack (R3.5). Legacy `--font-inter` / `--font-plex-mono`
    // hâlâ next/font tarafından dolduruluyor ama kullanılmıyor.
    sans: '"General Sans", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono", ui-monospace, Menlo, monospace',
  },
  layout: {
    sidebarWidth: "248px", // Kivasy v4 sidebar width
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
