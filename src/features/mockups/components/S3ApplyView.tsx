"use client";

// Phase 8 Task 23 — S3 Apply view (4-zone iskelet).
//
// Spec §5.2: Sticky header + Set Özeti + Pack Önizleme + Sticky karar bandı.
// T23 = iskelet; alt component'ler Task 24-25'te:
//   - SetSummaryCard (Task 24)
//   - PackPreviewCard + chips + drawer link + tooltip (Task 25)
//   - DecisionBand submit logic + 9-state coverage (Task 25)
//
// Hook bağlama:
//   - useSelectionSet (Phase 7) — set veri kaynağı
//   - useMockupTemplates (Task 22) — template katalog
//   - useMockupPackState (Task 14) — selected templates + dirty state
//   - useMockupOverlayState (Task 15) — drawer/modal URL state

import { useSelectionSet } from "@/features/selection/queries";
import { useMockupTemplates } from "@/features/mockups/hooks/useMockupTemplates";
import { useMockupPackState } from "@/features/mockups/hooks/useMockupPackState";
import { useMockupOverlayState } from "@/features/mockups/hooks/useMockupOverlayState";

export function S3ApplyView({ setId }: { setId: string }) {
  const { data: set, isLoading: setLoading } = useSelectionSet(setId);
  const { data: templates = [], isLoading: templatesLoading } =
    useMockupTemplates({ categoryId: "canvas" });
  const packState = useMockupPackState(setId);
  // overlay state Task 25'te +Template/Özelleştir butonlarına bağlanacak;
  // T23'te kullanılmıyor ama ileride büyürken kırılmaması için import edildi
  useMockupOverlayState();

  if (setLoading || templatesLoading) {
    return <div className="p-6 text-sm text-text-muted">Yükleniyor…</div>;
  }

  const isQuickPack = !packState.isCustom;
  const actualPackSize = packState.selectedTemplateIds.length;

  return (
    <main className="flex min-h-screen flex-col bg-white">
      {/* Zone 1: Sticky üst bar */}
      <header className="sticky top-0 z-10 border-b border-border bg-white px-6 py-3">
        <nav className="text-sm text-text-muted">
          <span>← </span>
          <a href="/selection" className="hover:text-text">
            Selection
          </a>
          <span className="mx-1.5">/</span>
          <a href={`/selection/sets/${setId}`} className="hover:text-text">
            {set?.name ?? "Set"}
          </a>
          <span className="mx-1.5">/</span>
          <span className="font-medium text-text">Mockup Studio</span>
        </nav>
      </header>

      {/* Body: scrollable */}
      <div className="flex-1 space-y-6 px-6 py-6">
        {/* Zone 2: Set Özeti placeholder (Task 24'te SetSummaryCard) */}
        <section
          aria-label="Set özeti"
          className="rounded-md border border-border bg-surface-2 p-4"
        >
          <p className="text-sm text-text-muted">
            SetSummaryCard — Task 24
          </p>
        </section>

        {/* Zone 3: Pack Önizleme (asıl karar yüzeyi) */}
        <section
          aria-label="Pack önizleme"
          className="rounded-md border border-border p-4"
        >
          <div className="flex items-center gap-2">
            <span
              data-testid="pack-badge"
              className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900"
            >
              {isQuickPack ? "★ Quick Pack" : "Custom Pack"}
            </span>
            <span className="text-sm text-text">
              • {actualPackSize} görsel üretilecek
            </span>
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Pack Preview detayları — Task 25
          </p>
        </section>
      </div>

      {/* Zone 4: Sticky karar bandı */}
      <footer className="sticky bottom-0 border-t border-border bg-white px-6 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">
            Tahmini süre: ~30 saniye
          </span>
          <button
            type="button"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Render et ({isQuickPack ? "Quick Pack" : "Custom Pack"})
          </button>
        </div>
      </footer>
    </main>
  );
}
