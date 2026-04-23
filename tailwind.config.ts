import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--color-bg) / <alpha-value>)",
        surface: "hsl(var(--color-surface) / <alpha-value>)",
        "surface-muted": "hsl(var(--color-surface-muted) / <alpha-value>)",
        text: "hsl(var(--color-text) / <alpha-value>)",
        "text-muted": "hsl(var(--color-text-muted) / <alpha-value>)",
        border: "hsl(var(--color-border) / <alpha-value>)",
        accent: "hsl(var(--color-accent) / <alpha-value>)",
        "accent-foreground": "hsl(var(--color-accent-foreground) / <alpha-value>)",
        success: "hsl(var(--color-success) / <alpha-value>)",
        warning: "hsl(var(--color-warning) / <alpha-value>)",
        danger: "hsl(var(--color-danger) / <alpha-value>)",
        sidebar: "hsl(var(--color-sidebar) / <alpha-value>)",
        "sidebar-foreground": "hsl(var(--color-sidebar-foreground) / <alpha-value>)",
        "sidebar-accent": "hsl(var(--color-sidebar-accent) / <alpha-value>)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        popover: "var(--shadow-popover)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      maxWidth: { content: "var(--layout-content-max-width)" },
      width: { sidebar: "var(--layout-sidebar-width)" },
      height: { header: "var(--layout-header-height)" },
    },
  },
  plugins: [],
} satisfies Config;
