import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        bg: "hsl(var(--color-bg) / <alpha-value>)",
        surface: "hsl(var(--color-surface) / <alpha-value>)",
        "surface-muted": "hsl(var(--color-surface-muted) / <alpha-value>)",
        "surface-2": "hsl(var(--color-surface-2) / <alpha-value>)",
        "surface-3": "hsl(var(--color-surface-3) / <alpha-value>)",

        // Text
        text: "hsl(var(--color-text) / <alpha-value>)",
        "text-muted": "hsl(var(--color-text-muted) / <alpha-value>)",
        "text-subtle": "hsl(var(--color-text-subtle) / <alpha-value>)",

        // Borders
        border: "hsl(var(--color-border) / <alpha-value>)",
        "border-strong": "hsl(var(--color-border-strong) / <alpha-value>)",
        "border-subtle": "hsl(var(--color-border-subtle) / <alpha-value>)",

        // Accent
        accent: "hsl(var(--color-accent) / <alpha-value>)",
        "accent-hover": "hsl(var(--color-accent-hover) / <alpha-value>)",
        "accent-soft": "hsl(var(--color-accent-soft) / <alpha-value>)",
        "accent-text": "hsl(var(--color-accent-text) / <alpha-value>)",
        "accent-foreground": "hsl(var(--color-accent-foreground) / <alpha-value>)",

        // Status
        success: "hsl(var(--color-success) / <alpha-value>)",
        "success-soft": "hsl(var(--color-success-soft) / <alpha-value>)",
        warning: "hsl(var(--color-warning) / <alpha-value>)",
        "warning-soft": "hsl(var(--color-warning-soft) / <alpha-value>)",
        danger: "hsl(var(--color-danger) / <alpha-value>)",
        "danger-soft": "hsl(var(--color-danger-soft) / <alpha-value>)",
        info: "hsl(var(--color-info) / <alpha-value>)",
        "info-soft": "hsl(var(--color-info-soft) / <alpha-value>)",

        // Sidebar legacy aliases
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
        "card-hover": "var(--shadow-card-hover)",
        popover: "var(--shadow-popover)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      fontSize: {
        xs: "var(--text-xs)",
        sm: "var(--text-sm)",
        base: "var(--text-base)",
        md: "var(--text-md)",
        lg: "var(--text-lg)",
        xl: "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
      },
      maxWidth: {
        content: "var(--layout-content-max-width)",
        "state-body": "var(--max-w-state-body)",
      },
      width: {
        sidebar: "var(--layout-sidebar-width)",
        "control-sm": "var(--control-h-sm)",
        "control-md": "var(--control-h-md)",
        "control-lg": "var(--control-h-lg)",
      },
      height: {
        header: "var(--layout-header-height)",
        "control-sm": "var(--control-h-sm)",
        "control-md": "var(--control-h-md)",
        "control-lg": "var(--control-h-lg)",
      },
      aspectRatio: {
        card: "4 / 3",
        portrait: "2 / 3",
        square: "1 / 1",
      },
      minHeight: {
        textarea: "var(--min-h-textarea)",
      },
      scale: {
        subtle: "1.015",
      },
      letterSpacing: {
        meta: "var(--tracking-meta)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        DEFAULT: "var(--dur)",
      },
      keyframes: {
        ehPulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        ehPulse: "ehPulse 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
