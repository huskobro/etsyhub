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
//
// Phase 8 fit-and-finish — `initialProviderId` prop server-side
// UserSetting.aiMode.defaultImageProvider'dan gelir. AiModePanel form'a
// initial state olarak pass edilir; kullanıcı dropdown'dan override eder.
export function VariationsPage({
  referenceId,
  initialProviderId,
}: {
  referenceId: string;
  initialProviderId?: string;
}) {
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
          {/* Phase 9 — batch language.
           * Phase 43 — Legacy bridge note. Bu page tek-reference batch
           * için Phase 41 baseline'ı; Pool card "New Batch" CTA bu yola
           * GİTMİYOR (yeni canonical akış: Pool card → POST /api/batches
           * → /batches/[id]/compose). Eski deep link'ler ve test
           * referansları için bridge olarak kalıyor. */}
          Generate a new batch from this reference (legacy single-reference
          flow). Local: pick from your library · AI: ask the provider. Track
          progress in{" "}
          <a
            href="/batches"
            className="text-accent underline hover:text-accent-hover"
          >
            Batches
          </a>
          ; decide kept items in{" "}
          <a
            href="/review"
            className="text-accent underline hover:text-accent-hover"
          >
            Review
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
      {/* Phase 44 — Legacy deprecation banner. Pool card "New Batch"
        * artık yeni canonical akışı kullanıyor: POST /api/batches → real
        * Batch row → /batches/[id]/compose (v4 A6 launch screen). Bu
        * route hâlâ erişilebilir (eski test fixture'ları + derin link'ler
        * için bridge) ama yeni operasyona uygun değil. */}
      <div
        className="mb-4 flex items-start gap-3 rounded-md border border-warning bg-warning-soft/40 px-4 py-3"
        role="status"
        data-testid="variations-legacy-banner"
      >
        <div className="flex-1">
          <div className="text-[13px] font-medium text-ink">
            Legacy single-reference flow
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-2">
            The new canonical path is{" "}
            <strong className="text-ink">References → New Batch</strong> →
            batch compose page (Provider · Aspect · Count · Launch). This
            page still works for direct deep-links but isn&apos;t the
            recommended flow.
          </p>
          <a
            href="/references"
            className="mt-2 inline-flex h-7 items-center gap-1 rounded-md border border-line bg-paper px-2 text-[11.5px] font-medium text-ink hover:border-line-strong"
            data-testid="variations-legacy-banner-cta"
          >
            Go to References
          </a>
        </div>
      </div>

      {mode === "local" ? (
        <LocalModePanel />
      ) : (
        <AiModePanel
          referenceId={referenceId}
          initialProviderId={initialProviderId}
        />
      )}
    </PageShell>
  );
}
