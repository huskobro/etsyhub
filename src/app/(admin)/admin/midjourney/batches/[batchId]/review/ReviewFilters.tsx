"use client";

// Pass 89 — Batch Review Studio V1: Filter bar.
//
// Chip'ler:
//   - Decision: all / undecided / kept / rejected
//   - Variant: all / GRID / UPSCALE / VARIATION
//
// + "Bulk Reset" buton (tüm batch'i UNDECIDED'a sıfırla, confirm ile).

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const DECISION_CHIPS: Array<{
  key: "all" | "undecided" | "kept" | "rejected";
  label: string;
}> = [
  { key: "undecided", label: "Bekliyor" },
  { key: "kept", label: "Tutuldu" },
  { key: "rejected", label: "Reddedildi" },
  { key: "all", label: "Tümü" },
];

const VARIANT_CHIPS: Array<{
  key: "all" | "GRID" | "UPSCALE" | "VARIATION";
  label: string;
}> = [
  { key: "all", label: "Tümü" },
  { key: "GRID", label: "Grid" },
  { key: "UPSCALE", label: "Upscale" },
  { key: "VARIATION", label: "Variation" },
];

type ReviewFiltersProps = {
  batchId: string;
  /** Reset edilebilecek asset sayısı (KEPT + REJECTED). 0 ise buton disabled. */
  resetableCount: number;
};

export function ReviewFilters({ batchId, resetableCount }: ReviewFiltersProps) {
  const router = useRouter();
  const params = useSearchParams();
  const currentDecision = params.get("decision") ?? "undecided";
  const currentVariant = params.get("variantKind") ?? "all";
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pushWith(updater: (sp: URLSearchParams) => void) {
    const sp = new URLSearchParams(params.toString());
    sp.delete("cursorId");
    updater(sp);
    startTransition(() => {
      router.push(
        `/admin/midjourney/batches/${batchId}/review?${sp.toString()}`,
      );
    });
  }

  function setDecision(d: string) {
    pushWith((sp) => {
      if (d === "undecided") sp.delete("decision");
      else sp.set("decision", d);
    });
  }

  function setVariant(v: string) {
    pushWith((sp) => {
      if (v === "all") sp.delete("variantKind");
      else sp.set("variantKind", v);
    });
  }

  async function bulkReset() {
    if (resetableCount === 0) return;
    if (
      !confirm(
        `Bu batch'teki ${resetableCount} kararı sıfırlamak istediğinden emin misin?\n\nTüm Tutuldu/Reddedildi → Bekliyor olur. Bu işlem geri alınamaz.`,
      )
    ) {
      return;
    }
    setResetting(true);
    setResetError(null);
    try {
      const res = await fetch(
        `/api/admin/midjourney/batches/${batchId}/review/reset`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "fail");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3"
      data-testid="mj-review-filters"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-muted">Karar:</span>
        {DECISION_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setDecision(c.key)}
            disabled={pending}
            className={
              "rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-50 " +
              (currentDecision === c.key
                ? "border-accent bg-accent text-on-accent font-semibold"
                : "border-border bg-bg text-text-muted hover:border-border-strong hover:text-text")
            }
            data-testid={`mj-review-decision-${c.key}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-text-muted">Tür:</span>
        {VARIANT_CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setVariant(c.key)}
            disabled={pending}
            className={
              "rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-50 " +
              (currentVariant === c.key
                ? "border-accent bg-accent text-on-accent font-semibold"
                : "border-border bg-bg text-text-muted hover:border-border-strong hover:text-text")
            }
            data-testid={`mj-review-variant-${c.key}`}
          >
            {c.label}
          </button>
        ))}

        {/* Bulk reset — sadece KEPT+REJECTED varsa aktif */}
        <div className="ml-auto flex items-center gap-2">
          {resetError ? (
            <span className="text-xs text-danger">⚠ {resetError}</span>
          ) : null}
          <button
            type="button"
            onClick={bulkReset}
            disabled={resetting || resetableCount === 0}
            className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text-muted transition hover:border-warning hover:text-warning disabled:opacity-40"
            data-testid="mj-review-bulk-reset"
            title={
              resetableCount === 0
                ? "Sıfırlanacak karar yok"
                : `${resetableCount} kararı sıfırla`
            }
          >
            {resetting
              ? "Sıfırlanıyor…"
              : `↺ ${resetableCount} kararı sıfırla`}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span>Kısayollar:</span>
        <kbd className="rounded border border-border bg-bg px-1 font-mono">
          1
        </kbd>{" "}
        Tut
        <kbd className="rounded border border-border bg-bg px-1 font-mono">
          2
        </kbd>{" "}
        Reddet
        <kbd className="rounded border border-border bg-bg px-1 font-mono">
          3
        </kbd>{" "}
        Sıfırla
        <span className="text-text-subtle">
          (kart üzerine fareyi getir, tuşa bas)
        </span>
      </div>
    </div>
  );
}
