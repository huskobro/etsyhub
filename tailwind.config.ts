import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  // R3.5 — Kivasy v4 component recipes are defined in globals.css under
  // `@layer base`. JIT purges class definitions whose selectors aren't
  // matched in `content`, so recipes that aren't yet used by any
  // component (e.g. `.k-card--hero` waits for rollout-4 selection cards)
  // get dropped from the production bundle. Safelist ensures the recipe
  // CSS ships even if the className appears for the first time at runtime.
  safelist: [
    "k-mono",
    "k-display",
    "k-tnum",
    "k-wordmark",
    "k-btn",
    "k-btn--primary",
    "k-btn--publish",
    "k-btn--edit",
    "k-btn--secondary",
    "k-btn--ghost",
    "k-btn--destructive",
    "k-card",
    "k-card--hero",
    "k-sidebar",
    "k-fab",
    "k-fab__count",
    "k-fab__btn",
    "k-fab__btn--primary",
    "k-fab__close",
  ],
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

        // ════ Kivasy v4 canonical bindings (rollout-1 zemin) ════════════
        // Yeni surface'ler bunları kullanır. `--k-*` hex literal olduğu için
        // Tailwind opacity sistemine girmez (hsl tuple değil); ihtiyaç olunca
        // ayrı utility eklenir. Yeterli rolü `bg-paper`, `text-ink` vs.
        paper: "var(--k-paper)",
        ink: "var(--k-ink)",
        "ink-2": "var(--k-ink-2)",
        "ink-3": "var(--k-ink-3)",
        "ink-4": "var(--k-ink-4)",
        line: "var(--k-line)",
        "line-strong": "var(--k-line-strong)",
        "line-soft": "var(--k-line-soft)",
        // Kivasy tinted bg (warm paper) — `--k-bg`/`--k-bg-2`
        "k-bg": "var(--k-bg)",
        "k-bg-2": "var(--k-bg-2)",
        // Stage palette (orange + blue + purple)
        "k-orange": "var(--k-orange)",
        "k-orange-deep": "var(--k-orange-deep)",
        "k-orange-bright": "var(--k-orange-bright)",
        "k-orange-soft": "var(--k-orange-soft)",
        "k-orange-ink": "var(--k-orange-ink)",
        "k-blue": "var(--k-blue)",
        "k-blue-deep": "var(--k-blue-deep)",
        "k-blue-bright": "var(--k-blue-bright)",
        "k-blue-soft": "var(--k-blue-soft)",
        "k-purple": "var(--k-purple)",
        "k-purple-deep": "var(--k-purple-deep)",
        "k-purple-bright": "var(--k-purple-bright)",
        "k-purple-soft": "var(--k-purple-soft)",
        // Status (Kivasy modifiers)
        "k-green": "var(--k-green)",
        "k-green-soft": "var(--k-green-soft)",
        "k-amber": "var(--k-amber)",
        "k-amber-soft": "var(--k-amber-soft)",
        "k-red": "var(--k-red)",
        "k-red-soft": "var(--k-red-soft)",
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
        // R3.5 — Kivasy v4 type stack: General Sans / Geist Mono / Clash Display.
        // The legacy --font-sans / --font-mono CSS variables in globals.css now
        // resolve to Kivasy fonts directly (no longer pointing at next/font
        // Inter / Plex Mono).
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
        display: "var(--font-display)",
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
