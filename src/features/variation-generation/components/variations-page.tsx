"use client";

import { useState } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { LocalModePanel } from "./local-mode-panel";
import { AiModePanel } from "./ai-mode-panel";
import { cn } from "@/lib/cn";

type Mode = "local" | "ai";

// Phase 5 §5.2/5.3 — Variations cockpit. R0: default Local mode (offline,
// maliyet üretmez). AI mode bilinçli aksiyonla seçilir; geçişte cost banner
// AiModePanel içinde gösterilir.
export function VariationsPage({ referenceId }: { referenceId: string }) {
  const [mode, setMode] = useState<Mode>("local");

  const tabClass = (active: boolean) =>
    cn(
      "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
      active
        ? "border-accent bg-accent text-accent-foreground"
        : "border-border bg-surface text-text hover:border-border-strong",
    );

  return (
    <PageShell
      title={
        <span className="flex items-center gap-2">
          <span>Production workshop</span>
          {/* Pass 25 — workspace label clarity. Production = here,
              Decision = /review. Consistent language across surfaces. */}
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-text">
            Production
          </span>
        </span>
      }
      subtitle={
        <span>
          Generate new variants from this reference. Local: pick from your library · AI: ask the provider for new variants. New visuals land in{" "}
          <a
            href="/review"
            className="text-accent underline hover:text-accent-hover"
          >
            the Decision workspace (Review)
          </a>
          .
        </span>
      }
      toolbar={
        <div role="tablist" aria-label="Variations mode" className="flex gap-2">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "local"}
            onClick={() => setMode("local")}
            className={tabClass(mode === "local")}
          >
            Local
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "ai"}
            onClick={() => setMode("ai")}
            className={tabClass(mode === "ai")}
          >
            AI Generated
          </button>
        </div>
      }
    >
      {mode === "local" ? (
        <LocalModePanel />
      ) : (
        <AiModePanel referenceId={referenceId} />
      )}
    </PageShell>
  );
}
